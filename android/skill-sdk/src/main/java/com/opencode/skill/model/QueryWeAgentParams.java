package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class QueryWeAgentParams {
    @Nullable
    private final Object partnerAccount;

    public QueryWeAgentParams(@Nullable Object partnerAccount) {
        this.partnerAccount = partnerAccount;
    }

    @Nullable
    public Object getPartnerAccount() {
        return partnerAccount;
    }
}
