package com.opencode.skill.callback;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.StreamMessage;

/**
 * Session stream listener.
 */
@FunctionalInterface
public interface SessionListener {
  void onMessage(@NonNull StreamMessage message);

  default void onError(@Nullable SessionError error) {
    // Optional.
  }

  default void onClose(@Nullable String reason) {
    // Optional.
  }
}
