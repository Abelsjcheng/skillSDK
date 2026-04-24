package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class CreateDigitalTwinBody {
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

    public CreateDigitalTwinBody(
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description,
            @Nullable Integer weCrewType,
            @Nullable String bizRobotId,
            @Nullable String qrcode
    ) {
        this.name = name;
        this.icon = icon;
        this.description = description;
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
