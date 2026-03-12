package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.model.StreamMessage;

@FunctionalInterface
public interface SessionMessageCallback {
    void onMessage(@NonNull StreamMessage message);
}
