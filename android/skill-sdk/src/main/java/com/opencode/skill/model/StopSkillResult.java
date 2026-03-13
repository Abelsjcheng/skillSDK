package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class StopSkillResult {
    @NonNull
    private final String welinkSessionId;
    @NonNull
    private final String status;

    public StopSkillResult(@NonNull String welinkSessionId, @NonNull String status) {
        this.welinkSessionId = welinkSessionId;
        this.status = status;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    @NonNull
    public String getStatus() {
        return status;
    }
}
