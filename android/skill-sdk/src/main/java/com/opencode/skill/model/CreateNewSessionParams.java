package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class CreateNewSessionParams {
    @Nullable
    private final String ak;
    @Nullable
    private final String title;
    @NonNull
    private final String businessSessionDomain;
    @NonNull
    private final String businessSessionType;
    @NonNull
    private final String businessSessionId;
    @Nullable
    private final String assistantAccount;

    public CreateNewSessionParams(
            @Nullable String ak,
            @Nullable String title,
            @NonNull String businessSessionDomain,
            @NonNull String businessSessionType,
            @NonNull String businessSessionId,
            @Nullable String assistantAccount
    ) {
        this.ak = ak;
        this.title = title;
        this.businessSessionDomain = businessSessionDomain;
        this.businessSessionType = businessSessionType;
        this.businessSessionId = businessSessionId;
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
    public String getBusinessSessionType() {
        return businessSessionType;
    }

    @NonNull
    public String getBusinessSessionId() {
        return businessSessionId;
    }

    @Nullable
    public String getAssistantAccount() {
        return assistantAccount;
    }
}
