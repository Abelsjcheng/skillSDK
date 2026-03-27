package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Objects;

@Keep
public class CreateDigitalTwinParams {
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;
    private final int weCrewType;
    @Nullable
    private final String bizRobotId;

    public CreateDigitalTwinParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            int weCrewType
    ) {
        this(name, icon, description, weCrewType, null);
    }

    public CreateDigitalTwinParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            int weCrewType,
            @Nullable String bizRobotId
    ) {
        this.name = Objects.requireNonNull(name, "name == null");
        this.icon = Objects.requireNonNull(icon, "icon == null");
        this.description = Objects.requireNonNull(description, "description == null");
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
