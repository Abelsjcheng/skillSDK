package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.opencode.skill.constant.MessageType;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SessionMessagePart;
import com.opencode.skill.model.StreamMessage;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NavigableSet;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Local cache for server history + websocket streaming events.
 */
public class StreamingMessageCache {
    private static final Comparator<SessionMessagePart> PART_COMPARATOR =
            Comparator.comparing((SessionMessagePart p) -> p.getPartSeq() == null ? Integer.MAX_VALUE : p.getPartSeq());

    private static final Comparator<SessionMessage> MESSAGE_COMPARATOR = (left, right) -> {
        int cmp = compareNullableInt(left.getSeq(), right.getSeq());
        if (cmp != 0) {
            return cmp;
        }
        cmp = compareNullableInt(left.getMessageSeq(), right.getMessageSeq());
        if (cmp != 0) {
            return cmp;
        }
        return left.getId().compareTo(right.getId());
    };

    @NonNull
    private final Gson gson = new Gson();
    @NonNull
    private final Map<String, SessionCache> sessionCaches = new ConcurrentHashMap<>();

    public void ingestServerMessages(@NonNull String welinkSessionId, @NonNull List<SessionMessage> messages) {
        SessionCache cache = sessionCache(welinkSessionId);
        synchronized (cache) {
            for (SessionMessage message : messages) {
                Long numericMessageId = resolveNumericMessageIdIfPresent(cache, message.getId(), message.getMessageSeq());
                if (numericMessageId == null) {
                    continue;
                }
                CachedMessage cached = cache.byNumericId.computeIfAbsent(numericMessageId, k -> new CachedMessage());
                cached.message = cloneMessage(message);
                if (cached.message.getId().isEmpty()) {
                    cached.message.setId(String.valueOf(numericMessageId));
                }
                cached.message.setWelinkSessionId(welinkSessionId);
                cached.completed = true;
                cached.updatedAt = System.currentTimeMillis();
                markPartIndexDirty(cached);
                refreshCompletedMessageIndex(cache, numericMessageId, cached);
            }
        }
    }

    public void recordUserMessage(@NonNull SendMessageResult message) {
        SessionCache cache = sessionCache(message.getWelinkSessionId());
        synchronized (cache) {
            long numericMessageId = resolveNumericMessageId(cache, message.getId(), message.getMessageSeq());
            CachedMessage cached = cache.byNumericId.computeIfAbsent(numericMessageId, k -> new CachedMessage());
            SessionMessage sessionMessage = cached.message;
            sessionMessage.setId(message.getId());
            sessionMessage.setWelinkSessionId(message.getWelinkSessionId());
            sessionMessage.setRole(message.getRole());
            sessionMessage.setContent(message.getContent());
            sessionMessage.setSeq(message.getSeq());
            sessionMessage.setMessageSeq(message.getMessageSeq());
            sessionMessage.setMeta(message.getMeta());
            sessionMessage.setContentType(message.getContentType());
            sessionMessage.setParts(message.getParts());
            sessionMessage.setCreatedAt(message.getCreatedAt());
            cached.completed = true;
            cached.updatedAt = System.currentTimeMillis();
            markPartIndexDirty(cached);
            refreshCompletedMessageIndex(cache, numericMessageId, cached);
        }
    }

    @Nullable
    public String findLastUserMessageContent(@NonNull String welinkSessionId) {
        SessionCache cache = sessionCaches.get(welinkSessionId);
        if (cache == null) {
            return null;
        }
        synchronized (cache) {
            SessionMessage latest = null;
            for (CachedMessage candidate : cache.byNumericId.values()) {
                SessionMessage current = candidate.message;
                if (!"user".equalsIgnoreCase(current.getRole())) {
                    continue;
                }
                if (latest == null || MESSAGE_COMPARATOR.compare(current, latest) > 0) {
                    latest = current;
                }
            }
            return latest == null ? null : latest.getContent();
        }
    }

    public void ingestStreamMessage(@NonNull StreamMessage event) {
        String sessionId = event.getWelinkSessionId();
        if (sessionId == null || sessionId.trim().isEmpty()) {
            return;
        }
        SessionCache cache = sessionCache(sessionId);
        synchronized (cache) {
            String type = event.getType();
            if (type == null || type.isEmpty()) {
                return;
            }
            if (MessageType.SNAPSHOT.equals(type)) {
                mergeSnapshot(cache, sessionId, event.getMessages());
                return;
            }
            if (MessageType.STREAMING.equals(type)) {
                mergeStreaming(cache, sessionId, event);
                return;
            }
            if (isTransportOnlyType(type)) {
                applyTransportOnlyEvent(cache, event);
                return;
            }
            if ((event.getMessageId() == null || event.getMessageId().trim().isEmpty()) && event.getMessageSeq() == null) {
                return;
            }

            CachedMessage cached = getOrCreateCachedMessage(cache, sessionId, event);
            Long numericMessageId = resolveExistingNumericMessageId(cache, cached.message.getId());
            if (numericMessageId == null) {
                return;
            }
            applyEventToMessage(cache, numericMessageId, cached, event);
        }
    }

