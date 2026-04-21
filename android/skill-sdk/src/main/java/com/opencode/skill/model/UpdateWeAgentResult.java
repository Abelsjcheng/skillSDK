package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class UpdateWeAgentResult {
    @NonNull
    private final String updateResult;

    public UpdateWeAgentResult(@NonNull String updateResult) {
        this.updateResult = updateResult;
    }

    @NonNull
    public String getUpdateResult() {
        return updateResult;
    }
}
