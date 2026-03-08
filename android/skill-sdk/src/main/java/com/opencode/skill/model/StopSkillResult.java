package com.opencode.skill.model;

import androidx.annotation.NonNull;

public class StopSkillResult {
  private final long welinkSessionId;
  @NonNull
  private final String status;

  public StopSkillResult(long welinkSessionId, @NonNull String status) {
    this.welinkSessionId = welinkSessionId;
    this.status = status;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }

  @NonNull
  public String getStatus() {
    return status;
  }
}
