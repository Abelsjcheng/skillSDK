package com.opencode.skill.model;

import androidx.annotation.Keep;

/**
 * Result payload for {@code sendMessageToIM}.
 */
@Keep
public class SendMessageToIMResult {
    /**
     * Whether the message has been forwarded to IM successfully.
     */
    private boolean success;

    /**
     * Creates an empty result.
     */
    public SendMessageToIMResult() {
    }

    /**
     * Creates a result with success flag.
     *
     * @param success forwarding status
     */
    public SendMessageToIMResult(boolean success) {
        this.success = success;
    }

    /**
     * @return {@code true} when forwarding to IM succeeds
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * Sets forwarding status.
     *
     * @param success forwarding status
     */
    public void setSuccess(boolean success) {
        this.success = success;
    }
}
