package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

/**
 * SDK error model (errorCode + errorMessage).
 */
@Keep
public class SkillSdkException extends RuntimeException {
    private final int errorCode;
    @NonNull
    private final String errorMessage;

    public SkillSdkException(int errorCode, @NonNull String errorMessage) {
        super(errorMessage);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }

    public SkillSdkException(int errorCode, @NonNull String errorMessage, Throwable cause) {
        super(errorMessage, cause);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }

    public int getErrorCode() {
        return errorCode;
    }

    @NonNull
    public String getErrorMessage() {
        return errorMessage;
    }
}
