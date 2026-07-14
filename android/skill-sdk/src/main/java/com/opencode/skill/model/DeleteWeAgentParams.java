package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class DeleteWeAgentParams {
    @NonNull
    private final String partnerAccount;

    /**
     * 创建删除助理参数，partnerAccount 是服务端和缓存定位助理的唯一标识。
     */
    public DeleteWeAgentParams(@NonNull String partnerAccount) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }
}
