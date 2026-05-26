package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class QueryWeAgentParams {
    @Nullable
    private final String partnerAccount;

    public QueryWeAgentParams() {
        this.partnerAccount = null;
    }

    public QueryWeAgentParams(@Nullable String partnerAccount) {
        this.partnerAccount = partnerAccount;
    }

    @Nullable
    public String getPartnerAccount() {
        return partnerAccount;
    }
}
