package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import com.google.gson.annotations.SerializedName;

import java.util.Objects;

@Keep
public class WeAgentDetails {
    @NonNull
    private String name = "";
    @NonNull
    private String icon = "";
    @NonNull
    private String desc = "";
    @NonNull
    private String moduleId = "";
    @NonNull
    private String appKey = "";
    @NonNull
    private String appSecret = "";
    @NonNull
    private String partnerAccount = "";
    @NonNull
    private String createdBy = "";
    @NonNull
    private String creatorName = "";
    @NonNull
    private String creatorNameEn = "";
    @NonNull
    private String ownerWelinkId = "";
    @NonNull
    private String ownerName = "";
    @NonNull
    private String ownerNameEn = "";
    @NonNull
    private String ownerDeptName = "";
    @NonNull
    private String ownerDeptNameEn = "";
    @NonNull
    @SerializedName(value = "id", alternate = {"robotId"})
    private String id = "";
    @NonNull
    private String bizRobotName = "";
    @NonNull
    private String bizRobotNameEn = "";
    @NonNull
    private String bizRobotId = "";
    @NonNull
    private String weCodeUrl = "";

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
    public String getDesc() {
        return desc;
    }

    public void setDesc(@NonNull String desc) {
        this.desc = Objects.requireNonNull(desc, "desc == null");
    }

    @NonNull
    public String getModuleId() {
        return moduleId;
    }

    public void setModuleId(@NonNull String moduleId) {
        this.moduleId = Objects.requireNonNull(moduleId, "moduleId == null");
    }

    @NonNull
    public String getAppKey() {
        return appKey;
    }

    public void setAppKey(@NonNull String appKey) {
        this.appKey = Objects.requireNonNull(appKey, "appKey == null");
    }

    @NonNull
    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(@NonNull String appSecret) {
        this.appSecret = Objects.requireNonNull(appSecret, "appSecret == null");
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }

    public void setPartnerAccount(@NonNull String partnerAccount) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
    }

    @NonNull
    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(@NonNull String createdBy) {
        this.createdBy = Objects.requireNonNull(createdBy, "createdBy == null");
    }

    @NonNull
    public String getCreatorName() {
        return creatorName;
    }

    public void setCreatorName(@NonNull String creatorName) {
        this.creatorName = Objects.requireNonNull(creatorName, "creatorName == null");
    }

    @NonNull
    public String getCreatorNameEn() {
        return creatorNameEn;
    }

    public void setCreatorNameEn(@NonNull String creatorNameEn) {
        this.creatorNameEn = Objects.requireNonNull(creatorNameEn, "creatorNameEn == null");
    }

    @NonNull
    public String getOwnerWelinkId() {
        return ownerWelinkId;
    }

    public void setOwnerWelinkId(@NonNull String ownerWelinkId) {
        this.ownerWelinkId = Objects.requireNonNull(ownerWelinkId, "ownerWelinkId == null");
    }

    @NonNull
    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(@NonNull String ownerName) {
        this.ownerName = Objects.requireNonNull(ownerName, "ownerName == null");
    }

    @NonNull
    public String getOwnerNameEn() {
        return ownerNameEn;
    }

    public void setOwnerNameEn(@NonNull String ownerNameEn) {
        this.ownerNameEn = Objects.requireNonNull(ownerNameEn, "ownerNameEn == null");
    }

    @NonNull
    public String getOwnerDeptName() {
        return ownerDeptName;
    }

    public void setOwnerDeptName(@NonNull String ownerDeptName) {
        this.ownerDeptName = Objects.requireNonNull(ownerDeptName, "ownerDeptName == null");
    }

    @NonNull
    public String getOwnerDeptNameEn() {
        return ownerDeptNameEn;
    }

    public void setOwnerDeptNameEn(@NonNull String ownerDeptNameEn) {
        this.ownerDeptNameEn = Objects.requireNonNull(ownerDeptNameEn, "ownerDeptNameEn == null");
    }

    @NonNull
    public String getId() {
        return id;
    }

    public void setId(@NonNull String id) {
        this.id = Objects.requireNonNull(id, "id == null");
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
    public String getBizRobotId() {
        return bizRobotId;
    }

    public void setBizRobotId(@NonNull String bizRobotId) {
        this.bizRobotId = Objects.requireNonNull(bizRobotId, "bizRobotId == null");
    }

    @NonNull
    public String getWeCodeUrl() {
        return weCodeUrl;
    }

    public void setWeCodeUrl(@NonNull String weCodeUrl) {
        this.weCodeUrl = Objects.requireNonNull(weCodeUrl, "weCodeUrl == null");
    }
}
