package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.model.AssistantDetailUpdatedPayload;

/**
 * Callback for assistant detail updates.
 */
public interface AssistantDetailUpdatedCallback {
    void onUpdated(@NonNull AssistantDetailUpdatedPayload payload);
}
