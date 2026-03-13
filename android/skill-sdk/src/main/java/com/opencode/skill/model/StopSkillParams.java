package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class StopSkillParams {
    @NonNull
    private final String welinkSessionId;

    public StopSkillParams(@NonNull String welinkSessionId) {
        this.welinkSessionId = welinkSessionId;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }
}
