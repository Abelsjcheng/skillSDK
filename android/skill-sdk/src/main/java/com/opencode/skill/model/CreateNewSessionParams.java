package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@Keep
public class CreateNewSessionParams {
    @NonNull
    private final String ak;
    @Nullable
    private final String title;
    @NonNull
    private final String bussinessDomain;
    @NonNull
    private final String bussinessType;
    @NonNull
    private final String bussinessId;
    @NonNull
    private final String assistantAccount;

    public CreateNewSessionParams(
            @NonNull String ak,
            @Nullable String title,
            @NonNull String bussinessDomain,
            @NonNull String bussinessType,
            @NonNull String bussinessId,
            @NonNull String assistantAccount
    ) {
        this.ak = ak;
        this.title = title;
        this.bussinessDomain = bussinessDomain;
        this.bussinessType = bussinessType;
        this.bussinessId = bussinessId;
        this.assistantAccount = assistantAccount;
    }

    @NonNull
    public String getAk() {
        return ak;
    }

    @Nullable
    public String getTitle() {
        return title;
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
}
