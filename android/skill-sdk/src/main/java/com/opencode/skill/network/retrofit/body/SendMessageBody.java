package com.opencode.skill.network.retrofit.body;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public final class SendMessageBody {
    @NonNull
    private final String content;
    @Nullable
    private final String toolCallId;

    public SendMessageBody(@NonNull String content, @Nullable String toolCallId) {
        this.content = content;
        this.toolCallId = toolCallId;
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
