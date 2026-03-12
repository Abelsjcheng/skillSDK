package com.opencode.skill.constant;

import androidx.annotation.NonNull;

public enum SkillWecodeStatus {
    CLOSED("closed"),
    MINIMIZED("minimized");

    private final String value;

    SkillWecodeStatus(String value) {
        this.value = value;
    }

    @NonNull
    public String getValue() {
        return value;
    }

    @NonNull
    public static SkillWecodeStatus fromValue(@NonNull String value) {
        for (SkillWecodeStatus status : values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown SkillWecodeStatus: " + value);
    }
}
