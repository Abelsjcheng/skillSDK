package com.opencode.skill.model;

import androidx.annotation.Keep;

@Keep
public class GetIsShowWeAgentResult {
    private final boolean isShowWeAgent;

    public GetIsShowWeAgentResult(boolean isShowWeAgent) {
        this.isShowWeAgent = isShowWeAgent;
    }

    public boolean isShowWeAgent() {
        return isShowWeAgent;
    }
}
