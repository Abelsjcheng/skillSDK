package com.opencode.skill.model;

import androidx.annotation.NonNull;

public class UnregisterSessionListenerResult {
  @NonNull
  private final String status;

  public UnregisterSessionListenerResult(@NonNull String status) {
    this.status = status;
  }

  @NonNull
  public String getStatus() {
    return status;
  }
}
