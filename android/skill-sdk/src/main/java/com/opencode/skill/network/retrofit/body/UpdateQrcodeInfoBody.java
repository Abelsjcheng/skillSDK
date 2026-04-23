package com.opencode.skill.network.retrofit.body;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public final class UpdateQrcodeInfoBody {
    @NonNull
    private final String qrcode;
    @Nullable
    private final String ak;
    private final int status;

    public UpdateQrcodeInfoBody(@NonNull String qrcode, @Nullable String ak, int status) {
        this.qrcode = qrcode;
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
