package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class SkillSession {
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
        this.welinkSessionId = welinkSessionId;
    }

    @NonNull
    public String getUserId() {
        return userId;
    }

    public void setUserId(@NonNull String userId) {
        this.userId = userId;
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

    @NonNull
    public String getStatus() {
        return status;
    }

    public void setStatus(@NonNull String status) {
        this.status = status;
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
        this.createdAt = createdAt;
    }

    @NonNull
    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(@NonNull String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
