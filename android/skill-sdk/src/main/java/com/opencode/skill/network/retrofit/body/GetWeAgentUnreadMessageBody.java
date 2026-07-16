package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.List;

@Keep
public class GetWeAgentUnreadMessageBody {
    @NonNull private final String assistantAcount;
    @Nullable private final List<String> sessionIds;
    public GetWeAgentUnreadMessageBody(@NonNull String assistantAcount, @Nullable List<String> sessionIds) {
        this.assistantAcount = assistantAcount;
        this.sessionIds = sessionIds;
    }
}
