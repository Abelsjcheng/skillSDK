package com.opencode.skill.model;

import androidx.annotation.NonNull;

public class RegisterSessionListenerResult {
  @NonNull
  private final String status;

  public RegisterSessionListenerResult(@NonNull String status) {
    this.status = status;
  }

  @NonNull
  public String getStatus() {
    return status;
  }
}
