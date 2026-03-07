package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 关闭技能结果
 * Result of closing a skill session.
 */
public class CloseSkillResult {
    
    @NonNull
    private final String status;

    public CloseSkillResult(@NonNull String status) {
        this.status = status;
    }

    @NonNull
    public String getStatus() {
        return status;
    }

    public boolean isSuccess() {
        return "success".equalsIgnoreCase(status) || "closed".equalsIgnoreCase(status);
    }

    @NonNull
    @Override
    public String toString() {
        return "CloseSkillResult{" +
                "status='" + status + '\'' +
                '}';
    }
}