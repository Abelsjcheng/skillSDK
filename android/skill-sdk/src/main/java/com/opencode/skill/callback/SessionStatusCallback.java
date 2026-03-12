package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SessionStatusResult;

/**
* Session status callback used by onSessionStatusChange.
*/
public interface SessionStatusCallback {
    void onStatusChange(@NonNull SessionStatusResult result);

    default void onError(@NonNull SessionError error) {
        // Optional.
    }
}
