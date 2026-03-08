package com.opencode.skill.model;

import androidx.annotation.NonNull;

import com.opencode.skill.callback.SessionStatusCallback;

public class OnSessionStatusChangeParams {
  private final long welinkSessionId;
  @NonNull
  private final SessionStatusCallback callback;

  public OnSessionStatusChangeParams(long welinkSessionId, @NonNull SessionStatusCallback callback) {
    this.welinkSessionId = welinkSessionId;
    this.callback = callback;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }

  @NonNull
  public SessionStatusCallback getCallback() {
    return callback;
  }
}
