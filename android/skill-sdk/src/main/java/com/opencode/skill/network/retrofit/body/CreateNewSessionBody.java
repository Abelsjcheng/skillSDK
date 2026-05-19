package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class CreateNewSessionBody {
    @Nullable
    private final String ak;
    @Nullable
    private final String bussinessDomain;
    @Nullable
    private final String bussinessType;
    @NonNull
    private final String bussinessId;
    @Nullable
    private final String assistantAccount;
    @Nullable
    private final String title;

    public CreateNewSessionBody(
            @Nullable String ak,
            @Nullable String bussinessDomain,
            @Nullable String bussinessType,
            @NonNull String bussinessId,
            @Nullable String assistantAccount,
            @Nullable String title
    ) {
        this.ak = ak;
        this.bussinessDomain = bussinessDomain;
        this.bussinessType = bussinessType;
        this.bussinessId = bussinessId;
        this.assistantAccount = assistantAccount;
        this.title = title;
    }

    @Nullable
    public String getAk() {
        return ak;
    }

    @Nullable
    public String getBussinessDomain() {
        return bussinessDomain;
    }

    @Nullable
    public String getBussinessType() {
        return bussinessType;
    }

    @NonNull
    public String getBussinessId() {
        return bussinessId;
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
