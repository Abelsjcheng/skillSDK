package com.opencode.skill.model;

import androidx.annotation.NonNull;

public class ControlSkillWeCodeResult {
  @NonNull
  private final String status;

  public ControlSkillWeCodeResult(@NonNull String status) {
    this.status = status;
  }

  @NonNull
  public String getStatus() {
    return status;
  }
}
