package com.opencode.skill.constant;

import androidx.annotation.NonNull;

/**
 * 会话状态枚举
 */
public enum SessionStatus {
    EXECUTING("executing"),
    STOPPED("stopped"),
    COMPLETED("completed");

    private final String value;

    SessionStatus(String value) {
        this.value = value;
    }

    @NonNull
    public String getValue() {
        return value;
    }

    @NonNull
    public static SessionStatus fromValue(@NonNull String value) {
        for (SessionStatus status : values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown SessionStatus: " + value);
    }
}