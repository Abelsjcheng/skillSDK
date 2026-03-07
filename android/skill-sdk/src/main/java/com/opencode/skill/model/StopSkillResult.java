package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 停止技能结果
 * Result of stopping a skill session.
 */
public class StopSkillResult {
    
    @NonNull
    private final String status;

    public StopSkillResult(@NonNull String status) {
        this.status = status;
    }

    @NonNull
    public String getStatus() {
        return status;
    }

    public boolean isSuccess() {
        return "success".equalsIgnoreCase(status);
    }

    @NonNull
    @Override
    public String toString() {
        return "StopSkillResult{" +
                "status='" + status + '\'' +
                '}';
    }
}