package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class CreateNewSessionBody {
    @Nullable
    private final String ak;
    @Nullable
    private final String businessSessionDomain;
    @Nullable
    private final String businessSessionType;
    @NonNull
    private final String businessSessionId;
    @Nullable
    private final String assistantAccount;
    @Nullable
    private final String title;

    public CreateNewSessionBody(
            @Nullable String ak,
            @Nullable String businessSessionDomain,
            @Nullable String businessSessionType,
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

    @Nullable
    public String getBusinessSessionDomain() {
        return businessSessionDomain;
    }

    @Nullable
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
