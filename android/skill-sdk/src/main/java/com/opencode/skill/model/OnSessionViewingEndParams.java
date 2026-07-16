package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class OnSessionViewingEndParams {
    @NonNull private final String welinkSessionId;
    public OnSessionViewingEndParams(@NonNull String welinkSessionId) { this.welinkSessionId = Objects.requireNonNull(welinkSessionId, "welinkSessionId == null"); }
    @NonNull public String getWelinkSessionId() { return welinkSessionId; }
}
