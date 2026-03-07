package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 会话错误模型
 * Represents an error in a session.
 */
public class SessionError {
    
    @NonNull
    private final String code;
    @NonNull
    private final String message;
    private final long timestamp;

    public SessionError(@NonNull String code, @NonNull String message, long timestamp) {
        this.code = code;
        this.message = message;
        this.timestamp = timestamp;
    }

    public SessionError(@NonNull String code, @NonNull String message) {
        this(code, message, System.currentTimeMillis());
    }

    @NonNull
    public String getCode() {
        return code;
    }

    @NonNull
    public String getMessage() {
        return message;
    }

    public long getTimestamp() {
        return timestamp;
    }

    @NonNull
    @Override
    public String toString() {
        return "SessionError{" +
                "code='" + code + '\'' +
                ", message='" + message + '\'' +
                ", timestamp=" + timestamp +
                '}';
    }
}