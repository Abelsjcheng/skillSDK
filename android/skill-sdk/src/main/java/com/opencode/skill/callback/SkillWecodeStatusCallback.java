package com.opencode.skill.callback;

import androidx.annotation.NonNull;

import com.opencode.skill.model.SkillWecodeStatusResult;

/**
* Miniapp status callback used by onSkillWecodeStatusChange.
*/
public interface SkillWecodeStatusCallback {
    void onStatusChange(@NonNull SkillWecodeStatusResult result);
}
