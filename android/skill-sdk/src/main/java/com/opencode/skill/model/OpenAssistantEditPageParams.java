package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.callback.AssistantDetailUpdatedCallback;

import java.util.Objects;

@Keep
public class OpenAssistantEditPageParams {
    @Nullable
    private final String partnerAccount;
    @Nullable
    private final String robotId;
    @NonNull
    private final AssistantDetailUpdatedCallback onUpdated;

    public OpenAssistantEditPageParams(
            @Nullable String partnerAccount,
            @Nullable String robotId,
            @NonNull AssistantDetailUpdatedCallback onUpdated
    ) {
        this.partnerAccount = partnerAccount;
        this.robotId = robotId;
        this.onUpdated = Objects.requireNonNull(onUpdated, "onUpdated == null");
    }

    @Nullable
    public String getPartnerAccount() {
        return partnerAccount;
    }

    @Nullable
    public String getRobotId() {
        return robotId;
    }

    @NonNull
    public AssistantDetailUpdatedCallback getOnUpdated() {
        return onUpdated;
    }
}
