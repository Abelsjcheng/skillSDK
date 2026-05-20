package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class CreateSessionBody {
    @Nullable
    private final String ak;
    @Nullable
    private final String title;
    @Nullable
    private final String businessSessionDomain;
    @NonNull
    private final String businessSessionId;
    @Nullable
    private final String businessSessionType;
    @Nullable
    private final String assistantAccount;

    public CreateSessionBody(
            @Nullable String ak,
            @Nullable String title,
            @Nullable String businessSessionDomain,
            @NonNull String businessSessionId,
            @Nullable String businessSessionType,
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

    @Nullable
    public String getBusinessSessionDomain() {
        return businessSessionDomain;
    }

    @NonNull
    public String getBusinessSessionId() {
        return businessSessionId;
    }

    @Nullable
    public String getBusinessSessionType() {
        return businessSessionType;
    }

    @Nullable
    public String getAssistantAccount() {
        return assistantAccount;
    }
}
