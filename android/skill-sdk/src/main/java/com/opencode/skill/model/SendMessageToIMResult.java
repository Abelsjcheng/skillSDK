package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class SendMessageToIMResult {
    private boolean success;

    public SendMessageToIMResult() {
    }

    public SendMessageToIMResult(boolean success) {
        this.success = success;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }
}
