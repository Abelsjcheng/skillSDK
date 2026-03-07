package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * 发送消息结果
 * Result of sending a message.
 */
public class SendMessageResult {
    
    private final long messageId;
    private final int seq;
    @NonNull
    private final String createdAt;

    public SendMessageResult(long messageId, int seq, @NonNull String createdAt) {
        this.messageId = messageId;
        this.seq = seq;
        this.createdAt = createdAt;
    }

    public long getMessageId() {
        return messageId;
    }

    public int getSeq() {
        return seq;
    }

    @NonNull
    public String getCreatedAt() {
        return createdAt;
    }

    @NonNull
    @Override
    public String toString() {
        return "SendMessageResult{" +
                "messageId=" + messageId +
                ", seq=" + seq +
                ", createdAt='" + createdAt + '\'' +
                '}';
    }
}