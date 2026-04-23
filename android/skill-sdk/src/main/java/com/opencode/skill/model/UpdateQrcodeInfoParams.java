package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Objects;

@Keep
public class UpdateQrcodeInfoParams {
    @NonNull
    private final String qrcode;
    @Nullable
    private final String robotId;
    private final int status;

    public UpdateQrcodeInfoParams(@NonNull String qrcode, @Nullable String robotId, int status) {
        this.qrcode = Objects.requireNonNull(qrcode, "qrcode == null");
        this.robotId = robotId;
        this.status = status;
    }

    @NonNull
    public String getQrcode() {
        return qrcode;
    }

    @Nullable
    public String getRobotId() {
        return robotId;
    }

    public int getStatus() {
        return status;
    }
}
