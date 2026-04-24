package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public final class CreateNewSessionBody {
    @NonNull
    private final String ak;
    @NonNull
    private final String bussinessDomain;
    @NonNull
    private final String bussinessType;
    @NonNull
    private final String bussinessId;
    @NonNull
    private final String assistantAccount;
    @Nullable
    private final String title;

    public CreateNewSessionBody(
            @NonNull String ak,
            @NonNull String bussinessDomain,
            @NonNull String bussinessType,
            @NonNull String bussinessId,
            @NonNull String assistantAccount,
            @Nullable String title
    ) {
        this.ak = ak;
        this.bussinessDomain = bussinessDomain;
        this.bussinessType = bussinessType;
        this.bussinessId = bussinessId;
        this.assistantAccount = assistantAccount;
        this.title = title;
    }

    @NonNull
    public String getAk() {
        return ak;
    }

    @NonNull
    public String getBussinessDomain() {
        return bussinessDomain;
    }

    @NonNull
    public String getBussinessType() {
        return bussinessType;
    }

    @NonNull
    public String getBussinessId() {
        return bussinessId;
    }

    @NonNull
    public String getAssistantAccount() {
        return assistantAccount;
    }

    @Nullable
    public String getTitle() {
        return title;
    }
}
