package com.opencode.skill.callback;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
* Generic async callback.
*/
public interface SkillCallback<T> {
    void onSuccess(@Nullable T result);

    void onError(@NonNull Throwable error);
}
