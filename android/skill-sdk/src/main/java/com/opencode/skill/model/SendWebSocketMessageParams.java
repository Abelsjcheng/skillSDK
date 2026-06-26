package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.google.gson.JsonObject;

@Keep
public class SendWebSocketMessageParams {
    @NonNull
    private final JsonObject message;

    public SendWebSocketMessageParams(@NonNull JsonObject message) {
        this.message = message;
    }

    @NonNull
    public JsonObject getMessage() {
        return message;
    }
}
