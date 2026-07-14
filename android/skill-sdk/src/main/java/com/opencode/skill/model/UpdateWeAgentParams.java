package com.opencode.skill.model;

import androidx.annotation.Keep;
import androidx.annotation.NonNull;

import java.util.Objects;

@Keep
public class UpdateWeAgentParams {
    @NonNull
    private final String partnerAccount;
    @NonNull
    private final String name;
    @NonNull
    private final String icon;
    @NonNull
    private final String description;

    /**
     * 创建助理更新参数。
     *
     * <p>partnerAccount 是唯一定位标识，name、icon 和 description 是本次提交的完整基础字段。</p>
     */
    public UpdateWeAgentParams(
            @NonNull String partnerAccount,
            @NonNull String name,
            @NonNull String icon,
            @NonNull String description
    ) {
        this.partnerAccount = Objects.requireNonNull(partnerAccount, "partnerAccount == null");
        this.name = Objects.requireNonNull(name, "name == null");
        this.icon = Objects.requireNonNull(icon, "icon == null");
        this.description = Objects.requireNonNull(description, "description == null");
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
