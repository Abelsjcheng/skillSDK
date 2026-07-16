package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class OnSessionViewingEndResult {
    @NonNull private final String status;

    public OnSessionViewingEndResult(@NonNull String status) {
        this.status = status;
    }

    @NonNull public String getStatus() {
        return status;
    }
}
