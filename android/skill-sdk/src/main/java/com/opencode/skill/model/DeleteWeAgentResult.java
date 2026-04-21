package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class DeleteWeAgentResult {
    @NonNull
    private final String deleteResult;

    public DeleteWeAgentResult(@NonNull String deleteResult) {
        this.deleteResult = deleteResult;
    }

    @NonNull
    public String getDeleteResult() {
        return deleteResult;
    }
}
