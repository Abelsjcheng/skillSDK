package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;

public class CreateSessionRequest {
    @SerializedName("userId")
    private Long userId;

    @SerializedName("skillDefinitionId")
    private Long skillDefinitionId;

    @SerializedName("agentId")
    private Long agentId;

    @SerializedName("title")
    private String title;

    @SerializedName("imChatId")
    private String imChatId;

    public CreateSessionRequest(Long userId, Long skillDefinitionId, Long agentId, String title, String imChatId) {
        this.userId = userId;
        this.skillDefinitionId = skillDefinitionId;
        this.agentId = agentId;
        this.title = title;
        this.imChatId = imChatId;
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getImChatId() {
        return imChatId;
    }

    public void setImChatId(String imChatId) {
        this.imChatId = imChatId;
    }
}