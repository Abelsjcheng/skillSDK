package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;

public class ChatMessage {
    @SerializedName("id")
    private Long id;

    @SerializedName("sessionId")
    private Long sessionId;

    @SerializedName("seq")
    private Integer seq;

    @SerializedName("role")
    private String role;

    @SerializedName("content")
    private String content;

    @SerializedName("contentType")
    private String contentType;

    @SerializedName("createdAt")
    private String createdAt;

    @SerializedName("meta")
    private String meta;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSessionId() {
        return sessionId;
    }

    public void setSessionId(Long sessionId) {
        this.sessionId = sessionId;
    }

    public Integer getSeq() {
        return seq;
    }

    public void setSeq(Integer seq) {
        this.seq = seq;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getMeta() {
        return meta;
    }

    public void setMeta(String meta) {
        this.meta = meta;
    }
}