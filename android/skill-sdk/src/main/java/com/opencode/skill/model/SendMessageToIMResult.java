package com.opencode.skill.model;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * 发送消息到IM结果
 * Result of sending a message to IM.
 */
public class SendMessageToIMResult {
    
    private final boolean success;
    @Nullable
    private final String chatId;
    private final int contentLength;
    @Nullable
    private final String errorMessage;

    public SendMessageToIMResult(boolean success, @Nullable String chatId, int contentLength, @Nullable String errorMessage) {
        this.success = success;
        this.chatId = chatId;
        this.contentLength = contentLength;
        this.errorMessage = errorMessage;
    }

    public static SendMessageToIMResult success(@NonNull String chatId, int contentLength) {
        return new SendMessageToIMResult(true, chatId, contentLength, null);
    }

    public static SendMessageToIMResult failure(@NonNull String errorMessage) {
        return new SendMessageToIMResult(false, null, 0, errorMessage);
    }

    public boolean isSuccess() {
        return success;
    }

    @Nullable
    public String getChatId() {
        return chatId;
    }

    public int getContentLength() {
        return contentLength;
    }

    @Nullable
    public String getErrorMessage() {
        return errorMessage;
    }

    @NonNull
    @Override
    public String toString() {
        return "SendMessageToIMResult{" +
                "success=" + success +
                ", chatId='" + chatId + '\'' +
                ", contentLength=" + contentLength +
                ", errorMessage='" + errorMessage + '\'' +
                '}';
    }
}