package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class CreateSessionParams {
    @NonNull
    private final String ak;
    @Nullable
    private final String title;
    @NonNull
    private final String imGroupId;

    public CreateSessionParams(@NonNull String ak, @Nullable String title, @NonNull String imGroupId) {
        this.ak = ak;
        this.title = title;
        this.imGroupId = imGroupId;
    }

    @NonNull
    public String getAk() {
        return ak;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    @NonNull
    public String getImGroupId() {
        return imGroupId;
    }
}
