package com.opencode.skill.callback;

import androidx.annotation.Nullable;

@FunctionalInterface
public interface SessionCloseCallback {
  void onClose(@Nullable String reason);
}
