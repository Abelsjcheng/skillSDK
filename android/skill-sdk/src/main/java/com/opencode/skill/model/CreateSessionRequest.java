package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 创建会话请求体
 * Request body for creating a session.
 */
public class CreateSessionRequest {
    
    private final long userId;
    private final long skillDefinitionId;
    private Long agentId;
    private String title;
    private String imChatId;

    public CreateSessionRequest(long userId, long skillDefinitionId) {
        this.userId = userId;
        this.skillDefinitionId = skillDefinitionId;
    }

    // Getters
    public long getUserId() {
        return userId;
    }

    public long getSkillDefinitionId() {
        return skillDefinitionId;
    }

    public Long getAgentId() {
        return agentId;
    }

    public String getTitle() {
        return title;
    }

    public String getImChatId() {
        return imChatId;
    }

    // Setters
    public CreateSessionRequest agentId(Long agentId) {
        this.agentId = agentId;
        return this;
    }

    public CreateSessionRequest title(String title) {
        this.title = title;
        return this;
    }

    public CreateSessionRequest imChatId(String imChatId) {
        this.imChatId = imChatId;
        return this;
    }
}