package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class SendMessageResult {
    private long id;
    private long welinkSessionId;
    @NonNull
    private String userId = "";
    @NonNull
    private String role = "user";
    @NonNull
    private String content = "";
    private int messageSeq;
    @NonNull
    private String createdAt = "";

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public long getWelinkSessionId() {
        return welinkSessionId;
    }

    public void setWelinkSessionId(long welinkSessionId) {
        this.welinkSessionId = welinkSessionId;
    }

    @NonNull
    public String getUserId() {
        return userId;
    }

    public void setUserId(@NonNull String userId) {
        this.userId = userId;
    }

    @NonNull
    public String getRole() {
        return role;
    }

    public void setRole(@NonNull String role) {
        this.role = role;
    }

    @NonNull
    public String getContent() {
        return content;
    }

    public void setContent(@NonNull String content) {
        this.content = content;
    }

    public int getMessageSeq() {
        return messageSeq;
    }

    public void setMessageSeq(int messageSeq) {
        this.messageSeq = messageSeq;
    }

    @NonNull
    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(@NonNull String createdAt) {
        this.createdAt = createdAt;
    }
}
