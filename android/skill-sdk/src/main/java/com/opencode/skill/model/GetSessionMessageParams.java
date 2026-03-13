package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class GetSessionMessageParams {
    @NonNull
    private final String welinkSessionId;
    private final int page;
    private final int size;

    public GetSessionMessageParams(@NonNull String welinkSessionId) {
        this(welinkSessionId, 0, 50);
    }

    public GetSessionMessageParams(@NonNull String welinkSessionId, int page, int size) {
        this.welinkSessionId = welinkSessionId;
        this.page = page;
        this.size = size;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
