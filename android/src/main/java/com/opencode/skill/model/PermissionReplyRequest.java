package com.opencode.skill.model;

import com.google.gson.annotations.SerializedName;

public class PermissionReplyRequest {
    @SerializedName("approved")
    private Boolean approved;

    public PermissionReplyRequest(Boolean approved) {
        this.approved = approved;
    }

    public Boolean getApproved() {
        return approved;
    }

    public void setApproved(Boolean approved) {
        this.approved = approved;
    }
}