    @NonNull
    public PageResult<SessionMessage> mergeWithLocalCache(@NonNull String welinkSessionId,
            @NonNull PageResult<SessionMessage> serverPage) {
        List<SessionMessage> serverContent = new ArrayList<>(serverPage.getContent());
        ingestServerMessages(welinkSessionId, serverContent);
        MessageIdentityIndex serverIdentity = buildMessageIdentityIndex(serverContent);

        SessionMessage localLatest = findLatestLocalMessageNotInServer(welinkSessionId, serverIdentity);
        if (localLatest == null) {
            return serverPage;
        }

        String localMessageId = normalizeMessageId(localLatest.getId());
        Integer localMessageSeq = localLatest.getMessageSeq();
        List<SessionMessage> mergedContent = new ArrayList<>(serverContent.size() + 1);
        mergedContent.add(localLatest);
        for (SessionMessage message : serverContent) {
            if (matchesIdentity(message, localMessageId, localMessageSeq)) {
                continue;
            }
            mergedContent.add(message);
        }

        PageResult<SessionMessage> merged = new PageResult<>();
        merged.setContent(mergedContent);
        merged.setPage(serverPage.getPage());
        merged.setSize(serverPage.getSize());
        merged.setTotal(serverPage.getTotal());
        merged.setTotalPages(serverPage.getTotalPages());
        return merged;
    }

    @Nullable
    private SessionMessage findLatestLocalMessageNotInServer(@NonNull String welinkSessionId,
            @NonNull MessageIdentityIndex serverIdentity) {
        SessionCache cache = sessionCaches.get(welinkSessionId);
        if (cache == null) {
            return null;
        }
        synchronized (cache) {
            SessionMessage latest = null;
            for (CachedMessage candidate : cache.byNumericId.values()) {
                SessionMessage current = candidate.message;
                if (serverIdentity.contains(current)) {
                    continue;
                }
                if (latest == null || MESSAGE_COMPARATOR.compare(current, latest) > 0) {
                    latest = current;
                }
            }
            return latest == null ? null : cloneMessage(latest);
        }
    }

    @NonNull
    private static MessageIdentityIndex buildMessageIdentityIndex(@NonNull List<SessionMessage> messages) {
        MessageIdentityIndex index = new MessageIdentityIndex();
        for (SessionMessage message : messages) {
            index.add(message);
        }
        return index;
    }

    @NonNull
    private static String normalizeMessageId(@Nullable String messageId) {
        return messageId == null ? "" : messageId.trim();
    }

    private static boolean matchesIdentity(@NonNull SessionMessage message, @NonNull String messageId,
            @Nullable Integer messageSeq) {
        String currentId = normalizeMessageId(message.getId());
        if (!messageId.isEmpty() && !currentId.isEmpty() && messageId.equals(currentId)) {
            return true;
        }
        Integer currentMessageSeq = message.getMessageSeq();
        return messageSeq != null && currentMessageSeq != null && messageSeq.intValue() == currentMessageSeq.intValue();
    }

    @Nullable
    public String getCompletedMessageContent(@NonNull String welinkSessionId, @Nullable String messageId) {
        SessionCache cache = sessionCaches.get(welinkSessionId);
        if (cache == null) {
            return null;
        }
        synchronized (cache) {
            if (messageId != null && !messageId.trim().isEmpty()) {
                Long numericMessageId = resolveExistingNumericMessageId(cache, messageId);
                if (numericMessageId == null) {
                    return null;
                }
                CachedMessage found = cache.byNumericId.get(numericMessageId);
                if (found == null || !found.completed) {
                    return null;
                }
                return resolvedContent(found.message);
            }

            while (!cache.completedMessageIds.isEmpty()) {
                Long latestMessageId = cache.completedMessageIds.last();
                CachedMessage latest = cache.byNumericId.get(latestMessageId);
                if (latest == null || !latest.completed) {
                    cache.completedMessageIds.pollLast();
                    continue;
                }
                return resolvedContent(latest.message);
            }
            return null;
        }
    }

    public boolean hasMessage(@NonNull String welinkSessionId, @NonNull String messageId) {
        if (messageId.trim().isEmpty()) {
            return false;
        }
        SessionCache cache = sessionCaches.get(welinkSessionId);
        if (cache == null) {
            return false;
        }
        synchronized (cache) {
            Long numericMessageId = resolveExistingNumericMessageId(cache, messageId);
            return numericMessageId != null && cache.byNumericId.containsKey(numericMessageId);
        }
    }

