package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class StopSkillParams {
    private final long welinkSessionId;

    public StopSkillParams(long welinkSessionId) {
        this.welinkSessionId = welinkSessionId;
    }

    public long getWelinkSessionId() {
        return welinkSessionId;
    }
}
