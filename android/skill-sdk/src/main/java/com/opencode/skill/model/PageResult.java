package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

@Keep
public class PageResult<T> {
    @NonNull
    private List<T> content = new ArrayList<>();
    @SerializedName(value = "page", alternate = {"number"})
    private int page;
    private int size;
    @SerializedName(value = "total", alternate = {"totalElements"})
    private long total;
    private int totalPages;

    @NonNull
    public List<T> getContent() {
        return content;
    }

    public void setContent(@NonNull List<T> content) {
        this.content = content;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = Math.max(totalPages, 0);
    }

    @Deprecated
    public int getNumber() {
        return page;
    }

    @Deprecated
    public void setNumber(int number) {
        this.page = number;
    }

    @Deprecated
    public long getTotalElements() {
        return total;
    }

    @Deprecated
    public void setTotalElements(long totalElements) {
        this.total = totalElements;
    }
}