    public boolean isMessageCompleted(@NonNull String welinkSessionId, @NonNull String messageId) {
        if (messageId.trim().isEmpty()) {
            return false;
        }
        SessionCache cache = sessionCaches.get(welinkSessionId);
        if (cache == null) {
            return false;
        }
        synchronized (cache) {
            Long numericMessageId = resolveExistingNumericMessageId(cache, messageId);
            if (numericMessageId == null) {
                return false;
            }
            CachedMessage message = cache.byNumericId.get(numericMessageId);
            return message != null && message.completed;
        }
    }

    public void clearSession(@NonNull String welinkSessionId) {
        sessionCaches.remove(welinkSessionId);
    }

    public void clearAll() {
        sessionCaches.clear();
    }

    @NonNull
    private SessionCache sessionCache(@NonNull String sessionId) {
        return sessionCaches.computeIfAbsent(sessionId, key -> new SessionCache());
    }

    private static boolean isTransportOnlyType(@NonNull String type) {
        return MessageType.SESSION_STATUS.equals(type)
                || MessageType.SESSION_TITLE.equals(type)
                || MessageType.SESSION_ERROR.equals(type)
                || MessageType.AGENT_ONLINE.equals(type)
                || MessageType.AGENT_OFFLINE.equals(type)
                || MessageType.ERROR.equals(type);
    }

    private void applyTransportOnlyEvent(@NonNull SessionCache cache, @NonNull StreamMessage event) {
        String type = event.getType();
        if (type == null) {
            return;
        }
        if (MessageType.SESSION_STATUS.equals(type)) {
            if ("idle".equalsIgnoreCase(event.getSessionStatus())) {
                markLatestMessageCompleted(cache, true);
                return;
            }
            if ("busy".equalsIgnoreCase(event.getSessionStatus()) || "retry".equalsIgnoreCase(event.getSessionStatus())) {
                markLatestMessageCompleted(cache, false);
                return;
            }
            return;
        }
        if (MessageType.SESSION_ERROR.equals(type)
                || MessageType.ERROR.equals(type)
                || MessageType.AGENT_OFFLINE.equals(type)) {
            markLatestMessageCompleted(cache, true);
        }
    }

    private void markLatestMessageCompleted(@NonNull SessionCache cache, boolean completed) {
        Long latestMessageId = null;
        CachedMessage latest = null;
        for (Map.Entry<Long, CachedMessage> entry : cache.byNumericId.entrySet()) {
            CachedMessage candidate = entry.getValue();
            if (latest == null || MESSAGE_COMPARATOR.compare(candidate.message, latest.message) > 0) {
                latest = candidate;
                latestMessageId = entry.getKey();
            }
        }
        if (latest == null) {
            return;
        }
        latest.completed = completed;
        latest.updatedAt = System.currentTimeMillis();
        if (latestMessageId != null) {
            refreshCompletedMessageIndex(cache, latestMessageId, latest);
        }
    }

    @NonNull
    private CachedMessage getOrCreateCachedMessage(@NonNull SessionCache cache, @NonNull String welinkSessionId,
            @NonNull StreamMessage event) {
        long numericId = resolveNumericMessageId(cache, event.getMessageId(), event.getMessageSeq());
        CachedMessage cached = cache.byNumericId.computeIfAbsent(numericId, key -> new CachedMessage());
        SessionMessage message = cached.message;
        message.setId(resolveDisplayMessageId(event, numericId));
        message.setWelinkSessionId(welinkSessionId);
        if (event.getRole() != null && !event.getRole().isEmpty()) {
            message.setRole(event.getRole());
        }
        if (event.getMessageSeq() != null) {
            message.setMessageSeq(event.getMessageSeq());
        }
        if (message.getCreatedAt().isEmpty()) {
            message.setCreatedAt(event.getEmittedAt() == null ? Instant.now().toString() : event.getEmittedAt());
        }
        return cached;
    }

    @NonNull
    private static String resolveDisplayMessageId(@NonNull StreamMessage event, long numericId) {
        String stableMessageId = event.getMessageId();
        if (stableMessageId != null && !stableMessageId.trim().isEmpty()) {
            return stableMessageId.trim();
        }
        return String.valueOf(numericId);
    }

    private long resolveNumericMessageId(@NonNull SessionCache cache, @Nullable String messageId, @Nullable Integer messageSeq) {
        String normalizedMessageId = messageId == null ? null : messageId.trim();
        if (normalizedMessageId != null && !normalizedMessageId.isEmpty()) {
            Long parsed = parseLong(normalizedMessageId);
            if (parsed != null) {
                return parsed;
            }
            Long existing = cache.stableToNumericId.get(normalizedMessageId);
            if (existing != null) {
                return existing;
            }
            long synthetic = cache.syntheticIdGenerator.getAndDecrement();
            cache.stableToNumericId.put(normalizedMessageId, synthetic);
            return synthetic;
        }

        String seqKey = messageSeq == null ? "__unknown__" : "__seq__" + messageSeq;
        Long existing = cache.stableToNumericId.get(seqKey);
        if (existing != null) {
            return existing;
        }
        long synthetic = cache.syntheticIdGenerator.getAndDecrement();
        cache.stableToNumericId.put(seqKey, synthetic);
        return synthetic;
    }

