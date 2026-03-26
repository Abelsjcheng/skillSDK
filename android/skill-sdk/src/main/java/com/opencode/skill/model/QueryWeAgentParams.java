package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class QueryWeAgentParams {
    @Nullable
    private final Object partnerAccounts;

    public QueryWeAgentParams(@Nullable Object partnerAccounts) {
        this.partnerAccounts = partnerAccounts;
    }

    @Nullable
    public Object getPartnerAccounts() {
        return partnerAccounts;
    }
}
