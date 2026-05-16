package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class SendMessageBody {
    @NonNull
    private final String content;
    @Nullable
    private final String toolCallId;
    @Nullable
    private final String subagentSessionId;

    public SendMessageBody(@NonNull String content, @Nullable String toolCallId) {
        this(content, toolCallId, null);
    }

    public SendMessageBody(
            @NonNull String content,
            @Nullable String toolCallId,
            @Nullable String subagentSessionId
    ) {
        this.content = content;
        this.toolCallId = toolCallId;
        this.subagentSessionId = subagentSessionId;
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
