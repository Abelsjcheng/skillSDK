package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class OnAssistantChangedParams {
    @Nullable
    private final WeAgentDetails assistantDetail;

    public OnAssistantChangedParams(@Nullable WeAgentDetails assistantDetail) {
        this.assistantDetail = assistantDetail;
    }

    @Nullable
    public WeAgentDetails getAssistantDetail() {
        return assistantDetail;
    }
}
