package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class GetSessionMessageParams {
    @NonNull
    private final String welinkSessionId;
    private final int page;
    private final int size;
    private final boolean isFirst;

    public GetSessionMessageParams(@NonNull String welinkSessionId) {
        this(welinkSessionId, 0, 50, false);
    }

    public GetSessionMessageParams(@NonNull String welinkSessionId, int page, int size) {
        this(welinkSessionId, page, size, false);
    }

    public GetSessionMessageParams(@NonNull String welinkSessionId, int page, int size, boolean isFirst) {
        this.welinkSessionId = welinkSessionId;
        this.page = page;
        this.size = size;
        this.isFirst = isFirst;
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

    public boolean isFirst() {
        return isFirst;
    }
}