    @Nullable
    private Long resolveExistingNumericMessageId(@NonNull SessionCache cache, @Nullable String messageId) {
        String normalizedMessageId = messageId == null ? null : messageId.trim();
        if (normalizedMessageId == null || normalizedMessageId.isEmpty()) {
            return null;
        }
        Long parsed = parseLong(normalizedMessageId);
        if (parsed != null) {
            return parsed;
        }
        return cache.stableToNumericId.get(normalizedMessageId);
    }

    private void applyEventToMessage(@NonNull SessionCache cache, long numericMessageId, @NonNull CachedMessage cached,
            @NonNull StreamMessage event) {
        String type = event.getType();
        if (type == null) {
            return;
        }
        cache.completedMessageIds.remove(numericMessageId);
        SessionMessage message = cached.message;

        switch (type) {
            case MessageType.TEXT_DELTA:
            case MessageType.THINKING_DELTA:
                updatePart(cached, event, true);
                cached.completed = false;
                break;
            case MessageType.TEXT_DONE:
            case MessageType.THINKING_DONE:
                updatePart(cached, event, false);
                cached.completed = true;
                break;
            case MessageType.TOOL_UPDATE:
            case MessageType.QUESTION:
            case MessageType.PERMISSION_ASK:
            case MessageType.PERMISSION_REPLY:
            case MessageType.FILE:
                updatePart(cached, event, false);
                if (MessageType.PERMISSION_REPLY.equals(type) && "reject".equalsIgnoreCase(event.getResponse())) {
                    cached.completed = true;
                }
                break;
            case MessageType.STEP_DONE:
                cached.completed = true;
                break;
            default:
                break;
        }
        recalculateContent(message);
        cached.updatedAt = System.currentTimeMillis();
        refreshCompletedMessageIndex(cache, numericMessageId, cached);
    }

    private void updatePart(@NonNull CachedMessage cached, @NonNull StreamMessage event, boolean appendContent) {
        SessionMessagePart target = findOrCreatePart(cached, event);
        target.setType(defaultString(target.getType(), inferPartType(event.getType())));
        updatePartContent(target, event, appendContent);
        updateOptionalPartFields(target, event);
    }

    private static void updatePartContent(@NonNull SessionMessagePart target, @NonNull StreamMessage event,
            boolean appendContent) {
        String incomingContent = event.getContent();
        if (incomingContent == null) {
            return;
        }
        if (!appendContent) {
            target.setContent(incomingContent);
            return;
        }
        String existingContent = target.getContent();
        target.setContent(existingContent == null ? incomingContent : existingContent + incomingContent);
    }

    private static void updateOptionalPartFields(@NonNull SessionMessagePart target, @NonNull StreamMessage event) {
        applyIfNotNull(event.getToolName(), target::setToolName);
        applyIfNotNull(event.getToolCallId(), target::setToolCallId);
        applyIfNotNull(event.getStatus(), target::setStatus);
        applyIfNotNull(event.getInput(), target::setInput);
        applyIfNotNull(event.getOutput(), target::setOutput);
        applyIfNotNull(event.getError(), target::setError);
        applyIfNotNull(event.getTitle(), target::setTitle);
        applyIfNotNull(event.getQuestion(), target::setQuestion);
        applyIfNotNull(event.getHeader(), target::setHeader);
        applyIfNotEmpty(event.getOptions(), target::setOptions);
        applyIfNotNull(event.getPermissionId(), target::setPermissionId);
        applyIfNotNull(event.getPermType(), target::setPermType);
        applyIfNotNull(event.getMetadata(), target::setMetadata);
        applyIfNotNull(event.getResponse(), target::setResponse);
        applyIfNotNull(event.getFileName(), target::setFileName);
        applyIfNotNull(event.getFileUrl(), target::setFileUrl);
        applyIfNotNull(event.getFileMime(), target::setFileMime);
    }

    private static <T> void applyIfNotNull(@Nullable T value, @NonNull Consumer<T> setter) {
        if (value != null) {
            setter.accept(value);
        }
    }

    private static void applyIfNotEmpty(@Nullable List<String> value, @NonNull Consumer<List<String>> setter) {
        if (value != null && !value.isEmpty()) {
            setter.accept(value);
        }
    }

