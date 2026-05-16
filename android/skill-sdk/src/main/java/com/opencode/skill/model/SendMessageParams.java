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
    @Nullable
    private final String subagentSessionId;

    public SendMessageParams(@NonNull String welinkSessionId, @NonNull String content, @Nullable String toolCallId) {
        this(welinkSessionId, content, toolCallId, null);
    }

    public SendMessageParams(
            @NonNull String welinkSessionId,
            @NonNull String content,
            @Nullable String toolCallId,
            @Nullable String subagentSessionId
    ) {
        this.welinkSessionId = welinkSessionId;
        this.content = content;
        this.toolCallId = toolCallId;
        this.subagentSessionId = subagentSessionId;
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

    @Nullable
    public String getSubagentSessionId() {
        return subagentSessionId;
    }
}
