package com.opencode.skill.model;

import androidx.annotation.NonNull;

import com.opencode.skill.constant.SessionStatus;

public class SessionStatusResult {
  @NonNull
  private final SessionStatus status;

  public SessionStatusResult(@NonNull SessionStatus status) {
    this.status = status;
  }

  @NonNull
  public SessionStatus getStatus() {
    return status;
  }
}
