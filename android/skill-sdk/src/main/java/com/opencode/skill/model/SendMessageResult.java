package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.JsonObject;

import java.util.List;

@Keep
public class SendMessageResult {
    @NonNull
    private String id = "";
    @NonNull
    private String welinkSessionId = "";
    @Nullable
    private Integer seq;
    @Nullable
    private Integer messageSeq;
    @NonNull
    private String role = "user";
    @Nullable
    private String content;
    @Nullable
    private String contentType;
    @Nullable
    private JsonObject meta;
    @Nullable
    private List<SessionMessagePart> parts;
    @NonNull
    private String createdAt = "";

    @NonNull
    public String getId() {
        return id;
    }

    public void setId(@NonNull String id) {
        this.id = id == null ? "" : id;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    public void setWelinkSessionId(@NonNull String welinkSessionId) {
        this.welinkSessionId = welinkSessionId == null ? "" : welinkSessionId;
    }

    @Nullable
    public Integer getSeq() {
        return seq;
    }

    public void setSeq(@Nullable Integer seq) {
        this.seq = seq;
    }

    @Nullable
    public Integer getMessageSeq() {
        return messageSeq;
    }

    public void setMessageSeq(@Nullable Integer messageSeq) {
        this.messageSeq = messageSeq;
    }

    @NonNull
    public String getRole() {
        return role;
    }

    public void setRole(@NonNull String role) {
        this.role = role == null ? "" : role;
    }

    @Nullable
    public String getContent() {
        return content;
    }

    public void setContent(@Nullable String content) {
        this.content = content;
    }

    @Nullable
    public String getContentType() {
        return contentType;
    }

    public void setContentType(@Nullable String contentType) {
        this.contentType = contentType;
    }

    @Nullable
    public JsonObject getMeta() {
        return meta;
    }

    public void setMeta(@Nullable JsonObject meta) {
        this.meta = meta;
    }

    @Nullable
    public List<SessionMessagePart> getParts() {
        return parts;
    }

    public void setParts(@Nullable List<SessionMessagePart> parts) {
        this.parts = parts;
    }

    @NonNull
    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(@NonNull String createdAt) {
        this.createdAt = createdAt == null ? "" : createdAt;
    }
}
