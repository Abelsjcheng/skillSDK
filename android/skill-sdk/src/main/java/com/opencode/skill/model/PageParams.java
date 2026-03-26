package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class PageParams {
    @Nullable
    private final Object pageSize;
    @Nullable
    private final Object pageNumber;

    public PageParams(@Nullable Object pageSize, @Nullable Object pageNumber) {
        this.pageSize = pageSize;
        this.pageNumber = pageNumber;
    }

    @Nullable
    public Object getPageSize() {
        return pageSize;
    }

    @Nullable
    public Object getPageNumber() {
        return pageNumber;
    }
}
