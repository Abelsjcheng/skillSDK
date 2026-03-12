package com.opencode.skill.constant;

import androidx.annotation.NonNull;

public enum SkillWeCodeAction {
    CLOSE("close"),
    MINIMIZE("minimize");

    private final String value;

    SkillWeCodeAction(String value) {
        this.value = value;
    }

    @NonNull
    public String getValue() {
        return value;
    }

    @NonNull
    public static SkillWeCodeAction fromValue(@NonNull String value) {
        for (SkillWeCodeAction action : values()) {
            if (action.value.equalsIgnoreCase(value)) {
                return action;
            }
        }
        throw new IllegalArgumentException("Unknown SkillWeCodeAction: " + value);
    }
}
