package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class WeAgentUriResult {
    @NonNull
    private final String weAgentUri;
    @NonNull
    private final String assistantDetailUri;
    @NonNull
    private final String switchAssistantUri;

    public WeAgentUriResult(
            @NonNull String weAgentUri,
            @NonNull String assistantDetailUri,
            @NonNull String switchAssistantUri
    ) {
        this.weAgentUri = Objects.requireNonNull(weAgentUri, "weAgentUri == null");
        this.assistantDetailUri = Objects.requireNonNull(assistantDetailUri, "assistantDetailUri == null");
        this.switchAssistantUri = Objects.requireNonNull(switchAssistantUri, "switchAssistantUri == null");
    }

    @NonNull
    public String getWeAgentUri() {
        return weAgentUri;
    }

    @NonNull
    public String getAssistantDetailUri() {
        return assistantDetailUri;
    }

    @NonNull
    public String getSwitchAssistantUri() {
        return switchAssistantUri;
    }
}
