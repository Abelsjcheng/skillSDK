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
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

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
            applyEventToMessage(cached, event);
        }
    }

    @NonNull
    public PageResult<SessionMessage> mergeWithLocalCache(@NonNull String welinkSessionId, int page, int size,
            @NonNull PageResult<SessionMessage> serverPage) {
        ingestServerMessages(welinkSessionId, serverPage.getContent());

        SessionCache cache = sessionCache(welinkSessionId);
        List<SessionMessage> merged = new ArrayList<>();
        synchronized (cache) {
            for (CachedMessage item : cache.byNumericId.values()) {
                merged.add(cloneMessage(item.message));
            }
        }
        merged.sort(MESSAGE_COMPARATOR);

        int safeSize = Math.max(size, 1);
        int from = Math.max(page, 0) * safeSize;
        int to = Math.min(from + safeSize, merged.size());
        List<SessionMessage> pageContent = from >= merged.size() ? new ArrayList<>() : new ArrayList<>(merged.subList(from, to));

        PageResult<SessionMessage> result = new PageResult<>();
        result.setNumber(Math.max(page, 0));
        result.setSize(safeSize);
        result.setTotalElements(merged.size());
        result.setContent(pageContent);
        return result;
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

            CachedMessage latest = null;
            for (CachedMessage current : cache.byNumericId.values()) {
                if (!current.completed) {
                    continue;
                }
                if (latest == null || MESSAGE_COMPARATOR.compare(current.message, latest.message) > 0) {
                    latest = current;
                }
            }
            return latest == null ? null : resolvedContent(latest.message);
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
        CachedMessage latest = null;
        for (CachedMessage candidate : cache.byNumericId.values()) {
            if (latest == null || MESSAGE_COMPARATOR.compare(candidate.message, latest.message) > 0) {
                latest = candidate;
            }
        }
        if (latest == null) {
            return;
        }
        latest.completed = completed;
        latest.updatedAt = System.currentTimeMillis();
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

    private void applyEventToMessage(@NonNull CachedMessage cached, @NonNull StreamMessage event) {
        String type = event.getType();
        if (type == null) {
            return;
        }
        SessionMessage message = cached.message;

        switch (type) {
            case MessageType.TEXT_DELTA:
            case MessageType.THINKING_DELTA:
                updatePart(message, event, true);
                cached.completed = false;
                break;
            case MessageType.TEXT_DONE:
            case MessageType.THINKING_DONE:
                updatePart(message, event, false);
                cached.completed = true;
                break;
            case MessageType.TOOL_UPDATE:
            case MessageType.QUESTION:
            case MessageType.PERMISSION_ASK:
            case MessageType.PERMISSION_REPLY:
            case MessageType.FILE:
                updatePart(message, event, false);
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
    }

    private void updatePart(@NonNull SessionMessage message, @NonNull StreamMessage event, boolean appendContent) {
        SessionMessagePart target = findOrCreatePart(message, event);
        target.setType(defaultString(target.getType(), inferPartType(event.getType())));

        if (event.getContent() != null) {
            if (appendContent && target.getContent() != null) {
                target.setContent(target.getContent() + event.getContent());
            } else {
                target.setContent(event.getContent());
            }
        }

        if (event.getToolName() != null) {
            target.setToolName(event.getToolName());
        }
        if (event.getToolCallId() != null) {
            target.setToolCallId(event.getToolCallId());
        }
        if (event.getStatus() != null) {
            target.setStatus(event.getStatus());
        }
        if (event.getInput() != null) {
            target.setInput(event.getInput());
        }
        if (event.getOutput() != null) {
            target.setOutput(event.getOutput());
        }
        if (event.getError() != null) {
            target.setError(event.getError());
        }
        if (event.getTitle() != null) {
            target.setTitle(event.getTitle());
        }
        if (event.getQuestion() != null) {
            target.setQuestion(event.getQuestion());
        }
        if (event.getHeader() != null) {
            target.setHeader(event.getHeader());
        }
        if (event.getOptions() != null && !event.getOptions().isEmpty()) {
            target.setOptions(event.getOptions());
        }
        if (event.getPermissionId() != null) {
            target.setPermissionId(event.getPermissionId());
        }
        if (event.getPermType() != null) {
            target.setPermType(event.getPermType());
        }
        if (event.getMetadata() != null) {
            target.setMetadata(event.getMetadata());
        }
        if (event.getResponse() != null) {
            target.setResponse(event.getResponse());
        }
        if (event.getFileName() != null) {
            target.setFileName(event.getFileName());
        }
        if (event.getFileUrl() != null) {
            target.setFileUrl(event.getFileUrl());
        }
        if (event.getFileMime() != null) {
            target.setFileMime(event.getFileMime());
        }
    }

    @NonNull
    private SessionMessagePart findOrCreatePart(@NonNull SessionMessage message, @NonNull StreamMessage event) {
        String incomingPartId = event.getPartId();
        Integer incomingPartSeq = event.getPartSeq();
        for (SessionMessagePart existing : ensureParts(message)) {
            if (incomingPartId != null && incomingPartId.equals(existing.getPartId())) {
                return existing;
            }
            if (incomingPartId == null && incomingPartSeq != null && incomingPartSeq.equals(existing.getPartSeq())) {
                return existing;
            }
        }

        SessionMessagePart created = new SessionMessagePart();
        created.setPartId(incomingPartId);
        created.setPartSeq(incomingPartSeq);
        ensureParts(message).add(created);
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
            Map<String, SessionMessagePart> currentParts = new HashMap<>();
            for (SessionMessagePart part : ensureParts(message)) {
                if (part.getPartId() != null) {
                    currentParts.put(part.getPartId(), part);
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
                mergePart(message, currentParts, incoming);
            }
        }
        recalculateContent(message);
        cached.completed = "idle".equalsIgnoreCase(event.getSessionStatus());
        cached.updatedAt = System.currentTimeMillis();
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

    private void mergePart(@NonNull SessionMessage message, @NonNull Map<String, SessionMessagePart> currentParts,
            @NonNull SessionMessagePart incoming) {
        SessionMessagePart target = null;
        String incomingPartId = incoming.getPartId();
        if (incomingPartId != null && !incomingPartId.isEmpty()) {
            target = currentParts.get(incomingPartId);
        }
        if (target == null && incoming.getPartSeq() != null) {
            for (SessionMessagePart existing : ensureParts(message)) {
                if (incoming.getPartSeq().equals(existing.getPartSeq())) {
                    target = existing;
                    break;
                }
            }
        }
        if (target == null) {
            target = new SessionMessagePart();
            ensureParts(message).add(target);
        }

        if (incoming.getPartId() != null) {
            target.setPartId(incoming.getPartId());
        }
        if (incoming.getPartSeq() != null) {
            target.setPartSeq(incoming.getPartSeq());
        }
        if (incoming.getType() != null) {
            target.setType(incoming.getType());
        }
        if (incoming.getContent() != null) {
            target.setContent(incoming.getContent());
        }
        if (incoming.getToolName() != null) {
            target.setToolName(incoming.getToolName());
        }
        if (incoming.getToolCallId() != null) {
            target.setToolCallId(incoming.getToolCallId());
        }
        if (incoming.getStatus() != null) {
            target.setStatus(incoming.getStatus());
        }
        if (incoming.getInput() != null && !incoming.getInput().isJsonNull()) {
            target.setInput(incoming.getInput());
        }
        if (incoming.getOutput() != null) {
            target.setOutput(incoming.getOutput());
        }
        if (incoming.getError() != null) {
            target.setError(incoming.getError());
        }
        if (incoming.getTitle() != null) {
            target.setTitle(incoming.getTitle());
        }
        if (incoming.getQuestion() != null) {
            target.setQuestion(incoming.getQuestion());
        }
        if (incoming.getHeader() != null) {
            target.setHeader(incoming.getHeader());
        }
        if (incoming.getOptions() != null && !incoming.getOptions().isEmpty()) {
            target.setOptions(incoming.getOptions());
        }
        if (incoming.getPermissionId() != null) {
            target.setPermissionId(incoming.getPermissionId());
        }
        if (incoming.getPermType() != null) {
            target.setPermType(incoming.getPermType());
        }
        if (incoming.getMetadata() != null) {
            target.setMetadata(incoming.getMetadata());
        }
        if (incoming.getResponse() != null) {
            target.setResponse(incoming.getResponse());
        }
        if (incoming.getFileName() != null) {
            target.setFileName(incoming.getFileName());
        }
        if (incoming.getFileUrl() != null) {
            target.setFileUrl(incoming.getFileUrl());
        }
        if (incoming.getFileMime() != null) {
            target.setFileMime(incoming.getFileMime());
        }

        if (target.getPartId() != null && !target.getPartId().isEmpty()) {
            currentParts.put(target.getPartId(), target);
        }
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

    private static final class SessionCache {
        private final Map<Long, CachedMessage> byNumericId = new HashMap<>();
        private final Map<String, Long> stableToNumericId = new HashMap<>();
        private final AtomicLong syntheticIdGenerator = new AtomicLong(-1);
    }

    private static final class CachedMessage {
        private SessionMessage message = new SessionMessage();
        private boolean completed;
        private long updatedAt;
    }
}
