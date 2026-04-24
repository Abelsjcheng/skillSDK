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
    @Nullable
    private final Integer weCrewType;
    @Nullable
    private final String bizRobotId;
    @Nullable
    private final String qrcode;

    public CreateDigitalTwinParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description
    ) {
        this(name, icon, description, null, null, null);
    }

    public CreateDigitalTwinParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @Nullable Integer weCrewType
    ) {
        this(name, icon, description, weCrewType, null, null);
    }

    public CreateDigitalTwinParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @Nullable Integer weCrewType,
            @Nullable String bizRobotId
    ) {
        this(name, icon, description, weCrewType, bizRobotId, null);
    }

    public CreateDigitalTwinParams(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @Nullable Integer weCrewType,
            @Nullable String bizRobotId,
            @Nullable String qrcode
    ) {
        this.name = Objects.requireNonNull(name, "name == null");
        this.icon = Objects.requireNonNull(icon, "icon == null");
        this.description = Objects.requireNonNull(description, "description == null");
        this.weCrewType = weCrewType;
        this.bizRobotId = bizRobotId;
        this.qrcode = qrcode;
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
    public Integer getWeCrewType() {
        return weCrewType;
    }

    @Nullable
    public String getBizRobotId() {
        return bizRobotId;
    }

    @Nullable
    public String getQrcode() {
        return qrcode;
    }
}
