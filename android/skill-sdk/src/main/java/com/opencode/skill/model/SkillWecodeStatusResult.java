package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.constant.SkillWecodeStatus;

public class SkillWecodeStatusResult {
  @NonNull
  private final SkillWecodeStatus status;
  private final long timestamp;
  @Nullable
  private final String message;

  public SkillWecodeStatusResult(@NonNull SkillWecodeStatus status, long timestamp, @Nullable String message) {
    this.status = status;
    this.timestamp = timestamp;
    this.message = message;
  }

  @NonNull
  public SkillWecodeStatus getStatus() {
    return status;
  }

  public long getTimestamp() {
    return timestamp;
  }

  @Nullable
  public String getMessage() {
    return message;
  }
}
