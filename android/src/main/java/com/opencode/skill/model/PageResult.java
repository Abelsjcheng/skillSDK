package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class PageResult<T> {
    @SerializedName("content")
    private List<T> content;

    @SerializedName("totalElements")
    private Long totalElements;

    @SerializedName("totalPages")
    private Integer totalPages;

    @SerializedName("number")
    private Integer number;

    @SerializedName("size")
    private Integer size;

    public List<T> getContent() {
        return content;
    }

    public void setContent(List<T> content) {
        this.content = content;
    }

    public Long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(Long totalElements) {
        this.totalElements = totalElements;
    }

    public Integer getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(Integer totalPages) {
        this.totalPages = totalPages;
    }

    public Integer getNumber() {
        return number;
    }

    public void setNumber(Integer number) {
        this.number = number;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }
}