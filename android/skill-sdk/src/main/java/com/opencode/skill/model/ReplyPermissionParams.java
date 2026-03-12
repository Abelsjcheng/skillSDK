package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class ReplyPermissionParams {
    private final long welinkSessionId;
    @NonNull
    private final String permId;
    @NonNull
    private final String response;

    public ReplyPermissionParams(long welinkSessionId, @NonNull String permId, @NonNull String response) {
        this.welinkSessionId = welinkSessionId;
        this.permId = permId;
        this.response = response;
    }

    public long getWelinkSessionId() {
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
}
