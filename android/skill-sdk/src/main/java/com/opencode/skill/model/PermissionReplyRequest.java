package com.opencode.skill.model;

/**
 * 权限回复请求体
 * Request body for replying to a permission request.
 */
public class PermissionReplyRequest {
    
    private final boolean approved;

    public PermissionReplyRequest(boolean approved) {
        this.approved = approved;
    }

    public boolean isApproved() {
        return approved;
    }
}