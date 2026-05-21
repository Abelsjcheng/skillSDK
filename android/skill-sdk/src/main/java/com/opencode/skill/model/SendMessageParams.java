package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.JsonObject;

@Keep
public class SendMessageParams {
    @NonNull
    private final String welinkSessionId;
    @NonNull
    private final String content;
    @Nullable
    private final String toolCallId;
    @Nullable
    private final String questionId;
    @Nullable
    private final String subagentSessionId;
    @Nullable
    private final JsonObject businessExtParam;

    public SendMessageParams(@NonNull String welinkSessionId, @NonNull String content, @Nullable String toolCallId) {
        this(welinkSessionId, content, toolCallId, null, null, null);
    }

    public SendMessageParams(
            @NonNull String welinkSessionId,
            @NonNull String content,
            @Nullable String toolCallId,
            @Nullable String subagentSessionId
    ) {
        this(welinkSessionId, content, toolCallId, null, subagentSessionId, null);
    }

    public SendMessageParams(
            @NonNull String welinkSessionId,
            @NonNull String content,
            @Nullable String toolCallId,
            @Nullable String questionId,
            @Nullable String subagentSessionId,
            @Nullable JsonObject businessExtParam
    ) {
        this.welinkSessionId = welinkSessionId;
        this.content = content;
        this.toolCallId = toolCallId;
        this.questionId = questionId;
        this.subagentSessionId = subagentSessionId;
        this.businessExtParam = businessExtParam;
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
    public String getQuestionId() {
        return questionId;
    }

    @Nullable
    public String getSubagentSessionId() {
        return subagentSessionId;
    }

    @Nullable
    public JsonObject getBusinessExtParam() {
        return businessExtParam;
    }
}
