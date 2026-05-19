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
    @Nullable
    private final String bussinessDomain;
    @NonNull
    private final String bussinessId;
    @Nullable
    private final String bussinessType;
    @Nullable
    private final String assistantAccount;

    public CreateSessionParams(
            @Nullable String ak,
            @Nullable String title,
            @Nullable String bussinessDomain,
            @NonNull String bussinessId,
            @Nullable String bussinessType,
            @Nullable String assistantAccount
    ) {
        this.ak = ak;
        this.title = title;
        this.bussinessDomain = bussinessDomain;
        this.bussinessId = bussinessId;
        this.bussinessType = bussinessType;
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

    @NonNull
    public String getBussinessId() {
        return bussinessId;
    }

    @Nullable
    public String getBussinessType() {
        return bussinessType;
    }

    @Nullable
    public String getAssistantAccount() {
        return assistantAccount;
    }
}
