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
    private final String ak;
    private final int status;

    public UpdateQrcodeInfoParams(@NonNull String qrcode, @Nullable String ak, int status) {
        this.qrcode = Objects.requireNonNull(qrcode, "qrcode == null");
        this.ak = ak;
        this.status = status;
    }

    @NonNull
    public String getQrcode() {
        return qrcode;
    }

    @Nullable
    public String getAk() {
        return ak;
    }

    public int getStatus() {
        return status;
    }
}
