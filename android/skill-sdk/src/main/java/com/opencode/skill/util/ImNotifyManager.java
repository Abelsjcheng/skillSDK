package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.opencode.skill.log.WeLinkLogger;

import java.util.Map;

/** Parses host IM notification envelopes before they enter assistant business handling. */
public final class ImNotifyManager {
    private static final String TAG = "SkillSDK";
    private static final String CUI_IM_NOTIFY_MODULE = "welink-athena";
    private static final String EMPLOYEE_ASSISTANT_IM_NOTIFY_MODULE = "uni-assistant";

    @NonNull
    private final Gson gson;
    @NonNull
    private final WeAgentManager weAgentManager;
    @NonNull
    private final UnReadManager unReadManager;

    public ImNotifyManager(
            @NonNull Gson gson,
            @NonNull WeAgentManager weAgentManager,
            @NonNull UnReadManager unReadManager
    ) {
        this.gson = gson;
        this.weAgentManager = weAgentManager;
        this.unReadManager = unReadManager;
    }

    /**
     * 接收宿主透传的 IM 助理变更通知。
     *
     * <p>方法先校验通知模块是否为 {@code welink-athena}，再将 {@code notifyData}
     * 转为业务对象；只有载荷合法时才继续分发更新或删除逻辑，异常和无关通知均直接忽略。</p>
     */
    public void handleWeAgentImNotifyBroadcast(@NonNull Map<String, Object> payload) {
        if (payload == null) {
            WeLinkLogger.e(TAG, "ignore we-agent IM notification: payload is null");
            return;
        }
        Map<String, Object> notifyData = getNotifyData(payload, CUI_IM_NOTIFY_MODULE);
        if (notifyData == null) {
            WeLinkLogger.i(TAG, "ignore we-agent IM notification: module does not match or notifyData parse failed");
            return;
        }
        WeLinkLogger.i(TAG, "we-agent IM notification parsed, enqueue server mutation");
        WeAgentManager.enqueueWeAgentCacheMutation(
                completion -> weAgentManager.handleWeAgentNotifyData(notifyData, "server", completion)
        );
    }

    /** Receives host IM unread notifications without entering assistant update/delete handling. */
    public void handleWeAgentUnreadImNotifyBroadcast(@NonNull Map<String, Object> payload) {
        if (payload == null) {
            WeLinkLogger.e(TAG, "ignore we-agent unread IM notification: payload is null");
            return;
        }
        String notifyModule = getNotifyModule(payload);
        if (!CUI_IM_NOTIFY_MODULE.equals(notifyModule)
                && !EMPLOYEE_ASSISTANT_IM_NOTIFY_MODULE.equals(notifyModule)) {
            WeLinkLogger.i(TAG, "ignore we-agent unread IM notification: notifyModuleId does not match");
            return;
        }
        Map<String, Object> notifyData = getNotifyData(payload, notifyModule);
        if (notifyData == null) {
            WeLinkLogger.i(TAG, "ignore we-agent unread IM notification: module does not match or notifyData parse failed");
            return;
        }
        boolean handled = EMPLOYEE_ASSISTANT_IM_NOTIFY_MODULE.equals(notifyModule)
                ? unReadManager.handleEmployeeAssistantImUnreadNotifyData(notifyData)
                : unReadManager.handleCuiImUnreadNotifyData(notifyData);
        if (!handled) {
            WeLinkLogger.i(TAG, "ignore we-agent unread IM notification: unsupported notify data");
        }
    }

    @Nullable
    private String getNotifyModule(@Nullable Map<String, Object> payload) {
        if (payload == null) {
            return null;
        }
        return SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(payload.get("notifyModuleId"))
        );
    }

    @Nullable
    private Map<String, Object> getNotifyData(
            @Nullable Map<String, Object> payload,
            @NonNull String expectedModule
    ) {
        if (payload == null || !expectedModule.equals(getNotifyModule(payload))) {
            return null;
        }
        Object notifyData = payload.get("notifyData");
        return TypeConvertUtils.valueAsMap(gson, notifyData);
    }
}
