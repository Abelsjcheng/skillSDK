package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class GetSessionMessageParams {
    private final long welinkSessionId;
    private final int page;
    private final int size;

    public GetSessionMessageParams(long welinkSessionId) {
        this(welinkSessionId, 0, 50);
    }

    public GetSessionMessageParams(long welinkSessionId, int page, int size) {
        this.welinkSessionId = welinkSessionId;
        this.page = page;
        this.size = size;
    }

    public long getWelinkSessionId() {
        return welinkSessionId;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
