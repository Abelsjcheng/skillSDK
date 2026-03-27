package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class QueryWeAgentParams {
    @NonNull
    private final String partnerAccount;

    public QueryWeAgentParams(@NonNull String partnerAccount) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }
}
