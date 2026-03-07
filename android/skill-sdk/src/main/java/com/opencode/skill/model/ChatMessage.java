package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Objects;

/**
 * 聊天消息模型
 * Represents a message in a skill session.
 */
public class ChatMessage {
    
    private long id;
    private long sessionId;
    private int seq;
    @NonNull
    private String role;
    @NonNull
    private String content;
    @NonNull
    private String contentType;
    @NonNull
    private String createdAt;
    @Nullable
    private String meta;

    public ChatMessage() {
        this.role = "USER";
        this.contentType = "MARKDOWN";
    }

    // Getters
    public long getId() {
        return id;
    }

    public long getSessionId() {
        return sessionId;
    }

    public int getSeq() {
        return seq;
    }

    @NonNull
    public String getRole() {
        return role;
    }

    @NonNull
    public String getContent() {
        return content;
    }

    @NonNull
    public String getContentType() {
        return contentType;
    }

    @NonNull
    public String getCreatedAt() {
        return createdAt;
    }

    @Nullable
    public String getMeta() {
        return meta;
    }

    // Setters
    public void setId(long id) {
        this.id = id;
    }

    public void setSessionId(long sessionId) {
        this.sessionId = sessionId;
    }

    public void setSeq(int seq) {
        this.seq = seq;
    }

    public void setRole(@NonNull String role) {
        this.role = role;
    }

    public void setContent(@NonNull String content) {
        this.content = content;
    }

    public void setContentType(@NonNull String contentType) {
        this.contentType = contentType;
    }

    public void setCreatedAt(@NonNull String createdAt) {
        this.createdAt = createdAt;
    }

    public void setMeta(@Nullable String meta) {
        this.meta = meta;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChatMessage that = (ChatMessage) o;
        return id == that.id &&
                sessionId == that.sessionId &&
                seq == that.seq &&
                role.equals(that.role) &&
                content.equals(that.content) &&
                contentType.equals(that.contentType) &&
                createdAt.equals(that.createdAt) &&
                Objects.equals(meta, that.meta);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, sessionId, seq, role, content, contentType, createdAt, meta);
    }

    @NonNull
    @Override
    public String toString() {
        return "ChatMessage{" +
                "id=" + id +
                ", sessionId=" + sessionId +
                ", seq=" + seq +
                ", role='" + role + '\'' +
                ", content='" + content + '\'' +
                ", contentType='" + contentType + '\'' +
                ", createdAt='" + createdAt + '\'' +
                ", meta='" + meta + '\'' +
                '}';
    }
}