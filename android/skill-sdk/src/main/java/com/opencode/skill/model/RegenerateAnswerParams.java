package com.opencode.skill.model;

public class RegenerateAnswerParams {
  private final long welinkSessionId;

  public RegenerateAnswerParams(long welinkSessionId) {
    this.welinkSessionId = welinkSessionId;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }
}
