package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class SlashCommand {
    @NonNull
    private final String command;
    @NonNull
    private final String description;

    public SlashCommand(@NonNull String command, @NonNull String description) {
        this.command = command;
        this.description = description;
    }

    @NonNull
    public String getCommand() {
        return command;
    }

    @NonNull
    public String getDescription() {
        return description;
    }
}
