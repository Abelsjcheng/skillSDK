package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public final class CreateSessionBody {
    @Nullable
    private final String ak;
    @Nullable
    private final String title;
    @Nullable
    private final String imGroupId;

    public CreateSessionBody(@Nullable String ak, @Nullable String title, @Nullable String imGroupId) {
        this.ak = ak;
        this.title = title;
        this.imGroupId = imGroupId;
    }

    @Nullable
    public String getAk() {
        return ak;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    @Nullable
    public String getImGroupId() {
        return imGroupId;
    }
}
