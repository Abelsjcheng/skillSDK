package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentUriResult;

/** Builds all assistant H5 and CUI URIs. The class name follows the existing SDK naming contract. */
public final class WeAgentUriBunilder {
    private static final String ASSISTANT_H5_URI = "h5://S008623/index.html";
    private static final String WE_AGENT_CUI_APPID = "S008623";

    private WeAgentUriBunilder() {
    }

    @NonNull
    public static String getAssistantH5Uri() {
        return ASSISTANT_H5_URI;
    }

    @NonNull
    public static String getWeAgentCuiAppId() {
        return WE_AGENT_CUI_APPID;
    }

    @NonNull
    public static WeAgentUriResult buildActivateAssistantFallbackUriResult() {
        String uri = SdkUriUtil.appendQueryParameter(ASSISTANT_H5_URI, "wecodePlace", "weAgent");
        uri = SdkUriUtil.appendHashFragment(uri, "activateAssistant");
        return new WeAgentUriResult(uri == null ? "" : uri, "", "");
    }

    @NonNull
    public static WeAgentUriResult buildLegacyWeAgentUriResult(@NonNull WeAgentDetails details) {
        String partnerAccount = SdkStringUtils.normalizeOptionalString(details.getPartnerAccount());
        String weCodeUrl = SdkStringUtils.normalizeOptionalString(details.getWeCodeUrl());
        String detailId = SdkStringUtils.normalizeOptionalString(details.getId());
        String weCodeUrlHost = SdkUriUtil.extractUriHost(weCodeUrl);
        String baseWeAgentUri = SdkUriUtil.appendQueryParameter(weCodeUrl, "wecodePlace", "weAgent");
        String weAgentUri;
        if (WE_AGENT_CUI_APPID.equalsIgnoreCase(weCodeUrlHost == null ? "" : weCodeUrlHost)) {
            weAgentUri = SdkUriUtil.appendQueryParameter(baseWeAgentUri, "assistantAccount", partnerAccount);
        } else {
            weAgentUri = SdkUriUtil.appendQueryParameter(baseWeAgentUri, "robotId", detailId);
        }

        String assistantDetailUri = SdkUriUtil.appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        assistantDetailUri = SdkUriUtil.appendHashFragment(assistantDetailUri, "assistantDetail");

        String switchAssistantUri = SdkUriUtil.appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        switchAssistantUri = SdkUriUtil.appendHashFragment(switchAssistantUri, "switchAssistant");

        return new WeAgentUriResult(
                weAgentUri == null ? "" : weAgentUri,
                assistantDetailUri == null ? "" : assistantDetailUri,
                switchAssistantUri == null ? "" : switchAssistantUri
        );
    }

    @NonNull
    public static WeAgentUriResult buildMyAgentWeAgentUriResult(@NonNull WeAgentDetails details) {
        String partnerAccount = SdkStringUtils.normalizeOptionalString(details.getPartnerAccount());
        String weAgentUri = SdkUriUtil.appendQueryParameter(details.getWeCodeUrl(), "wecodePlace", "weAgent");
        weAgentUri = SdkUriUtil.appendQueryParameter(weAgentUri, "from", "weAgent");
        String assistantDetailUri = SdkUriUtil.appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        assistantDetailUri = SdkUriUtil.appendHashFragment(assistantDetailUri, "assistantDetail");
        String switchAssistantUri = SdkUriUtil.appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        switchAssistantUri = SdkUriUtil.appendHashFragment(switchAssistantUri, "switchAssistant");
        return new WeAgentUriResult(
                weAgentUri == null ? "" : weAgentUri,
                assistantDetailUri == null ? "" : assistantDetailUri,
                switchAssistantUri == null ? "" : switchAssistantUri
        );
    }

    public static boolean isMyAgentDetail(@Nullable WeAgentDetails detail) {
        return detail != null
                && "myagent".equalsIgnoreCase(SdkStringUtils.normalizeOptionalString(detail.getBizRobotTag()));
    }
}
