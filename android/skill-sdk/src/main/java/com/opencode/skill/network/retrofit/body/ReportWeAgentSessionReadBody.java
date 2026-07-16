package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;

@Keep
public class ReportWeAgentSessionReadBody {
    private final long readSeq;
    public ReportWeAgentSessionReadBody(long readSeq) { this.readSeq = readSeq; }
}
