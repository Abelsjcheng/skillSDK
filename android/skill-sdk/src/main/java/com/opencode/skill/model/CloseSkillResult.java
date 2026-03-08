package com.opencode.skill.model;

import androidx.annotation.NonNull;

public class CloseSkillResult {
  @NonNull
  private final String status;

  public CloseSkillResult(@NonNull String status) {
    this.status = status;
  }

  @NonNull
  public String getStatus() {
    return status;
  }
}
