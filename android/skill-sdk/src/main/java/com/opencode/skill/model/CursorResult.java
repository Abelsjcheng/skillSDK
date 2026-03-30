package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

@Keep
public class CursorResult<T> {
    @NonNull
    private List<T> content = new ArrayList<>();
    private int size;
    private boolean hasMore;
    @Nullable
    private Integer nextBeforeSeq;

    @NonNull
    public List<T> getContent() {
        return new ArrayList<>(content);
    }

    public void setContent(@NonNull List<T> content) {
        this.content = new ArrayList<>(content);
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }

    @Nullable
    public Integer getNextBeforeSeq() {
        return nextBeforeSeq;
    }

    public void setNextBeforeSeq(@Nullable Integer nextBeforeSeq) {
        this.nextBeforeSeq = nextBeforeSeq;
    }
}
