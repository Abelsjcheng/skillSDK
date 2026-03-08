package com.opencode.skill.model;

import androidx.annotation.Nullable;

public class SendMessageToIMParams {
  private final long welinkSessionId;
  @Nullable
  private final Long messageId;

  public SendMessageToIMParams(long welinkSessionId, @Nullable Long messageId) {
    this.welinkSessionId = welinkSessionId;
    this.messageId = messageId;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }

  @Nullable
  public Long getMessageId() {
    return messageId;
  }
}
