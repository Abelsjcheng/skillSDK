package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class RegenerateAnswerParams {
    @NonNull
    private final String welinkSessionId;

    public RegenerateAnswerParams(@NonNull String welinkSessionId) {
        this.welinkSessionId = welinkSessionId;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }
}
