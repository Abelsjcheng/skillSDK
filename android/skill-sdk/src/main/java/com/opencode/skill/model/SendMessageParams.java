package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class SendMessageParams {
    private final long welinkSessionId;
    @NonNull
    private final String content;
    @Nullable
    private final String toolCallId;

    public SendMessageParams(long welinkSessionId, @NonNull String content, @Nullable String toolCallId) {
        this.welinkSessionId = welinkSessionId;
        this.content = content;
        this.toolCallId = toolCallId;
    }

    public long getWelinkSessionId() {
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
