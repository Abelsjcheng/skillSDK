package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Keep
public class GetWeAgentUnreadMessageParams {
    @NonNull
    private final String assistantAccount;
    @Nullable
    private final List<String> sessionIds;

    public GetWeAgentUnreadMessageParams(@NonNull String assistantAccount, @Nullable List<String> sessionIds) {
        this.assistantAccount = Objects.requireNonNull(assistantAccount, "assistantAccount == null");
        this.sessionIds = sessionIds == null ? null : new ArrayList<>(sessionIds);
    }

    @NonNull public String getAssistantAccount() { return assistantAccount; }
    @Nullable public List<String> getSessionIds() { return sessionIds == null ? null : new ArrayList<>(sessionIds); }
}
