package com.opencode.skill.model;

public class UnregisterSessionListenerParams {
  private final long welinkSessionId;

  public UnregisterSessionListenerParams(long welinkSessionId) {
    this.welinkSessionId = welinkSessionId;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }
}
