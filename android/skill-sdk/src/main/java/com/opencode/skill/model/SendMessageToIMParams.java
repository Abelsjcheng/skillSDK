package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class SendMessageToIMParams {
    @NonNull
    private final String welinkSessionId;
    @Nullable
    private final String messageId;
    @Nullable
    private final String chatId;

    public SendMessageToIMParams(@NonNull String welinkSessionId, @Nullable String messageId) {
        this(welinkSessionId, messageId, null);
    }

    public SendMessageToIMParams(@NonNull String welinkSessionId, @Nullable String messageId, @Nullable String chatId) {
        this.welinkSessionId = welinkSessionId;
        this.messageId = messageId;
        this.chatId = chatId;
    }

    @NonNull
    public String getWelinkSessionId() {
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
