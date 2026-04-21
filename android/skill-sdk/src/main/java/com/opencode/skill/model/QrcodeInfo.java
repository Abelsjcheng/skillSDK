package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class QrcodeInfo {
    @NonNull
    private String qrcode = "";
    @NonNull
    private String weUrl = "";
    @NonNull
    private String pcUrl = "";
    @NonNull
    private String expireTime = "";
    private int status;
    private boolean expired;

    @NonNull
    public String getQrcode() {
        return qrcode;
    }

    public void setQrcode(@NonNull String qrcode) {
        this.qrcode = Objects.requireNonNull(qrcode, "qrcode == null");
    }

    @NonNull
    public String getWeUrl() {
        return weUrl;
    }

    public void setWeUrl(@NonNull String weUrl) {
        this.weUrl = Objects.requireNonNull(weUrl, "weUrl == null");
    }

    @NonNull
    public String getPcUrl() {
        return pcUrl;
    }

    public void setPcUrl(@NonNull String pcUrl) {
        this.pcUrl = Objects.requireNonNull(pcUrl, "pcUrl == null");
    }

    @NonNull
    public String getExpireTime() {
        return expireTime;
    }

    public void setExpireTime(@NonNull String expireTime) {
        this.expireTime = Objects.requireNonNull(expireTime, "expireTime == null");
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public boolean isExpired() {
        return expired;
    }

    public void setExpired(boolean expired) {
        this.expired = expired;
    }
}
