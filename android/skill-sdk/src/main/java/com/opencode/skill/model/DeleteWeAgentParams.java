package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class DeleteWeAgentParams {
    @Nullable
    private final String partnerAccount;
    @Nullable
    private final String robotId;

    public DeleteWeAgentParams(@Nullable String partnerAccount, @Nullable String robotId) {
        this.partnerAccount = partnerAccount;
        this.robotId = robotId;
    }

    @Nullable
    public String getPartnerAccount() {
        return partnerAccount;
    }

    @Nullable
    public String getRobotId() {
        return robotId;
    }
}
