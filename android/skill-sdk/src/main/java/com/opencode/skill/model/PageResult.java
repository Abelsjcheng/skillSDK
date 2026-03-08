package com.opencode.skill.model;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;

public class PageResult<T> {
  @NonNull
  private List<T> content = new ArrayList<>();
  private int page;
  private int size;
  private long total;

  @NonNull
  public List<T> getContent() {
    return content;
  }

  public void setContent(@NonNull List<T> content) {
    this.content = content;
  }

  public int getPage() {
    return page;
  }

  public void setPage(int page) {
    this.page = page;
  }

  public int getSize() {
    return size;
  }

  public void setSize(int size) {
    this.size = size;
  }

  public long getTotal() {
    return total;
  }

  public void setTotal(long total) {
    this.total = total;
  }
}
