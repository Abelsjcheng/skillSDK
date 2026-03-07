package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Objects;

/**
 * 流式消息模型
 * Represents a streaming message received via WebSocket.
 */
public class StreamMessage {
    
    @NonNull
    private String sessionId;
    @NonNull
    private String type;
    private long seq;
    @Nullable
    private Object content;
    @Nullable
    private Usage usage;

    public StreamMessage() {
    }

    // Getters
    @NonNull
    public String getSessionId() {
        return sessionId;
    }

    @NonNull
    public String getType() {
        return type;
    }

    public long getSeq() {
        return seq;
    }

    @Nullable
    public Object getContent() {
        return content;
    }

    @Nullable
    public Usage getUsage() {
        return usage;
    }

    // Setters
    public void setSessionId(@NonNull String sessionId) {
        this.sessionId = sessionId;
    }

    public void setType(@NonNull String type) {
        this.type = type;
    }

    public void setSeq(long seq) {
        this.seq = seq;
    }

    public void setContent(@Nullable Object content) {
        this.content = content;
    }

    public void setUsage(@Nullable Usage usage) {
        this.usage = usage;
    }

    /**
     * Get content as string
     */
    @Nullable
    public String getContentAsString() {
        if (content == null) {
            return null;
        }
        if (content instanceof String) {
            return (String) content;
        }
        return content.toString();
    }

    /**
     * Token usage statistics
     */
    public static class Usage {
        private long inputTokens;
        private long outputTokens;

        public Usage() {
        }

        public long getInputTokens() {
            return inputTokens;
        }

        public void setInputTokens(long inputTokens) {
            this.inputTokens = inputTokens;
        }

        public long getOutputTokens() {
            return outputTokens;
        }

        public void setOutputTokens(long outputTokens) {
            this.outputTokens = outputTokens;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        StreamMessage that = (StreamMessage) o;
        return seq == that.seq &&
                sessionId.equals(that.sessionId) &&
                type.equals(that.type) &&
                Objects.equals(content, that.content) &&
                Objects.equals(usage, that.usage);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sessionId, type, seq, content, usage);
    }

    @NonNull
    @Override
    public String toString() {
        return "StreamMessage{" +
                "sessionId='" + sessionId + '\'' +
                ", type='" + type + '\'' +
                ", seq=" + seq +
                ", content=" + content +
                ", usage=" + usage +
                '}';
    }
}