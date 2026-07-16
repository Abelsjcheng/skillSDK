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
    private final String assistantAcount;
    @Nullable
    private final List<String> sessionIds;

    public GetWeAgentUnreadMessageParams(@NonNull String assistantAcount, @Nullable List<String> sessionIds) {
        this.assistantAcount = Objects.requireNonNull(assistantAcount, "assistantAcount == null");
        this.sessionIds = sessionIds == null ? null : new ArrayList<>(sessionIds);
    }

    @NonNull public String getAssistantAcount() { return assistantAcount; }
    @Nullable public List<String> getSessionIds() { return sessionIds == null ? null : new ArrayList<>(sessionIds); }
}
