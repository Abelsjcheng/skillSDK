package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * 执行技能参数
 * Parameters for executing a skill.
 */
public class ExecuteSkillParams {
    
    @NonNull
    private final String imChatId;
    private final long skillDefinitionId;
    @NonNull
    private final String userId;
    @Nullable
    private final Long agentId;
    @Nullable
    private final String title;
    @NonNull
    private final String skillContent;

    private ExecuteSkillParams(@NonNull Builder builder) {
        this.imChatId = builder.imChatId;
        this.skillDefinitionId = builder.skillDefinitionId;
        this.userId = builder.userId;
        this.agentId = builder.agentId;
        this.title = builder.title;
        this.skillContent = builder.skillContent;
    }

    // Getters
    @NonNull
    public String getImChatId() {
        return imChatId;
    }

    public long getSkillDefinitionId() {
        return skillDefinitionId;
    }

    @NonNull
    public String getUserId() {
        return userId;
    }

    @Nullable
    public Long getAgentId() {
        return agentId;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    @NonNull
    public String getSkillContent() {
        return skillContent;
    }

    public static class Builder {
        private String imChatId;
        private long skillDefinitionId;
        private String userId;
        private Long agentId;
        private String title;
        private String skillContent;

        public Builder imChatId(@NonNull String imChatId) {
            this.imChatId = imChatId;
            return this;
        }

        public Builder skillDefinitionId(long skillDefinitionId) {
            this.skillDefinitionId = skillDefinitionId;
            return this;
        }

        public Builder userId(@NonNull String userId) {
            this.userId = userId;
            return this;
        }

        public Builder agentId(@Nullable Long agentId) {
            this.agentId = agentId;
            return this;
        }

        public Builder title(@Nullable String title) {
            this.title = title;
            return this;
        }

        public Builder skillContent(@NonNull String skillContent) {
            this.skillContent = skillContent;
            return this;
        }

        public ExecuteSkillParams build() {
            if (imChatId == null || imChatId.isEmpty()) {
                throw new IllegalArgumentException("imChatId is required");
            }
            if (userId == null || userId.isEmpty()) {
                throw new IllegalArgumentException("userId is required");
            }
            if (skillContent == null || skillContent.isEmpty()) {
                throw new IllegalArgumentException("skillContent is required");
            }
            return new ExecuteSkillParams(this);
        }
    }

    @NonNull
    @Override
    public String toString() {
        return "ExecuteSkillParams{" +
                "imChatId='" + imChatId + '\'' +
                ", skillDefinitionId=" + skillDefinitionId +
                ", userId='" + userId + '\'' +
                ", agentId=" + agentId +
                ", title='" + title + '\'' +
                ", skillContent='" + skillContent + '\'' +
                '}';
    }
}