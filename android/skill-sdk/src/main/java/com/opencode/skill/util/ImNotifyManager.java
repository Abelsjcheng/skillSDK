package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.opencode.skill.log.WeLinkLogger;

import java.util.Map;

/** Parses host IM notification envelopes before they enter assistant business handling. */
public final class ImNotifyManager {
    private static final String TAG = "SkillSDK";
    private static final String IM_NOTIFY_MODULE = "welink-athena";

    @NonNull
    private final Gson gson;
    @NonNull
    private final WeAgentManager weAgentManager;

    public ImNotifyManager(@NonNull Gson gson, @NonNull WeAgentManager weAgentManager) {
        this.gson = gson;
        this.weAgentManager = weAgentManager;
    }

    /**
     * 接收宿主透传的 IM 助理变更通知。
     *
     * <p>方法先校验通知模块是否为 {@code welink-athena}，再将 {@code notify_data}
     * 转为业务对象；只有载荷合法时才继续分发更新或删除逻辑，异常和无关通知均直接忽略。</p>
     */
    public void handleWeAgentImNotifyBroadcast(@NonNull Map<String, Object> payload) {
        if (payload == null) {
            WeLinkLogger.e(TAG, "ignore we-agent IM notification: payload is null");
            return;
        }
        Map<String, Object> notifyData = getNotifyData(payload);
        if (notifyData == null) {
            WeLinkLogger.i(TAG, "ignore we-agent IM notification: module does not match or notify_data parse failed");
            return;
        }
        WeLinkLogger.i(TAG, "we-agent IM notification parsed, enqueue server mutation");
        WeAgentManager.enqueueWeAgentCacheMutation(
                completion -> weAgentManager.handleWeAgentNotifyData(notifyData, "server", completion)
        );
    }

    @Nullable
    private Map<String, Object> getNotifyData(@Nullable Map<String, Object> payload) {
        if (payload == null) {
            return null;
        }
        String module = SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(payload.get("notify_module"))
        );
        if (!IM_NOTIFY_MODULE.equals(module)) {
            return null;
        }
        return TypeConvertUtils.valueAsMap(gson, payload.get("notify_data"));
    }
}
