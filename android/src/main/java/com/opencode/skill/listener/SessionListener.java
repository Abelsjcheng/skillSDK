package com.opencode.skill.listener;

import com.opencode.skill.model.StreamMessage;

public interface SessionListener {
    void onMessage(StreamMessage message);
    void onError(SessionError error);
    void onClose(String reason);
}