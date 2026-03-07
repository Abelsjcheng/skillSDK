package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 小程序控制结果
 * Result of controlling the skill mini-app.
 */
public class ControlSkillWeCodeResult {
    
    @NonNull
    private final String status;

    public ControlSkillWeCodeResult(@NonNull String status) {
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
        return "ControlSkillWeCodeResult{" +
                "status='" + status + '\'' +
                '}';
    }
}