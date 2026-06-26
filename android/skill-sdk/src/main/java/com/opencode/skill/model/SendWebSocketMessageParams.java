package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class SendWebSocketMessageParams {
    @NonNull
    private final String message;

    public SendWebSocketMessageParams(@NonNull String message) {
        this.message = message;
    }

    @NonNull
    public String getMessage() {
        return message;
    }
}
