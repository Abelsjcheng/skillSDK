package com.opencode.skill.network.retrofit.body;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public final class CreateDigitalTwinBody {
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;
    private final int weCrewType;
    @Nullable
    private final String bizRobotId;

    public CreateDigitalTwinBody(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            int weCrewType,
            @Nullable String bizRobotId
    ) {
        this.name = name;
        this.icon = icon;
        this.description = description;
        this.weCrewType = weCrewType;
        this.bizRobotId = bizRobotId;
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

    public int getWeCrewType() {
        return weCrewType;
    }

    @Nullable
    public String getBizRobotId() {
        return bizRobotId;
    }
}
