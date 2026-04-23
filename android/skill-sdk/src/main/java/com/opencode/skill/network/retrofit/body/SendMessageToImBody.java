package com.opencode.skill.network.retrofit.body;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public final class SendMessageToImBody {
    @NonNull
    private final String content;
    @Nullable
    private final String chatId;

    public SendMessageToImBody(@NonNull String content, @Nullable String chatId) {
        this.content = content;
        this.chatId = chatId;
    }

    @NonNull
    public String getContent() {
        return content;
    }

    @Nullable
    public String getChatId() {
        return chatId;
    }
}
