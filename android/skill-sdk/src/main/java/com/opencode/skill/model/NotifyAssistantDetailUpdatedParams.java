package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Objects;

@Keep
public class NotifyAssistantDetailUpdatedParams {
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;
    @Nullable
    private final String partnerAccount;
    @Nullable
    private final String robotId;

    public NotifyAssistantDetailUpdatedParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @Nullable String partnerAccount,
            @Nullable String robotId
    ) {
        this.name = Objects.requireNonNull(name, "name == null");
        this.icon = Objects.requireNonNull(icon, "icon == null");
        this.description = Objects.requireNonNull(description, "description == null");
        this.partnerAccount = partnerAccount;
        this.robotId = robotId;
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

    @Nullable
    public String getPartnerAccount() {
        return partnerAccount;
    }

    @Nullable
    public String getRobotId() {
        return robotId;
    }
}
