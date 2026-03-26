package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class CreateDigitalTwinResult {
    @NonNull
    private String robotId = "";
    @NonNull
    private String partnerAccount = "";
    @NonNull
    private String status = "success";

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
    public String getStatus() {
        return status;
    }

    public void setStatus(@NonNull String status) {
        this.status = Objects.requireNonNull(status, "status == null");
    }
}
