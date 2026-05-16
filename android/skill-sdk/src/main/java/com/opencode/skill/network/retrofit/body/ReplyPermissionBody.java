package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class ReplyPermissionBody {
    @NonNull
    private final String response;
    @Nullable
    private final String subagentSessionId;

    public ReplyPermissionBody(@NonNull String response) {
        this(response, null);
    }

    public ReplyPermissionBody(@NonNull String response, @Nullable String subagentSessionId) {
        this.response = response;
        this.subagentSessionId = subagentSessionId;
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
