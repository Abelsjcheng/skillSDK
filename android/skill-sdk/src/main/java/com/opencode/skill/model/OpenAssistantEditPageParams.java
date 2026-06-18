package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class OpenAssistantEditPageParams {
    @NonNull
    private final String partnerAccount;

    /**
     * 创建编辑页参数，编辑页仅通过 partnerAccount 定位目标助理。
     */
    public OpenAssistantEditPageParams(@NonNull String partnerAccount) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }
}