    @NonNull
    private SessionMessagePart findOrCreatePart(@NonNull CachedMessage cached, @NonNull StreamMessage event) {
        ensurePartIndex(cached);

        String incomingPartId = normalizeMessageId(event.getPartId());
        Integer incomingPartSeq = event.getPartSeq();

        SessionMessagePart existing = null;
        if (!incomingPartId.isEmpty()) {
            existing = cached.partsById.get(incomingPartId);
        }
        if (existing == null && incomingPartSeq != null) {
            existing = cached.partsBySeq.get(incomingPartSeq);
        }
        if (existing != null) {
            if (!incomingPartId.isEmpty() && normalizeMessageId(existing.getPartId()).isEmpty()) {
                existing.setPartId(incomingPartId);
            }
            if (incomingPartSeq != null && existing.getPartSeq() == null) {
                existing.setPartSeq(incomingPartSeq);
            }
            indexPart(cached, existing);
            return existing;
        }

        SessionMessagePart created = new SessionMessagePart();
        if (!incomingPartId.isEmpty()) {
            created.setPartId(incomingPartId);
        }
        created.setPartSeq(incomingPartSeq);
        ensureParts(cached.message).add(created);
        indexPart(cached, created);
        return created;
    }

    private void recalculateContent(@NonNull SessionMessage message) {
        ensureParts(message).sort(PART_COMPARATOR);
        StringBuilder builder = new StringBuilder();
        for (SessionMessagePart part : ensureParts(message)) {
            if (part.getContent() != null) {
                builder.append(part.getContent());
            }
        }
        if (builder.length() > 0) {
            message.setContent(builder.toString());
        }
    }

    private static void refreshCompletedMessageIndex(@NonNull SessionCache cache, long numericMessageId,
            @NonNull CachedMessage cached) {
        cache.completedMessageIds.remove(numericMessageId);
        if (cached.completed) {
            cache.completedMessageIds.add(numericMessageId);
        }
    }

    private static void markPartIndexDirty(@NonNull CachedMessage cached) {
        cached.partsById.clear();
        cached.partsBySeq.clear();
        cached.partIndexReady = false;
    }

    private static void ensurePartIndex(@NonNull CachedMessage cached) {
        if (cached.partIndexReady) {
            return;
        }
        cached.partsById.clear();
        cached.partsBySeq.clear();
        for (SessionMessagePart part : ensureParts(cached.message)) {
            indexPart(cached, part);
        }
        cached.partIndexReady = true;
    }

    private static void indexPart(@NonNull CachedMessage cached, @NonNull SessionMessagePart part) {
        String partId = normalizeMessageId(part.getPartId());
        if (!partId.isEmpty()) {
            cached.partsById.put(partId, part);
            if (part.getPartId() == null || !partId.equals(part.getPartId())) {
                part.setPartId(partId);
            }
        }
        Integer partSeq = part.getPartSeq();
        if (partSeq != null) {
            cached.partsBySeq.put(partSeq, part);
        }
    }

    private void mergeSnapshot(@NonNull SessionCache cache, @NonNull String welinkSessionId, @Nullable JsonArray snapshotMessages) {
        if (snapshotMessages == null) {
            return;
        }
        for (JsonElement item : snapshotMessages) {
            if (item == null || !item.isJsonObject()) {
                continue;
            }
            SessionMessage message = parseSnapshotMessage(cache, welinkSessionId, item.getAsJsonObject());
            if (message == null) {
                continue;
            }
            Long numericMessageId = resolveNumericMessageIdIfPresent(cache, message.getId(), message.getMessageSeq());
            if (numericMessageId == null) {
                continue;
            }
            CachedMessage cached = cache.byNumericId.computeIfAbsent(numericMessageId, k -> new CachedMessage());
            cached.message = cloneMessage(message);
            cached.completed = true;
            cached.updatedAt = System.currentTimeMillis();
            markPartIndexDirty(cached);
            refreshCompletedMessageIndex(cache, numericMessageId, cached);
        }
    }

    private void mergeStreaming(@NonNull SessionCache cache, @NonNull String welinkSessionId, @NonNull StreamMessage event) {
        if ((event.getMessageId() == null || event.getMessageId().trim().isEmpty()) && event.getMessageSeq() == null) {
            return;
        }
        CachedMessage cached = getOrCreateCachedMessage(cache, welinkSessionId, event);
        SessionMessage message = cached.message;
        JsonArray parts = event.getParts();
        if (parts != null) {
            Map<String, SessionMessagePart> currentPartsById = new HashMap<>();
            Map<Integer, SessionMessagePart> currentPartsBySeq = new HashMap<>();
            for (SessionMessagePart part : ensureParts(message)) {
                String partId = normalizeMessageId(part.getPartId());
                if (!partId.isEmpty()) {
                    currentPartsById.put(partId, part);
                }
                Integer partSeq = part.getPartSeq();
                if (partSeq != null) {
                    currentPartsBySeq.put(partSeq, part);
                }
            }
            for (JsonElement partJson : parts) {
                if (partJson == null || !partJson.isJsonObject()) {
                    continue;
                }
                SessionMessagePart incoming = parsePartFromJson(partJson.getAsJsonObject());
                if (incoming == null) {
                    continue;
                }
                mergePart(message, currentPartsById, currentPartsBySeq, incoming);
            }
        }
        recalculateContent(message);
        cached.completed = "idle".equalsIgnoreCase(event.getSessionStatus());
        cached.updatedAt = System.currentTimeMillis();
        markPartIndexDirty(cached);
        Long numericMessageId = resolveExistingNumericMessageId(cache, message.getId());
        if (numericMessageId != null) {
            refreshCompletedMessageIndex(cache, numericMessageId, cached);
        }
    }

