package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 发送消息请求体
 * Request body for sending a message.
 */
public class SendMessageRequest {
    
    @NonNull
    private final String content;

    public SendMessageRequest(@NonNull String content) {
        this.content = content;
    }

    @NonNull
    public String getContent() {
        return content;
    }
}