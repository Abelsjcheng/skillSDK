package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class ReplyPermissionParams {
    @NonNull
    private final String welinkSessionId;
    @NonNull
    private final String permId;
    @NonNull
    private final String response;
    @Nullable
    private final String subagentSessionId;

    public ReplyPermissionParams(@NonNull String welinkSessionId, @NonNull String permId, @NonNull String response) {
        this(welinkSessionId, permId, response, null);
    }

    public ReplyPermissionParams(
            @NonNull String welinkSessionId,
            @NonNull String permId,
            @NonNull String response,
            @Nullable String subagentSessionId
    ) {
        this.welinkSessionId = welinkSessionId;
        this.permId = permId;
        this.response = response;
        this.subagentSessionId = subagentSessionId;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    @NonNull
    public String getPermId() {
        return permId;
    }

    @NonNull
    public String getResponse() {
        return response;
    }

    @Nullable
    public String getSubagentSessionId() {
        return subagentSessionId;
    }
}
