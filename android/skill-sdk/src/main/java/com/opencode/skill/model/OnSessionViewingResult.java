package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class OnSessionViewingResult {
    @NonNull private final String status;

    public OnSessionViewingResult(@NonNull String status) {
        this.status = status;
    }

    @NonNull public String getStatus() {
        return status;
    }
}
