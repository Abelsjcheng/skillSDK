package com.opencode.skill.model;

import androidx.annotation.Nullable;

public class SendMessageToIMParams {
  private final long welinkSessionId;
  @Nullable
  private final String messageId;
  @Nullable
  private final String chatId;

  public SendMessageToIMParams(long welinkSessionId, @Nullable String messageId) {
    this(welinkSessionId, messageId, null);
  }

  public SendMessageToIMParams(long welinkSessionId, @Nullable String messageId, @Nullable String chatId) {
    this.welinkSessionId = welinkSessionId;
    this.messageId = messageId;
    this.chatId = chatId;
  }

  public long getWelinkSessionId() {
    return welinkSessionId;
  }

  @Nullable
  public String getMessageId() {
    return messageId;
  }

  @Nullable
  public String getChatId() {
    return chatId;
  }
}
