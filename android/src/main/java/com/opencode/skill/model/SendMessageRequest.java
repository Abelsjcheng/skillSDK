package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;

public class SendMessageRequest {
    @SerializedName("content")
    private String content;

    public SendMessageRequest(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}