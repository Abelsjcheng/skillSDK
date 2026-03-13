package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;

@Keep
public class PageResult<T> {
    @NonNull
    private List<T> content = new ArrayList<>();
    private int number;
    private int size;
    private long totalElements;

    @NonNull
    public List<T> getContent() {
        return content;
    }

    public void setContent(@NonNull List<T> content) {
        this.content = content;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    @Deprecated
    public int getPage() {
        return number;
    }

    @Deprecated
    public void setPage(int page) {
        this.number = page;
    }

    @Deprecated
    public long getTotal() {
        return totalElements;
    }

    @Deprecated
    public void setTotal(long total) {
        this.totalElements = total;
    }
}
