package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

/** 服务端已读上报接口 data 字段的数据模型。 */
@Keep
public class ReportWeAgentSessionReadData {
    @NonNull
    private String welinkSessionId = "";
    private int unreadCount;

    @NonNull
    public String getWelinkSessionId() {
        return welinkSessionId;
    }

    public void setWelinkSessionId(@NonNull String welinkSessionId) {
        this.welinkSessionId = Objects.requireNonNull(welinkSessionId, "welinkSessionId == null");
    }

    public int getUnreadCount() {
        return unreadCount;
    }

    public void setUnreadCount(int unreadCount) {
        this.unreadCount = unreadCount;
    }
}
