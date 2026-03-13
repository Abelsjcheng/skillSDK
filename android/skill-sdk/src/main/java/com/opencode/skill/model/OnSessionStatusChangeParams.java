package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.opencode.skill.callback.SessionStatusCallback;

@Keep
public class OnSessionStatusChangeParams {
    @NonNull
    private final String welinkSessionId;
    @NonNull
    private final SessionStatusCallback callback;

    public OnSessionStatusChangeParams(@NonNull String welinkSessionId, @NonNull SessionStatusCallback callback) {
        this.welinkSessionId = welinkSessionId;
        this.callback = callback;
    }

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    @NonNull
    public SessionStatusCallback getCallback() {
        return callback;
    }
}
