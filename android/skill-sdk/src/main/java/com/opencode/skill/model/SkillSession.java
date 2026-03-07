package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Objects;

/**
 * 技能会话模型
 * Represents a skill session with the server.
 */
public class SkillSession {
    
    private long id;
    private long userId;
    private long skillDefinitionId;
    @Nullable
    private Long agentId;
    @Nullable
    private String toolSessionId;
    @Nullable
    private String title;
    @NonNull
    private String status;
    @Nullable
    private String imChatId;
    @NonNull
    private String createdAt;
    @NonNull
    private String lastActiveAt;

    public SkillSession() {
        this.status = "ACTIVE";
    }

    // Getters
    public long getId() {
        return id;
    }

    public long getUserId() {
        return userId;
    }

    public long getSkillDefinitionId() {
        return skillDefinitionId;
    }

    @Nullable
    public Long getAgentId() {
        return agentId;
    }

    @Nullable
    public String getToolSessionId() {
        return toolSessionId;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    @NonNull
    public String getStatus() {
        return status;
    }

    @Nullable
    public String getImChatId() {
        return imChatId;
    }

    @NonNull
    public String getCreatedAt() {
        return createdAt;
    }

    @NonNull
    public String getLastActiveAt() {
        return lastActiveAt;
    }

    // Setters
    public void setId(long id) {
        this.id = id;
    }

    public void setUserId(long userId) {
        this.userId = userId;
    }

    public void setSkillDefinitionId(long skillDefinitionId) {
        this.skillDefinitionId = skillDefinitionId;
    }

    public void setAgentId(@Nullable Long agentId) {
        this.agentId = agentId;
    }

    public void setToolSessionId(@Nullable String toolSessionId) {
        this.toolSessionId = toolSessionId;
    }

    public void setTitle(@Nullable String title) {
        this.title = title;
    }

    public void setStatus(@NonNull String status) {
        this.status = status;
    }

    public void setImChatId(@Nullable String imChatId) {
        this.imChatId = imChatId;
    }

    public void setCreatedAt(@NonNull String createdAt) {
        this.createdAt = createdAt;
    }

    public void setLastActiveAt(@NonNull String lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SkillSession that = (SkillSession) o;
        return id == that.id &&
                userId == that.userId &&
                skillDefinitionId == that.skillDefinitionId &&
                Objects.equals(agentId, that.agentId) &&
                Objects.equals(toolSessionId, that.toolSessionId) &&
                Objects.equals(title, that.title) &&
                status.equals(that.status) &&
                Objects.equals(imChatId, that.imChatId) &&
                createdAt.equals(that.createdAt) &&
                lastActiveAt.equals(that.lastActiveAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, userId, skillDefinitionId, agentId, toolSessionId, title, status, imChatId, createdAt, lastActiveAt);
    }

    @NonNull
    @Override
    public String toString() {
        return "SkillSession{" +
                "id=" + id +
                ", userId=" + userId +
                ", skillDefinitionId=" + skillDefinitionId +
                ", agentId=" + agentId +
                ", toolSessionId='" + toolSessionId + '\'' +
                ", title='" + title + '\'' +
                ", status='" + status + '\'' +
                ", imChatId='" + imChatId + '\'' +
                ", createdAt='" + createdAt + '\'' +
                ", lastActiveAt='" + lastActiveAt + '\'' +
                '}';
    }
}