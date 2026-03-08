package com.opencode.skill.model;

import androidx.annotation.NonNull;

import com.opencode.skill.callback.SkillWecodeStatusCallback;

public class OnSkillWecodeStatusChangeParams {
  @NonNull
  private final SkillWecodeStatusCallback callback;

  public OnSkillWecodeStatusChangeParams(@NonNull SkillWecodeStatusCallback callback) {
    this.callback = callback;
  }

  @NonNull
  public SkillWecodeStatusCallback getCallback() {
    return callback;
  }
}
