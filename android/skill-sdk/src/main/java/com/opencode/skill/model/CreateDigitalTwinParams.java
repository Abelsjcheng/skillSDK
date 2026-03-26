package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class CreateDigitalTwinParams {
    @Nullable
    private final Object name;
    @Nullable
    private final Object icon;
    @Nullable
    private final Object description;
    @Nullable
    private final Object weCrewType;
    @Nullable
    private final Object bizRobotId;

    public CreateDigitalTwinParams(
            @Nullable Object name,
            @Nullable Object icon,
            @Nullable Object description,
            @Nullable Object weCrewType
    ) {
        this(name, icon, description, weCrewType, null);
    }

    public CreateDigitalTwinParams(
            @Nullable Object name,
            @Nullable Object icon,
            @Nullable Object description,
            @Nullable Object weCrewType,
            @Nullable Object bizRobotId
    ) {
        this.name = name;
        this.icon = icon;
        this.description = description;
        this.weCrewType = weCrewType;
        this.bizRobotId = bizRobotId;
    }

    @Nullable
    public Object getName() {
        return name;
    }

    @Nullable
    public Object getIcon() {
        return icon;
    }

    @Nullable
    public Object getDescription() {
        return description;
    }

    @Nullable
    public Object getWeCrewType() {
        return weCrewType;
    }

    @Nullable
    public Object getBizRobotId() {
        return bizRobotId;
    }
}
