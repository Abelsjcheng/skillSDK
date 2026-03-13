package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class SendMessageParams {
    @NonNull
    private final String welinkSessionId;
    @NonNull
    private final String content;
    @Nullable
    private final String toolCallId;

    public SendMessageParams(@NonNull String welinkSessionId, @NonNull String content, @Nullable String toolCallId) {
        this.welinkSessionId = welinkSessionId;
        this.content = content;
        this.toolCallId = toolCallId;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    @NonNull
    public String getContent() {
        return content;
    }

    @Nullable
    public String getToolCallId() {
        return toolCallId;
    }
}
