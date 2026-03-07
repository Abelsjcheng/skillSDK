package com.opencode.skill.callback;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * 通用技能回调接口
 *
 * @param <T> 成功时返回的数据类型
 */
public interface SkillCallback<T> {
    
    void onSuccess(@Nullable T result);
    
    void onError(@NonNull Throwable error);
}