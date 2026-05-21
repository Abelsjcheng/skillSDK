package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.annotations.SerializedName;

import java.util.Objects;

@Keep
public class Session {
    @NonNull
    private String welinkSessionId = "";
    @NonNull
    private String userId = "";
    @Nullable
    private String ak;
    @Nullable
    private String title;
    @Nullable
    private String imGroupId;
    @Nullable
    @SerializedName("businessSessionDomain")
    private String businessSessionDomain;
    @Nullable
    @SerializedName("businessSessionType")
    private String businessSessionType;
    @Nullable
    @SerializedName("businessSessionId")
    private String businessSessionId;
    @Nullable
    private String assistantAccount;
    @NonNull
    private String status = "ACTIVE";
    @Nullable
    private String toolSessionId;
    @NonNull
    private String createdAt = "";
    @NonNull
    private String updatedAt = "";

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    public void setWelinkSessionId(@NonNull String welinkSessionId) {
        this.welinkSessionId = Objects.requireNonNull(welinkSessionId, "welinkSessionId == null");
    }

    @NonNull
    public String getUserId() {
        return userId;
    }

    public void setUserId(@NonNull String userId) {
        this.userId = Objects.requireNonNull(userId, "userId == null");
    }

    @Nullable
    public String getAk() {
        return ak;
    }

    public void setAk(@Nullable String ak) {
        this.ak = ak;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    public void setTitle(@Nullable String title) {
        this.title = title;
    }

    @Nullable
    public String getImGroupId() {
        return imGroupId;
    }

    public void setImGroupId(@Nullable String imGroupId) {
        this.imGroupId = imGroupId;
    }

    @Nullable
    public String getBusinessSessionDomain() {
        return businessSessionDomain;
    }

    public void setBusinessSessionDomain(@Nullable String businessSessionDomain) {
        this.businessSessionDomain = businessSessionDomain;
    }

    @Nullable
    public String getBusinessSessionType() {
        return businessSessionType;
    }

    public void setBusinessSessionType(@Nullable String businessSessionType) {
        this.businessSessionType = businessSessionType;
    }

    @Nullable
    public String getBusinessSessionId() {
        return businessSessionId;
    }

    public void setBusinessSessionId(@Nullable String businessSessionId) {
        this.businessSessionId = businessSessionId;
    }

    @Nullable
    public String getAssistantAccount() {
        return assistantAccount;
    }

    public void setAssistantAccount(@Nullable String assistantAccount) {
        this.assistantAccount = assistantAccount;
    }

    @NonNull
    public String getStatus() {
        return status;
    }

    public void setStatus(@NonNull String status) {
        this.status = Objects.requireNonNull(status, "status == null");
    }

    @Nullable
    public String getToolSessionId() {
        return toolSessionId;
    }

    public void setToolSessionId(@Nullable String toolSessionId) {
        this.toolSessionId = toolSessionId;
    }

    @NonNull
    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(@NonNull String createdAt) {
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt == null");
    }

    @NonNull
    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(@NonNull String updatedAt) {
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt == null");
    }
}
