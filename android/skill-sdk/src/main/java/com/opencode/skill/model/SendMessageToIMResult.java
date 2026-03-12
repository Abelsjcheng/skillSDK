package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class SendMessageToIMResult {
    @NonNull
    private String status = "failed";
    @Nullable
    private String chatId;
    @Nullable
    private Integer contentLength;
    @Nullable
    private String errorMessage;

    public SendMessageToIMResult() {
    }

    public SendMessageToIMResult(@NonNull String status, @Nullable String chatId, @Nullable Integer contentLength,
            @Nullable String errorMessage) {
        this.status = status;
        this.chatId = chatId;
        this.contentLength = contentLength;
        this.errorMessage = errorMessage;
    }

    @NonNull
    public String getStatus() {
        return status;
    }

    public void setStatus(@NonNull String status) {
        this.status = status;
    }

    @Nullable
    public String getChatId() {
        return chatId;
    }

    public void setChatId(@Nullable String chatId) {
        this.chatId = chatId;
    }

    @Nullable
    public Integer getContentLength() {
        return contentLength;
    }

    public void setContentLength(@Nullable Integer contentLength) {
        this.contentLength = contentLength;
    }

    @Nullable
    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(@Nullable String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
