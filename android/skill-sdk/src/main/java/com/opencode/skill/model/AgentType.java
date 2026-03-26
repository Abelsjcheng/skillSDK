package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class AgentType {
    @NonNull
    private String name = "";
    @NonNull
    private String icon = "";
    @NonNull
    private String bizRobotId = "";

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
    public String getBizRobotId() {
        return bizRobotId;
    }

    public void setBizRobotId(@NonNull String bizRobotId) {
        this.bizRobotId = Objects.requireNonNull(bizRobotId, "bizRobotId == null");
    }
}
