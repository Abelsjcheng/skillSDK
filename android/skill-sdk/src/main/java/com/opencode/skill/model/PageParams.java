package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class PageParams {
    private final int pageSize;
    private final int pageNumber;

    public PageParams(int pageSize, int pageNumber) {
        this.pageSize = pageSize;
        this.pageNumber = pageNumber;
    }

    public int getPageSize() {
        return pageSize;
    }

    public int getPageNumber() {
        return pageNumber;
    }
}
