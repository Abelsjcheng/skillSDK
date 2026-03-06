package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;

public class SkillSession {
    @SerializedName("id")
    private Long id;

    @SerializedName("userId")
    private Long userId;

    @SerializedName("skillDefinitionId")
    private Long skillDefinitionId;

    @SerializedName("agentId")
    private Long agentId;

    @SerializedName("toolSessionId")
    private String toolSessionId;

    @SerializedName("title")
    private String title;

    @SerializedName("status")
    private String status;

    @SerializedName("imChatId")
    private String imChatId;

    @SerializedName("createdAt")
    private String createdAt;

    @SerializedName("lastActiveAt")
    private String lastActiveAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getSkillDefinitionId() {
        return skillDefinitionId;
    }

    public void setSkillDefinitionId(Long skillDefinitionId) {
        this.skillDefinitionId = skillDefinitionId;
    }

    public Long getAgentId() {
        return agentId;
    }

    public void setAgentId(Long agentId) {
        this.agentId = agentId;
    }

    public String getToolSessionId() {
        return toolSessionId;
    }

    public void setToolSessionId(String toolSessionId) {
        this.toolSessionId = toolSessionId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getImChatId() {
        return imChatId;
    }

    public void setImChatId(String imChatId) {
        this.imChatId = imChatId;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getLastActiveAt() {
        return lastActiveAt;
    }

    public void setLastActiveAt(String lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }
}