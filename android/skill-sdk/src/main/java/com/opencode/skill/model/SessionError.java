package com.opencode.skill.model;

import androidx.annotation.NonNull;

public class SessionError {
  @NonNull
  private final String code;
  @NonNull
  private final String message;
  private final long timestamp;

  public SessionError(@NonNull String code, @NonNull String message) {
    this(code, message, System.currentTimeMillis());
  }

  public SessionError(@NonNull String code, @NonNull String message, long timestamp) {
    this.code = code;
    this.message = message;
    this.timestamp = timestamp;
  }

  @NonNull
  public String getCode() {
    return code;
  }

  @NonNull
  public String getMessage() {
    return message;
  }

  public long getTimestamp() {
    return timestamp;
  }
}
