package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.opencode.skill.constant.SkillWeCodeAction;

@Keep
public class ControlSkillWeCodeParams {
    @NonNull
    private final SkillWeCodeAction action;

    public ControlSkillWeCodeParams(@NonNull SkillWeCodeAction action) {
        this.action = action;
    }

    @NonNull
    public SkillWeCodeAction getAction() {
        return action;
    }
}
