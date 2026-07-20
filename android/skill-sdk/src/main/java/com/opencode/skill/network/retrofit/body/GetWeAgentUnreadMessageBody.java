package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.List;

@Keep
public class GetWeAgentUnreadMessageBody {
    @NonNull private final String assistantAccount;
    @Nullable private final List<String> sessionIds;
    public GetWeAgentUnreadMessageBody(@NonNull String assistantAccount, @Nullable List<String> sessionIds) {
        this.assistantAccount = assistantAccount;
        this.sessionIds = sessionIds;
    }
}
