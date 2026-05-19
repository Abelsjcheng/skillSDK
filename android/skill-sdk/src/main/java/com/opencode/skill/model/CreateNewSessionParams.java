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
    @Nullable
    private final String bussinessDomain;
    @Nullable
    private final String bussinessType;
    @NonNull
    private final String bussinessId;
    @Nullable
    private final String assistantAccount;

    public CreateNewSessionParams(
            @Nullable String ak,
            @Nullable String title,
            @Nullable String bussinessDomain,
            @Nullable String bussinessType,
            @NonNull String bussinessId,
            @Nullable String assistantAccount
    ) {
        this.ak = ak;
        this.title = title;
        this.bussinessDomain = bussinessDomain;
        this.bussinessType = bussinessType;
        this.bussinessId = bussinessId;
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
}
