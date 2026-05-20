package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.JsonObject;

@Keep
public final class ReplyPermissionBody {
    @NonNull
    private final String response;
    @Nullable
    private final String subagentSessionId;
    @Nullable
    private final JsonObject businessExtParam;

    public ReplyPermissionBody(@NonNull String response) {
        this(response, null, null);
    }

    public ReplyPermissionBody(@NonNull String response, @Nullable String subagentSessionId) {
        this(response, subagentSessionId, null);
    }

    public ReplyPermissionBody(
            @NonNull String response,
            @Nullable String subagentSessionId,
            @Nullable JsonObject businessExtParam
    ) {
        this.response = response;
        this.subagentSessionId = subagentSessionId;
        this.businessExtParam = businessExtParam;
    }

    @NonNull
    public String getResponse() {
        return response;
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
