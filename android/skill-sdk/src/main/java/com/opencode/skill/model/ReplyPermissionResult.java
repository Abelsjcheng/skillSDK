package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class ReplyPermissionResult {
    private final long welinkSessionId;
    @NonNull
    private final String permissionId;
    @NonNull
    private final String response;

    public ReplyPermissionResult(long welinkSessionId, @NonNull String permissionId, @NonNull String response) {
        this.welinkSessionId = welinkSessionId;
        this.permissionId = permissionId;
        this.response = response;
    }

    public long getWelinkSessionId() {
        return welinkSessionId;
    }

    @NonNull
    public String getPermissionId() {
        return permissionId;
    }

    @NonNull
    public String getResponse() {
        return response;
    }
}
