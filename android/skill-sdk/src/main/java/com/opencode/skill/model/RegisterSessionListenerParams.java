package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.callback.SessionCloseCallback;
import com.opencode.skill.callback.SessionErrorCallback;
import com.opencode.skill.callback.SessionMessageCallback;

@Keep
public class RegisterSessionListenerParams {
    private final long welinkSessionId;
    @NonNull
    private final SessionMessageCallback onMessage;
    @Nullable
    private final SessionErrorCallback onError;
    @Nullable
    private final SessionCloseCallback onClose;

    public RegisterSessionListenerParams(long welinkSessionId, @NonNull SessionMessageCallback onMessage,
            @Nullable SessionErrorCallback onError, @Nullable SessionCloseCallback onClose) {
        this.welinkSessionId = welinkSessionId;
        this.onMessage = onMessage;
        this.onError = onError;
        this.onClose = onClose;
    }

    public long getWelinkSessionId() {
        return welinkSessionId;
    }

    @NonNull
    public SessionMessageCallback getOnMessage() {
        return onMessage;
    }

    @Nullable
    public SessionErrorCallback getOnError() {
        return onError;
    }

    @Nullable
    public SessionCloseCallback getOnClose() {
        return onClose;
    }
}
