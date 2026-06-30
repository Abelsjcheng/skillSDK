package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

import com.opencode.skill.callback.SkillWecodeStatusCallback;

@Keep
public class OffSkillWecodeStatusChangeParams {
    @Nullable
    private final SkillWecodeStatusCallback callback;

    public OffSkillWecodeStatusChangeParams() {
        this(null);
    }

    public OffSkillWecodeStatusChangeParams(@Nullable SkillWecodeStatusCallback callback) {
        this.callback = callback;
    }

    @Nullable
    public SkillWecodeStatusCallback getCallback() {
        return callback;
    }
}
