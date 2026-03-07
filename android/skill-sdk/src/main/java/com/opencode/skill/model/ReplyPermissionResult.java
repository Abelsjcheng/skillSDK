package com.opencode.skill.model;

import androidx.annotation.NonNull;

/**
 * 回复权限结果
 * Result of replying to a permission request.
 */
public class ReplyPermissionResult {
    
    private final boolean success;
    @NonNull
    private final String permissionId;
    private final boolean approved;

    public ReplyPermissionResult(boolean success, @NonNull String permissionId, boolean approved) {
        this.success = success;
        this.permissionId = permissionId;
        this.approved = approved;
    }

    public boolean isSuccess() {
        return success;
    }

    @NonNull
    public String getPermissionId() {
        return permissionId;
    }

    public boolean isApproved() {
        return approved;
    }

    @NonNull
    @Override
    public String toString() {
        return "ReplyPermissionResult{" +
                "success=" + success +
                ", permissionId='" + permissionId + '\'' +
                ", approved=" + approved +
                '}';
    }
}