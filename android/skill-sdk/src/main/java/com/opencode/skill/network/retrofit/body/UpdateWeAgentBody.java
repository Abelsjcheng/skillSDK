package com.opencode.skill.network.retrofit.body;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

@Keep
public final class UpdateWeAgentBody {
    @NonNull
    private final String partnerAccount;
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;

    /**
     * 构造服务端助理更新请求体，仅携带 partnerAccount 和三个可编辑基础字段。
     */
    public UpdateWeAgentBody(
            @NonNull String partnerAccount,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description
    ) {
        this.partnerAccount = partnerAccount;
        this.name = name;
        this.icon = icon;
        this.description = description;
    }

    @NonNull
    public String getPartnerAccount() {
        return partnerAccount;
    }

    @NonNull
    public String getName() {
        return name;
    }

    @NonNull
    public String getIcon() {
        return icon;
    }

    @NonNull
    public String getDescription() {
        return description;
    }
}
