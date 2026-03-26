package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.Nullable;

@Keep
public class HistorySessionsParams {
    private final int page;
    private final int size;
    @Nullable
    private final String status;
    @Nullable
    private final String ak;
    @Nullable
    private final String bussinessId;
    @Nullable
    private final String assistantAccount;

    public HistorySessionsParams() {
        this(0, 50, null, null, null, null);
    }

    public HistorySessionsParams(
            int page,
            int size,
            @Nullable String status,
            @Nullable String ak,
            @Nullable String bussinessId,
            @Nullable String assistantAccount
    ) {
        this.page = page;
        this.size = size;
        this.status = status;
        this.ak = ak;
        this.bussinessId = bussinessId;
        this.assistantAccount = assistantAccount;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    @Nullable
    public String getStatus() {
        return status;
    }

    @Nullable
    public String getAk() {
        return ak;
    }

    @Nullable
    public String getBussinessId() {
        return bussinessId;
    }

    @Nullable
    public String getAssistantAccount() {
        return assistantAccount;
    }
}