    @Nullable
    private SessionMessage parseSnapshotMessage(@NonNull SessionCache cache, @NonNull String welinkSessionId, @NonNull JsonObject item) {
        String stableMessageId = getString(item, "id");
        Integer messageSeq = getInteger(item, "messageSeq");
        Integer seq = getInteger(item, "seq");
        if (messageSeq == null) {
            messageSeq = seq;
        }
        Long numericId = resolveNumericMessageIdIfPresent(cache, stableMessageId, messageSeq);
        if (numericId == null) {
            return null;
        }

        SessionMessage message = new SessionMessage();
        if (stableMessageId != null && !stableMessageId.trim().isEmpty()) {
            message.setId(stableMessageId.trim());
        } else {
            message.setId(String.valueOf(numericId));
        }
        message.setWelinkSessionId(welinkSessionId);
        message.setSeq(seq);
        message.setRole(defaultString(getString(item, "role"), "assistant"));
        message.setMessageSeq(messageSeq);
        message.setContentType(getString(item, "contentType"));
        message.setMeta(getObject(item, "meta"));

        String content = getString(item, "content");
        message.setContent(content == null ? "" : content);
        String createdAt = getString(item, "createdAt");
        message.setCreatedAt(createdAt == null || createdAt.isEmpty() ? Instant.now().toString() : createdAt);

        JsonArray parts = getArray(item, "parts");
        if (parts != null) {
            for (JsonElement partItem : parts) {
                if (partItem == null || !partItem.isJsonObject()) {
                    continue;
                }
                SessionMessagePart parsedPart = parsePartFromJson(partItem.getAsJsonObject());
                if (parsedPart != null) {
                    ensureParts(message).add(parsedPart);
                }
            }
        }

        if ((message.getContent() == null || message.getContent().isEmpty()) && !ensureParts(message).isEmpty()) {
            recalculateContent(message);
        }
        return message;
    }

    @Nullable
    private SessionMessagePart parsePartFromJson(@NonNull JsonObject json) {
        SessionMessagePart part = new SessionMessagePart();
        part.setPartId(getString(json, "partId"));
        part.setPartSeq(getInteger(json, "partSeq"));
        part.setType(getString(json, "type"));
        part.setContent(getString(json, "content"));
        part.setToolName(getString(json, "toolName"));
        part.setToolCallId(getString(json, "toolCallId"));

        String status = getString(json, "status");
        if (status == null || status.isEmpty()) {
            status = getString(json, "toolStatus");
        }
        part.setStatus(status);

        JsonElement input = getElement(json, "input");
        if (input == null || input.isJsonNull()) {
            input = getElement(json, "toolInput");
        }
        part.setInput(input);

        String output = getString(json, "output");
        if (output == null || output.isEmpty()) {
            output = getString(json, "toolOutput");
        }
        part.setOutput(output);

        part.setError(getString(json, "error"));
        part.setTitle(getString(json, "title"));
        part.setQuestion(getString(json, "question"));
        part.setHeader(getString(json, "header"));
        part.setOptions(getStringList(json, "options"));
        part.setPermissionId(getString(json, "permissionId"));
        part.setPermType(getString(json, "permType"));
        part.setMetadata(getObject(json, "metadata"));
        part.setResponse(getString(json, "response"));
        part.setFileName(getString(json, "fileName"));
        part.setFileUrl(getString(json, "fileUrl"));
        part.setFileMime(getString(json, "fileMime"));
        return part;
    }

    private void mergePart(@NonNull SessionMessage message, @NonNull Map<String, SessionMessagePart> currentPartsById,
            @NonNull Map<Integer, SessionMessagePart> currentPartsBySeq, @NonNull SessionMessagePart incoming) {
        SessionMessagePart target = resolveMergeTarget(message, currentPartsById, currentPartsBySeq, incoming);
        mergePartFields(target, incoming);

        String partId = normalizeMessageId(target.getPartId());
        if (!partId.isEmpty()) {
            currentPartsById.put(partId, target);
            if (target.getPartId() == null || !partId.equals(target.getPartId())) {
                target.setPartId(partId);
            }
        }
        Integer partSeq = target.getPartSeq();
        if (partSeq != null) {
            currentPartsBySeq.put(partSeq, target);
        }
    }

