package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.constant.MessageType;
import com.opencode.skill.model.ChatMessage;
import com.opencode.skill.model.StreamMessage;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 流式消息缓存
 * 用于缓存 WebSocket 接收的增量消息，支持与历史消息合并
 */
public class StreamingMessageCache {

    private final Map<String, CachedStreamMessage> cache = new ConcurrentHashMap<>();

    public void updateCache(@NonNull String sessionId, @NonNull StreamMessage message) {
        String type = message.getType();
        
        if (MessageType.DELTA.equals(type)) {
            CachedStreamMessage cached = cache.computeIfAbsent(sessionId, k -> new CachedStreamMessage(sessionId));
            cached.appendContent(message.getContentAsString());
            cached.setStreaming(true);
        } else if (MessageType.DONE.equals(type)) {
            CachedStreamMessage cached = cache.get(sessionId);
            if (cached != null) {
                cached.setStreaming(false);
            }
        } else if (MessageType.ERROR.equals(type)) {
            CachedStreamMessage cached = cache.get(sessionId);
            if (cached != null) {
                cached.setStreaming(false);
                cached.setErrorMessage(message.getContentAsString());
            }
        }
    }

    @Nullable
    public ChatMessage getStreamingMessage(@NonNull String sessionId) {
        CachedStreamMessage cached = cache.get(sessionId);
        if (cached != null && cached.getContent() != null && !cached.getContent().isEmpty()) {
            ChatMessage message = new ChatMessage();
            message.setId(-1); // Temporary ID for streaming message
            message.setSessionId(Long.parseLong(sessionId));
            message.setRole("ASSISTANT");
            message.setContent(cached.getContent());
            message.setContentType("MARKDOWN");
            message.setCreatedAt(cached.getStartTime());
            message.setMeta(cached.isStreaming() ? "{\"isStreaming\":true}" : null);
            return message;
        }
        return null;
    }

    public boolean isStreaming(@NonNull String sessionId) {
        CachedStreamMessage cached = cache.get(sessionId);
        return cached != null && cached.isStreaming();
    }

    public void clearCache(@NonNull String sessionId) {
        cache.remove(sessionId);
    }

    public void clearAll() {
        cache.clear();
    }

    private static class CachedStreamMessage {
        private final String sessionId;
        private final StringBuilder content = new StringBuilder();
        private final String startTime;
        private volatile boolean isStreaming = false;
        private String errorMessage;
        private final AtomicLong lastSeq = new AtomicLong(0);

        CachedStreamMessage(String sessionId) {
            this.sessionId = sessionId;
            this.startTime = java.time.Instant.now().toString();
        }

        void appendContent(@Nullable String newContent) {
            if (newContent != null) {
                content.append(newContent);
            }
        }

        String getContent() {
            return content.toString();
        }

        String getStartTime() {
            return startTime;
        }

        boolean isStreaming() {
            return isStreaming;
        }

        void setStreaming(boolean streaming) {
            isStreaming = streaming;
        }

        String getErrorMessage() {
            return errorMessage;
        }

        void setErrorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
        }

        long getLastSeq() {
            return lastSeq.get();
        }

        void setLastSeq(long seq) {
            lastSeq.set(seq);
        }
    }
}