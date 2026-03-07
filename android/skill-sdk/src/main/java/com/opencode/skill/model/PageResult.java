package com.opencode.skill.model;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 分页结果模型
 * Represents a paginated result from the server.
 *
 * @param <T> the type of items in the result
 */
public class PageResult<T> {
    
    @NonNull
    private List<T> content;
    private long totalElements;
    private int totalPages;
    private int number;
    private int size;

    public PageResult() {
        this.content = new ArrayList<>();
    }

    // Getters
    @NonNull
    public List<T> getContent() {
        return content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public int getNumber() {
        return number;
    }

    public int getSize() {
        return size;
    }

    // Setters
    public void setContent(@NonNull List<T> content) {
        this.content = content;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public void setSize(int size) {
        this.size = size;
    }

    /**
     * Check if there is a next page
     */
    public boolean hasNext() {
        return number < totalPages - 1;
    }

    /**
     * Check if there is a previous page
     */
    public boolean hasPrevious() {
        return number > 0;
    }

    /**
     * Check if the result is empty
     */
    public boolean isEmpty() {
        return content.isEmpty();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PageResult<?> that = (PageResult<?>) o;
        return totalElements == that.totalElements &&
                totalPages == that.totalPages &&
                number == that.number &&
                size == that.size &&
                content.equals(that.content);
    }

    @Override
    public int hashCode() {
        return Objects.hash(content, totalElements, totalPages, number, size);
    }

    @NonNull
    @Override
    public String toString() {
        return "PageResult{" +
                "content=" + content +
                ", totalElements=" + totalElements +
                ", totalPages=" + totalPages +
                ", number=" + number +
                ", size=" + size +
                '}';
    }
}