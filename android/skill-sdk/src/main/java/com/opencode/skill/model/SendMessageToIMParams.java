package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class SendMessageToIMParams {
    @NonNull
    private final String welinkSessionId;
    @Nullable
    private final String content;
    @Nullable
    private final String chatId;

    public SendMessageToIMParams(@NonNull String welinkSessionId, @Nullable String content) {
        this(welinkSessionId, content, null);
    }

    public SendMessageToIMParams(@NonNull String welinkSessionId, @Nullable String content, @Nullable String chatId) {
        this.welinkSessionId = welinkSessionId;
        this.content = content;
        this.chatId = chatId;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    @Nullable
    public String getContent() {
        return content;
    }

    @Nullable
    public String getChatId() {
        return chatId;
    }
}
