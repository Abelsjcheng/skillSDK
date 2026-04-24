package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class UpdateWeAgentBody {
    @Nullable
    private final String partnerAccount;
    @Nullable
    private final String robotId;
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;

    public UpdateWeAgentBody(
            @Nullable String partnerAccount,
            @Nullable String robotId,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description
    ) {
        this.partnerAccount = partnerAccount;
        this.robotId = robotId;
        this.name = name;
        this.icon = icon;
        this.description = description;
    }

    @Nullable
    public String getPartnerAccount() {
        return partnerAccount;
    }

    @Nullable
    public String getRobotId() {
        return robotId;
    }

    @NonNull
    public String getName() {
        return name;
    }

    @NonNull
    public String getIcon() {
        return icon;
    }

    @NonNull
    public String getDescription() {
        return description;
    }
}
