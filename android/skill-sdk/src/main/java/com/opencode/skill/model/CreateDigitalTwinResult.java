package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.google.gson.annotations.SerializedName;

import java.util.Objects;

@Keep
public class CreateDigitalTwinResult {
    @NonNull
    private String robotId = "";
    @NonNull
    private String partnerAccount = "";
    @NonNull
    @SerializedName(value = "message", alternate = {"status"})
    private String message = "success";

    @NonNull
    public String getRobotId() {
        return robotId;
    }

    public void setRobotId(@NonNull String robotId) {
        this.robotId = Objects.requireNonNull(robotId, "robotId == null");
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }

    public void setPartnerAccount(@NonNull String partnerAccount) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
    }

    @NonNull
    public String getMessage() {
        return message;
    }

    public void setMessage(@NonNull String message) {
        this.message = Objects.requireNonNull(message, "message == null");
    }
}