    @NonNull
    private SessionMessagePart resolveMergeTarget(@NonNull SessionMessage message,
            @NonNull Map<String, SessionMessagePart> currentPartsById,
            @NonNull Map<Integer, SessionMessagePart> currentPartsBySeq, @NonNull SessionMessagePart incoming) {
        String incomingPartId = normalizeMessageId(incoming.getPartId());
        if (!incomingPartId.isEmpty()) {
            SessionMessagePart byId = currentPartsById.get(incomingPartId);
            if (byId != null) {
                return byId;
            }
        }

        Integer incomingPartSeq = incoming.getPartSeq();
        SessionMessagePart bySeq = incomingPartSeq == null ? null : currentPartsBySeq.get(incomingPartSeq);
        if (bySeq != null) {
            return bySeq;
        }

        SessionMessagePart created = new SessionMessagePart();
        ensureParts(message).add(created);
        return created;
    }

    private void mergePartFields(@NonNull SessionMessagePart target, @NonNull SessionMessagePart incoming) {
        target.setPartId(mergeNullableValue(target.getPartId(), incoming.getPartId()));
        target.setPartSeq(mergeNullableValue(target.getPartSeq(), incoming.getPartSeq()));
        target.setType(mergeNullableValue(target.getType(), incoming.getType()));
        target.setContent(mergeNullableValue(target.getContent(), incoming.getContent()));
        target.setToolName(mergeNullableValue(target.getToolName(), incoming.getToolName()));
        target.setToolCallId(mergeNullableValue(target.getToolCallId(), incoming.getToolCallId()));
        target.setStatus(mergeNullableValue(target.getStatus(), incoming.getStatus()));
        target.setInput(mergeNonNullJson(target.getInput(), incoming.getInput()));
        target.setOutput(mergeNullableValue(target.getOutput(), incoming.getOutput()));
        target.setError(mergeNullableValue(target.getError(), incoming.getError()));
        target.setTitle(mergeNullableValue(target.getTitle(), incoming.getTitle()));
        target.setQuestion(mergeNullableValue(target.getQuestion(), incoming.getQuestion()));
        target.setHeader(mergeNullableValue(target.getHeader(), incoming.getHeader()));
        target.setOptions(mergeNonEmptyList(target.getOptions(), incoming.getOptions()));
        target.setPermissionId(mergeNullableValue(target.getPermissionId(), incoming.getPermissionId()));
        target.setPermType(mergeNullableValue(target.getPermType(), incoming.getPermType()));
        target.setMetadata(mergeNullableValue(target.getMetadata(), incoming.getMetadata()));
        target.setResponse(mergeNullableValue(target.getResponse(), incoming.getResponse()));
        target.setFileName(mergeNullableValue(target.getFileName(), incoming.getFileName()));
        target.setFileUrl(mergeNullableValue(target.getFileUrl(), incoming.getFileUrl()));
        target.setFileMime(mergeNullableValue(target.getFileMime(), incoming.getFileMime()));
    }

    @Nullable
    private static <T> T mergeNullableValue(@Nullable T current, @Nullable T incoming) {
        return incoming != null ? incoming : current;
    }

    @Nullable
    private static JsonElement mergeNonNullJson(@Nullable JsonElement current, @Nullable JsonElement incoming) {
        if (incoming == null || incoming.isJsonNull()) {
            return current;
        }
        return incoming;
    }

    @Nullable
    private static List<String> mergeNonEmptyList(@Nullable List<String> current, @Nullable List<String> incoming) {
        if (incoming == null || incoming.isEmpty()) {
            return current;
        }
        return incoming;
    }

    @Nullable
    private Long resolveNumericMessageIdIfPresent(@NonNull SessionCache cache, @Nullable String messageId,
            @Nullable Integer messageSeq) {
        if ((messageId == null || messageId.trim().isEmpty()) && messageSeq == null) {
            return null;
        }
        return resolveNumericMessageId(cache, messageId, messageSeq);
    }

    @NonNull
    private String resolvedContent(@NonNull SessionMessage message) {
        if (message.getContent() != null && !message.getContent().isEmpty()) {
            return message.getContent();
        }
        StringBuilder builder = new StringBuilder();
        List<SessionMessagePart> parts = new ArrayList<>(ensureParts(message));
        parts.sort(PART_COMPARATOR);
        for (SessionMessagePart part : parts) {
            if (part.getContent() != null) {
                builder.append(part.getContent());
            }
        }
        return builder.toString();
    }

    @NonNull
    private SessionMessage cloneMessage(@NonNull SessionMessage source) {
        SessionMessage cloned = gson.fromJson(gson.toJson(source), SessionMessage.class);
        return cloned == null ? source : cloned;
    }

