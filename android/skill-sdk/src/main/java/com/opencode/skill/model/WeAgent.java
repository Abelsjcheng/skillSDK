package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class WeAgent {
    @NonNull
    private String name = "";
    @NonNull
    private String icon = "";
    @NonNull
    private String description = "";
    @NonNull
    private String partnerAccount = "";
    @NonNull
    private String bizRobotName = "";
    @NonNull
    private String bizRobotNameEn = "";
    @NonNull
    private String robotId = "";

    @NonNull
    public String getName() {
        return name;
    }

    public void setName(@NonNull String name) {
        this.name = Objects.requireNonNull(name, "name == null");
    }

    @NonNull
    public String getIcon() {
        return icon;
    }

    public void setIcon(@NonNull String icon) {
        this.icon = Objects.requireNonNull(icon, "icon == null");
    }

    @NonNull
    public String getDescription() {
        return description;
    }

    public void setDescription(@NonNull String description) {
        this.description = Objects.requireNonNull(description, "description == null");
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }

    public void setPartnerAccount(@NonNull String partnerAccount) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
    }

    @NonNull
    public String getBizRobotName() {
        return bizRobotName;
    }

    public void setBizRobotName(@NonNull String bizRobotName) {
        this.bizRobotName = Objects.requireNonNull(bizRobotName, "bizRobotName == null");
    }

    @NonNull
    public String getBizRobotNameEn() {
        return bizRobotNameEn;
    }

    public void setBizRobotNameEn(@NonNull String bizRobotNameEn) {
        this.bizRobotNameEn = Objects.requireNonNull(bizRobotNameEn, "bizRobotNameEn == null");
    }

    @NonNull
    public String getRobotId() {
        return robotId;
    }

    public void setRobotId(@NonNull String robotId) {
        this.robotId = Objects.requireNonNull(robotId, "robotId == null");
    }
}
