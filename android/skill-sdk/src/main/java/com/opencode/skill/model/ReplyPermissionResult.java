package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class ReplyPermissionResult {
    @NonNull
    private final String welinkSessionId;
    @NonNull
    private final String permissionId;
    @NonNull
    private final String response;

    public ReplyPermissionResult(@NonNull String welinkSessionId, @NonNull String permissionId, @NonNull String response) {
        this.welinkSessionId = welinkSessionId;
        this.permissionId = permissionId;
        this.response = response;
    }

    @NonNull
    public String getWelinkSessionId() {
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
