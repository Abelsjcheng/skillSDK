package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.model.SessionError;

/**
 * 会话状态变更回调接口
 */
public interface SessionStatusCallback {
    
    void onStatusChange(@NonNull String sessionId, @NonNull String status);
    
    void onError(@NonNull String sessionId, @NonNull SessionError error);
}