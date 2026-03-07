package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.constant.SkillWecodeStatus;

/**
 * 小程序状态变更回调接口
 */
public interface SkillWecodeStatusCallback {
    
    void onStatusChange(@NonNull SkillWecodeStatus status, long timestamp, @Nullable String message);
}