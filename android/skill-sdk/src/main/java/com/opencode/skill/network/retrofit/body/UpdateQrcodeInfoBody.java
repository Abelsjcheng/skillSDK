package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class UpdateQrcodeInfoBody {
    @NonNull
    private final String qrcode;
    @Nullable
    private final String robotId;
    private final int status;

    public UpdateQrcodeInfoBody(@NonNull String qrcode, @Nullable String robotId, int status) {
        this.qrcode = qrcode;
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
