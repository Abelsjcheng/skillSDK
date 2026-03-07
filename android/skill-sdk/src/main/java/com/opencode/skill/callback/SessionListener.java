package com.opencode.skill.callback;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.StreamMessage;

/**
 * 会话消息监听器接口
 */
public interface SessionListener {
    
    void onMessage(@NonNull StreamMessage message);
    
    void onError(@Nullable SessionError error);
    
    void onClose(@Nullable String reason);
}