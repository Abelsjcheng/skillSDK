package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.model.SessionError;

@FunctionalInterface
public interface SessionErrorCallback {
    void onError(@NonNull SessionError error);
}
