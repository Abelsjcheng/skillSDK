package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class QueryQrcodeInfoParams {
    @NonNull
    private final String qrcode;

    public QueryQrcodeInfoParams(@NonNull String qrcode) {
        this.qrcode = Objects.requireNonNull(qrcode, "qrcode == null");
    }

    @NonNull
    public String getQrcode() {
        return qrcode;
    }
}
