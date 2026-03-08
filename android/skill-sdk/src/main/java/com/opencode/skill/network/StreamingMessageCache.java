package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
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

  private static final Comparator<SessionMessage> MESSAGE_COMPARATOR = Comparator
      .comparingInt(SessionMessage::getMessageSeq)
      .thenComparing(SessionMessage::getCreatedAt)
      .thenComparingLong(SessionMessage::getId);

  @NonNull
  private final Gson gson = new Gson();
  @NonNull
  private final Map<Long, SessionCache> sessionCaches = new ConcurrentHashMap<>();

  public void ingestServerMessages(long welinkSessionId, @NonNull List<SessionMessage> messages) {
    SessionCache cache = sessionCache(welinkSessionId);
    synchronized (cache) {
      for (SessionMessage message : messages) {
        CachedMessage cached = cache.byNumericId.computeIfAbsent(message.getId(), k -> new CachedMessage());
        cached.message = cloneMessage(message);
        cached.message.setWelinkSessionId(welinkSessionId);
        cached.completed = true;
        cached.updatedAt = System.currentTimeMillis();
      }
    }
  }

  public void recordUserMessage(@NonNull SendMessageResult message) {
    SessionCache cache = sessionCache(message.getWelinkSessionId());
    synchronized (cache) {
      CachedMessage cached = cache.byNumericId.computeIfAbsent(message.getId(), k -> new CachedMessage());
      SessionMessage sessionMessage = cached.message;
      sessionMessage.setId(message.getId());
      sessionMessage.setWelinkSessionId(message.getWelinkSessionId());
      sessionMessage.setUserId(message.getUserId());
      sessionMessage.setRole(message.getRole());
      sessionMessage.setContent(message.getContent());
      sessionMessage.setMessageSeq(message.getMessageSeq());
      sessionMessage.setCreatedAt(message.getCreatedAt());
      cached.completed = true;
      cached.updatedAt = System.currentTimeMillis();
    }
  }

  @Nullable
  public String findLastUserMessageContent(long welinkSessionId) {
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
    Long sessionId = parseLong(event.getWelinkSessionId());
    if (sessionId == null) {
      return;
    }
    SessionCache cache = sessionCache(sessionId);
    synchronized (cache) {
      String type = event.getType();
      if (MessageType.SNAPSHOT.equals(type)) {
        mergeSnapshot(cache, sessionId, event.getMessages());
        return;
      }
      if (MessageType.STREAMING.equals(type)) {
        mergeStreaming(cache, sessionId, event);
        return;
      }

      CachedMessage cached = getOrCreateCachedMessage(cache, sessionId, event);
      applyEventToMessage(cached, event);
    }
  }

  @NonNull
  public PageResult<SessionMessage> mergeWithLocalCache(long welinkSessionId, int page, int size,
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
    result.setPage(Math.max(page, 0));
    result.setSize(safeSize);
    result.setTotal(merged.size());
    result.setContent(pageContent);
    return result;
  }

  @Nullable
  public String getCompletedMessageContent(long welinkSessionId, @Nullable Long messageId) {
    SessionCache cache = sessionCaches.get(welinkSessionId);
    if (cache == null) {
      return null;
    }
    synchronized (cache) {
      if (messageId != null) {
        CachedMessage found = cache.byNumericId.get(messageId);
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

  public boolean hasMessage(long welinkSessionId, long messageId) {
    SessionCache cache = sessionCaches.get(welinkSessionId);
    if (cache == null) {
      return false;
    }
    synchronized (cache) {
      return cache.byNumericId.containsKey(messageId);
    }
  }

  public boolean isMessageCompleted(long welinkSessionId, long messageId) {
    SessionCache cache = sessionCaches.get(welinkSessionId);
    if (cache == null) {
      return false;
    }
    synchronized (cache) {
      CachedMessage message = cache.byNumericId.get(messageId);
      return message != null && message.completed;
    }
  }

  public void clearSession(long welinkSessionId) {
    sessionCaches.remove(welinkSessionId);
  }

  public void clearAll() {
    sessionCaches.clear();
  }

  @NonNull
  private SessionCache sessionCache(long sessionId) {
    return sessionCaches.computeIfAbsent(sessionId, key -> new SessionCache());
  }

  @NonNull
  private CachedMessage getOrCreateCachedMessage(@NonNull SessionCache cache, long welinkSessionId,
      @NonNull StreamMessage event) {
    long numericId = resolveNumericMessageId(cache, event.getMessageId(), event.getMessageSeq());
    CachedMessage cached = cache.byNumericId.computeIfAbsent(numericId, key -> new CachedMessage());
    SessionMessage message = cached.message;
    message.setId(numericId);
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

  private long resolveNumericMessageId(@NonNull SessionCache cache, @Nullable String messageId, @Nullable Integer messageSeq) {
    if (messageId != null && !messageId.isEmpty()) {
      Long parsed = parseLong(messageId);
      if (parsed != null) {
        return parsed;
      }
      Long existing = cache.stableToNumericId.get(messageId);
      if (existing != null) {
        return existing;
      }
      long synthetic = cache.syntheticIdGenerator.getAndDecrement();
      cache.stableToNumericId.put(messageId, synthetic);
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
      case MessageType.SESSION_STATUS:
        if ("idle".equalsIgnoreCase(event.getSessionStatus())) {
          cached.completed = true;
        }
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
      target.setToolStatus(event.getStatus());
    }
    if (event.getInput() != null) {
      target.setToolInput(event.getInput());
    }
    if (event.getOutput() != null) {
      target.setToolOutput(event.getOutput());
    }
    if (event.getQuestion() != null) {
      target.setQuestion(event.getQuestion());
    }
    if (event.getOptions() != null && !event.getOptions().isEmpty()) {
      target.setOptions(event.getOptions());
    }
    if (event.getPermissionId() != null) {
      target.setPermissionId(event.getPermissionId());
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
    for (SessionMessagePart existing : message.getParts()) {
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
    message.getParts().add(created);
    return created;
  }

  private void recalculateContent(@NonNull SessionMessage message) {
    message.getParts().sort(PART_COMPARATOR);
    StringBuilder builder = new StringBuilder();
    for (SessionMessagePart part : message.getParts()) {
      if (part.getContent() != null) {
        builder.append(part.getContent());
      }
    }
    if (builder.length() > 0) {
      message.setContent(builder.toString());
    }
  }

  private void mergeSnapshot(@NonNull SessionCache cache, long welinkSessionId, @Nullable JsonArray snapshotMessages) {
    if (snapshotMessages == null) {
      return;
    }
    for (JsonElement item : snapshotMessages) {
      if (item == null || !item.isJsonObject()) {
        continue;
      }
      SessionMessage message = gson.fromJson(item, SessionMessage.class);
      if (message == null) {
        continue;
      }
      if (message.getCreatedAt().isEmpty()) {
        message.setCreatedAt(Instant.now().toString());
      }
      message.setWelinkSessionId(welinkSessionId);
      CachedMessage cached = cache.byNumericId.computeIfAbsent(message.getId(), k -> new CachedMessage());
      cached.message = cloneMessage(message);
      cached.completed = true;
      cached.updatedAt = System.currentTimeMillis();
    }
  }

  private void mergeStreaming(@NonNull SessionCache cache, long welinkSessionId, @NonNull StreamMessage event) {
    CachedMessage cached = getOrCreateCachedMessage(cache, welinkSessionId, event);
    SessionMessage message = cached.message;
    JsonArray parts = event.getParts();
    if (parts != null) {
      Map<String, SessionMessagePart> currentParts = new HashMap<>();
      for (SessionMessagePart part : message.getParts()) {
        if (part.getPartId() != null) {
          currentParts.put(part.getPartId(), part);
        }
      }
      for (JsonElement partJson : parts) {
        if (partJson == null || !partJson.isJsonObject()) {
          continue;
        }
        SessionMessagePart incoming = gson.fromJson(partJson, SessionMessagePart.class);
        if (incoming == null) {
          continue;
        }
        if (incoming.getPartId() != null && currentParts.containsKey(incoming.getPartId())) {
          SessionMessagePart existing = currentParts.get(incoming.getPartId());
          if (incoming.getContent() != null) {
            existing.setContent(incoming.getContent());
          }
          if (incoming.getType() != null) {
            existing.setType(incoming.getType());
          }
          if (incoming.getToolStatus() != null) {
            existing.setToolStatus(incoming.getToolStatus());
          }
        } else {
          message.getParts().add(incoming);
        }
      }
    }
    recalculateContent(message);
    cached.completed = "idle".equalsIgnoreCase(event.getSessionStatus());
    cached.updatedAt = System.currentTimeMillis();
  }

  @NonNull
  private String resolvedContent(@NonNull SessionMessage message) {
    if (message.getContent() != null && !message.getContent().isEmpty()) {
      return message.getContent();
    }
    StringBuilder builder = new StringBuilder();
    List<SessionMessagePart> parts = new ArrayList<>(message.getParts());
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
    if (value == null || value.isEmpty()) {
      return null;
    }
    try {
      return Long.parseLong(value);
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
