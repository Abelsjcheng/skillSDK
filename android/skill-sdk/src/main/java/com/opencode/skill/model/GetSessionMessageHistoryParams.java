package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class GetSessionMessageHistoryParams {
    @NonNull
    private final Object welinkSessionId;
    @Nullable
    private final Object beforeSeq;
    @Nullable
    private final Object size;

    public GetSessionMessageHistoryParams(@NonNull String welinkSessionId) {
        this(welinkSessionId, null, 50);
    }

    public GetSessionMessageHistoryParams(@NonNull String welinkSessionId, @Nullable Integer beforeSeq) {
        this(welinkSessionId, beforeSeq, 50);
    }

    public GetSessionMessageHistoryParams(@NonNull String welinkSessionId, @Nullable Integer beforeSeq, int size) {
        this((Object) welinkSessionId, beforeSeq, size);
    }

    public GetSessionMessageHistoryParams(
            @NonNull Object welinkSessionId,
            @Nullable Object beforeSeq,
            @Nullable Object size
    ) {
        this.welinkSessionId = welinkSessionId;
        this.beforeSeq = beforeSeq;
        this.size = size;
    }

    @NonNull
    public Object getWelinkSessionId() {
        return welinkSessionId;
    }

    @Nullable
    public Object getBeforeSeq() {
        return beforeSeq;
    }

    @Nullable
    public Object getSize() {
        return size;
    }
}
