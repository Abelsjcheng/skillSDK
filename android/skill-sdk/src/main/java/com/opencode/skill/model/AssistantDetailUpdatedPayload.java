package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class AssistantDetailUpdatedPayload {
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;

    public AssistantDetailUpdatedPayload(@NonNull String name, @NonNull String icon, @NonNull String description) {
        this.name = Objects.requireNonNull(name, "name == null");
        this.icon = Objects.requireNonNull(icon, "icon == null");
        this.description = Objects.requireNonNull(description, "description == null");
    }

    @NonNull
    public String getName() {
        return name;
    }

    @NonNull
    public String getIcon() {
        return icon;
    }

    @NonNull
    public String getDescription() {
        return description;
    }
}
