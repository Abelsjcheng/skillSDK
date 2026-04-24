package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public final class ReplyPermissionBody {
    @NonNull
    private final String response;

    public ReplyPermissionBody(@NonNull String response) {
        this.response = response;
    }

    @NonNull
    public String getResponse() {
        return response;
    }
}
