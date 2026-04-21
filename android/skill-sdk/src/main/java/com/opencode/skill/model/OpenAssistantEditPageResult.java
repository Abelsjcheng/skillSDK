package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class OpenAssistantEditPageResult {
    @NonNull
    private final String status;

    public OpenAssistantEditPageResult(@NonNull String status) {
        this.status = status;
    }

    @NonNull
    public String getStatus() {
        return status;
    }
}