    @Nullable
    private static Long parseLong(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(normalized);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    @NonNull
    private static String inferPartType(@Nullable String eventType) {
        if (eventType == null) {
            return "text";
        }
        if (eventType.startsWith("text")) {
            return "text";
        }
        if (eventType.startsWith("thinking")) {
            return "thinking";
        }
        if (MessageType.TOOL_UPDATE.equals(eventType)) {
            return "tool";
        }
        if (MessageType.QUESTION.equals(eventType)) {
            return "question";
        }
        if (MessageType.PERMISSION_ASK.equals(eventType) || MessageType.PERMISSION_REPLY.equals(eventType)) {
            return "permission";
        }
        if (MessageType.FILE.equals(eventType)) {
            return "file";
        }
        return "text";
    }

    @NonNull
    private static String defaultString(@Nullable String current, @NonNull String fallback) {
        if (current == null || current.isEmpty()) {
            return fallback;
        }
        return current;
    }

    @Nullable
    private static JsonElement getElement(@NonNull JsonObject object, @NonNull String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return null;
        }
        return object.get(key);
    }

    @Nullable
    private static JsonArray getArray(@NonNull JsonObject object, @NonNull String key) {
        JsonElement value = getElement(object, key);
        if (value == null || !value.isJsonArray()) {
            return null;
        }
        return value.getAsJsonArray();
    }

    @Nullable
    private static JsonObject getObject(@NonNull JsonObject object, @NonNull String key) {
        JsonElement value = getElement(object, key);
        if (value == null || !value.isJsonObject()) {
            return null;
        }
        return value.getAsJsonObject();
    }

    @Nullable
    private static Integer getInteger(@NonNull JsonObject object, @NonNull String key) {
        JsonElement value = getElement(object, key);
        if (value == null || !value.isJsonPrimitive()) {
            return null;
        }
        try {
            return value.getAsInt();
        } catch (Exception ignored) {
            return null;
        }
    }

    @Nullable
    private static String getString(@NonNull JsonObject object, @NonNull String key) {
        JsonElement value = getElement(object, key);
        if (value == null || !value.isJsonPrimitive()) {
            return null;
        }
        try {
            return value.getAsString();
        } catch (Exception ignored) {
            return null;
        }
    }

    @NonNull
    private static List<String> getStringList(@NonNull JsonObject object, @NonNull String key) {
        JsonArray value = getArray(object, key);
        if (value == null) {
            return new ArrayList<>();
        }
        List<String> result = new ArrayList<>();
        for (JsonElement item : value) {
            if (item == null || !item.isJsonPrimitive()) {
                continue;
            }
            result.add(item.getAsString());
        }
        return result;
    }

    private static int compareNullableInt(@Nullable Integer left, @Nullable Integer right) {
        if (left != null && right != null) {
            return Integer.compare(left, right);
        }
        if (left != null) {
            return -1;
        }
        if (right != null) {
            return 1;
        }
        return 0;
    }

    private static int compareCompletedMessageIds(@NonNull SessionCache cache, long leftId, long rightId) {
        if (leftId == rightId) {
            return 0;
        }
        CachedMessage left = cache.byNumericId.get(leftId);
        CachedMessage right = cache.byNumericId.get(rightId);
        if (left == null && right == null) {
            return Long.compare(leftId, rightId);
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        int cmp = MESSAGE_COMPARATOR.compare(left.message, right.message);
        if (cmp != 0) {
            return cmp;
        }
        return Long.compare(leftId, rightId);
    }

    @NonNull
    private static List<SessionMessagePart> ensureParts(@NonNull SessionMessage message) {
        List<SessionMessagePart> parts = message.getParts();
        if (parts != null) {
            return parts;
        }
        List<SessionMessagePart> created = new ArrayList<>();
        message.setParts(created);
        return created;
    }

    private static final class MessageIdentityIndex {
        @NonNull
        private final Set<String> messageIds = new HashSet<>();
        @NonNull
        private final Set<Integer> messageSeqs = new HashSet<>();

        private void add(@NonNull SessionMessage message) {
            String messageId = normalizeMessageId(message.getId());
            if (!messageId.isEmpty()) {
                messageIds.add(messageId);
            }
            Integer messageSeq = message.getMessageSeq();
            if (messageSeq != null) {
                messageSeqs.add(messageSeq);
            }
        }

        private boolean contains(@NonNull SessionMessage message) {
            String messageId = normalizeMessageId(message.getId());
            if (!messageId.isEmpty() && messageIds.contains(messageId)) {
                return true;
            }
            Integer messageSeq = message.getMessageSeq();
            return messageSeq != null && messageSeqs.contains(messageSeq);
        }
    }

    private static final class SessionCache {
        private final Map<Long, CachedMessage> byNumericId = new HashMap<>();
        private final Map<String, Long> stableToNumericId = new HashMap<>();
        private final AtomicLong syntheticIdGenerator = new AtomicLong(-1);
        private final NavigableSet<Long> completedMessageIds =
                new TreeSet<>((leftId, rightId) -> compareCompletedMessageIds(this, leftId, rightId));
    }

    private static final class CachedMessage {
        private SessionMessage message = new SessionMessage();
        private boolean completed;
        private long updatedAt;
        private final Map<String, SessionMessagePart> partsById = new HashMap<>();
        private final Map<Integer, SessionMessagePart> partsBySeq = new HashMap<>();
        private boolean partIndexReady;
    }
}
