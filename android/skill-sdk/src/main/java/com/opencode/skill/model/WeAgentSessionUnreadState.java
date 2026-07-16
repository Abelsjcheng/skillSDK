package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public class WeAgentSessionUnreadState {
    @NonNull private final String welinkSessionId;
    private final boolean hasUnRead;
    private final long maxSeq;
    public WeAgentSessionUnreadState(@NonNull String welinkSessionId, boolean hasUnRead, long maxSeq) {
        this.welinkSessionId = welinkSessionId;
        this.hasUnRead = hasUnRead;
        this.maxSeq = maxSeq;
    }
    @NonNull public String getWelinkSessionId() { return welinkSessionId; }
    public boolean isHasUnRead() { return hasUnRead; }
    public long getMaxSeq() { return maxSeq; }
}
