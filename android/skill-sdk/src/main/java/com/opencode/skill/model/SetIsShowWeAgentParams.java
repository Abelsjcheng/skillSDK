package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class SetIsShowWeAgentParams {
    private final boolean isShowWeAgent;

    public SetIsShowWeAgentParams(boolean isShowWeAgent) {
        this.isShowWeAgent = isShowWeAgent;
    }

    public boolean isShowWeAgent() {
        return isShowWeAgent;
    }
}
