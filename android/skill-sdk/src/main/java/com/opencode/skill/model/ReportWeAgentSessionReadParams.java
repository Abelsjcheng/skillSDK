package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class ReportWeAgentSessionReadParams {
    @NonNull private final String welinkSessionId;
    private final long readSeq;
    public ReportWeAgentSessionReadParams(@NonNull String welinkSessionId, long readSeq) {
        this.welinkSessionId = Objects.requireNonNull(welinkSessionId, "welinkSessionId == null");
        this.readSeq = readSeq;
    }
    @NonNull public String getWelinkSessionId() { return welinkSessionId; }
    public long getReadSeq() { return readSeq; }
}
