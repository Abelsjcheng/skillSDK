package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class CreateNewSessionBody {
    @Nullable
    private final String ak;
    @NonNull
    private final String businessSessionDomain;
    @NonNull
    private final String businessSessionType;
    @NonNull
    private final String businessSessionId;
    @Nullable
    private final String assistantAccount;
    @Nullable
    private final String title;

    public CreateNewSessionBody(
            @Nullable String ak,
            @NonNull String businessSessionDomain,
            @NonNull String businessSessionType,
            @NonNull String businessSessionId,
            @Nullable String assistantAccount,
            @Nullable String title
    ) {
        this.ak = ak;
        this.businessSessionDomain = businessSessionDomain;
        this.businessSessionType = businessSessionType;
        this.businessSessionId = businessSessionId;
        this.assistantAccount = assistantAccount;
        this.title = title;
    }

    @Nullable
    public String getAk() {
        return ak;
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

    @Nullable
    public String getTitle() {
        return title;
    }
}
