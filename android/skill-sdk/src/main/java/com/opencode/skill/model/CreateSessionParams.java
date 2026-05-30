package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class CreateSessionParams {
    @Nullable
    private final String ak;
    @Nullable
    private final String title;
    @NonNull
    private final String businessSessionDomain;
    @NonNull
    private final String businessSessionId;
    @NonNull
    private final String businessSessionType;
    @Nullable
    private final String assistantAccount;

    public CreateSessionParams(
            @Nullable String ak,
            @Nullable String title,
            @NonNull String businessSessionDomain,
            @NonNull String businessSessionId,
            @NonNull String businessSessionType,
            @Nullable String assistantAccount
    ) {
        this.ak = ak;
        this.title = title;
        this.businessSessionDomain = businessSessionDomain;
        this.businessSessionId = businessSessionId;
        this.businessSessionType = businessSessionType;
        this.assistantAccount = assistantAccount;
    }

    @Nullable
    public String getAk() {
        return ak;
    }

    @Nullable
    public String getTitle() {
        return title;
    }

    @NonNull
    public String getBusinessSessionDomain() {
        return businessSessionDomain;
    }

    @NonNull
    public String getBusinessSessionId() {
        return businessSessionId;
    }

    @NonNull
    public String getBusinessSessionType() {
        return businessSessionType;
    }

    @Nullable
    public String getAssistantAccount() {
        return assistantAccount;
    }
}
