package com.opencode.skill.util;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.log.WeLinkLogger;
import com.opencode.skill.model.GetWeAgentUnreadMessageResult;
import com.opencode.skill.model.OnSessionViewingEndParams;
import com.opencode.skill.model.OnSessionViewingParams;
import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentSessionUnreadState;
import com.opencode.skill.network.ApiClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 维护当前助理的会话未读内存状态与助理页小红点。 */
public final class UnReadManager {
    private static final String TAG = "UnReadManager";
    @NonNull private final ApiClient apiClient;
    @NonNull private final WeAgentStorage weAgentStorage;
    @Nullable private ConnectivityManager connectivityManager;
    @Nullable private ConnectivityManager.NetworkCallback networkCallback;
    @Nullable private String partnerAccount;
    @Nullable private String bizRobotTag;
    @Nullable private String viewingSessionId;
    private boolean agentTabNotifyEnabled;
    private boolean myAgentUnread;
    private boolean networkAvailable;
    private boolean networkRefreshInFlight;
    @NonNull private final Map<String, WeAgentSessionUnreadState> sessionUnreadSet = new HashMap<>();
    @NonNull private final Map<String, Long> reportedReadSeqBySession = new HashMap<>();

    public UnReadManager(@NonNull ApiClient apiClient, @NonNull WeAgentStorage weAgentStorage) {
        this.apiClient = apiClient;
        this.weAgentStorage = weAgentStorage;
    }

    public synchronized void configure(@Nullable Context context) {
        unregisterNetworkStatusListener();
        connectivityManager = context == null ? null : (ConnectivityManager) context.getApplicationContext()
                .getSystemService(Context.CONNECTIVITY_SERVICE);
        networkAvailable = false;
    }

    /** SDK 初始化后异步加载当前助理未读状态，不阻塞初始化流程。 */
    public void initUnReadState() {
        agentTabNotifyEnabled = isAgentTabNotifyEnabled();
        if (!agentTabNotifyEnabled) {
            WeLinkLogger.i(TAG, "skip unread initialization: AgentTabNotify is unavailable");
            return;
        }
        registerImUnreadNotifications();
        registerNetworkStatusListener();
        WeAgentDetails currentDetail = weAgentStorage.getCurrentWeAgentDetail();
        if (currentDetail == null) {
            WeLinkLogger.i(TAG, "skip unread initialization: current we-agent detail is empty");
            return;
        }
        String account = SdkStringUtils.normalizeOptionalString(currentDetail.getPartnerAccount());
        if (account == null) {
            WeLinkLogger.i(TAG, "skip unread initialization: partnerAccount is empty");
            return;
        }
        String bizRobotTag = SdkStringUtils.normalizeOptionalString(currentDetail.getBizRobotTag());
        refreshCurrentAssistantUnread(account, bizRobotTag);
    }

    public void getWeAgentUnreadMessage(@NonNull String account, @Nullable List<String> sessionIds,
            @NonNull SkillCallback<GetWeAgentUnreadMessageResult> callback) {
        // 查询指定助理的未读会话，并在请求失败时优先返回当前助理内存缓存。
        WeLinkLogger.i(TAG, "query unread state, partnerAccount=" + account);
        requestWeAgentUnreadMessage(account, sessionIds, new SkillCallback<JsonElement>() {
            @Override public void onSuccess(@Nullable JsonElement result) {
                WeLinkLogger.i(TAG, "query unread state succeeded, partnerAccount=" + account);
                GetWeAgentUnreadMessageResult unreadResult = applyServerResult(
                        account, sessionIds, result, "server"
                );
                onUnReadedChanged("server", false);
                callback.onSuccess(unreadResult);
            }
            @Override public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "query unread state failed, partnerAccount=" + account + ", error=" + error.getMessage());
                GetWeAgentUnreadMessageResult cached = snapshot(account, "cache");
                if (cached == null) {
                    callback.onError(error);
                } else {
                    WeLinkLogger.i(TAG, "query unread state fallback succeeded, partnerAccount=" + account);
                    callback.onSuccess(cached);
                }
            }
        });
    }

    public void reportWeAgentSessionRead(@NonNull String sessionId, long readSeq,
            @NonNull SkillCallback<Void> callback) {
        // 按会话记录最大已读序号，避免重复向服务端上报。
        synchronized (this) {
            Long reported = reportedReadSeqBySession.get(sessionId);
            if (reported != null && readSeq <= reported) {
                WeLinkLogger.i(TAG, "report session read succeeded without request, sessionId=" + sessionId);
                callback.onSuccess(null);
                return;
            }
        }
        WeLinkLogger.i(TAG, "report session read, sessionId=" + sessionId + ", readSeq=" + readSeq);
        apiClient.reportWeAgentSessionRead(sessionId, readSeq, new SkillCallback<JsonElement>() {
            @Override public void onSuccess(@Nullable JsonElement ignored) {
                synchronized (UnReadManager.this) {
                    reportedReadSeqBySession.put(sessionId, readSeq);
                    setRead(sessionId, readSeq);
                }
                onUnReadedChanged("readReport", false);
                WeLinkLogger.i(TAG, "report session read succeeded, sessionId=" + sessionId);
                callback.onSuccess(null);
            }
            @Override public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "report session read failed, sessionId=" + sessionId
                        + ", error=" + error.getMessage());
                callback.onError(error);
            }
        });
    }

    public void onSessionViewing(@NonNull OnSessionViewingParams params) {
        // 页面正在查看会话时立即清除该会话本地未读状态。
        String sessionId = SdkStringUtils.normalizeOptionalString(params.getWelinkSessionId());
        if (sessionId == null) { return; }
        synchronized (this) { viewingSessionId = sessionId; setRead(sessionId, maxSeq(sessionId)); }
        onUnReadedChanged("sessionViewing");
        WeLinkLogger.i(TAG, "session viewing started, sessionId=" + sessionId);
    }

    public void onSessionViewingEnd(@NonNull OnSessionViewingEndParams params) {
        // 页面离开会话后清除查看态，恢复服务端未读通知处理。
        String sessionId = SdkStringUtils.normalizeOptionalString(params.getWelinkSessionId());
        synchronized (this) { if (sessionId != null && sessionId.equals(viewingSessionId)) { viewingSessionId = null; } }
        WeLinkLogger.i(TAG, "session viewing ended, sessionId=" + sessionId);
    }

    /** 会话删除后清理本地未读状态，并刷新助理 Tab 小红点。 */
    public void onSessionDeleted(@Nullable String rawSessionId) {
        String sessionId = SdkStringUtils.normalizeOptionalString(rawSessionId);
        if (sessionId == null) {
            WeLinkLogger.i(TAG, "ignore deleted session unread refresh: sessionId is empty");
            return;
        }
        boolean changed;
        synchronized (this) {
            changed = sessionUnreadSet.remove(sessionId) != null;
            changed = reportedReadSeqBySession.remove(sessionId) != null || changed;
            if (sessionId.equals(viewingSessionId)) {
                viewingSessionId = null;
                changed = true;
            }
        }
        if (!changed) {
            WeLinkLogger.i(TAG, "ignore deleted session unread refresh: session is not cached, sessionId=" + sessionId);
            return;
        }
        onUnReadedChanged("sessionDeleted");
        WeLinkLogger.i(TAG, "deleted session unread state cleared, sessionId=" + sessionId);
    }

    /** 助理切换后清空旧未读状态，并加载新助理的未读状态。 */
    public void onAssistantChanged(@Nullable WeAgentDetails assistantDetail) {
        String account = assistantDetail == null ? null
                : SdkStringUtils.normalizeOptionalString(assistantDetail.getPartnerAccount());
        String currentBizRobotTag = assistantDetail == null ? null
                : SdkStringUtils.normalizeOptionalString(assistantDetail.getBizRobotTag());
        clearUnreadState(account == null ? "" : account, currentBizRobotTag);
        if (!agentTabNotifyEnabled) {
            setHostWeAgentTabRedDot(false);
            WeLinkLogger.i(TAG, "skip unread refresh after assistant change: AgentTabNotify is unavailable");
            return;
        }
        if (account == null) {
            setHostWeAgentTabRedDot(false);
            WeLinkLogger.i(TAG, "skip unread refresh after assistant change: partnerAccount is empty");
            return;
        }
        onUnReadedChanged("assistantChanged");
        refreshCurrentAssistantUnread(account, currentBizRobotTag);
    }

    /** 处理宿主 IM 适配层解析后的未读通知。 */
    public boolean handleImUnreadNotifyData(@NonNull Map<String, Object> notifyData) {
        return handleEmployeeAssistantImUnreadNotifyData(notifyData)
                || handleCuiImUnreadNotifyData(notifyData);
    }

    /** 处理员工助手 uni-assistant 模块携带 un_read_count 的通知。 */
    public boolean handleEmployeeAssistantImUnreadNotifyData(@NonNull Map<String, Object> notifyData) {
        if (!isMyAgent(bizRobotTag) || !notifyData.containsKey("un_read_count")) {
            return false;
        }
        synchronized (this) {
            myAgentUnread = optionalLong(notifyData.get("un_read_count"), 0L) > 0L;
        }
        WeLinkLogger.i(TAG, "applied MyAgent IM unread notification, hasUnread=" + myAgentUnread);
        onUnReadedChanged("serverPush");
        return true;
    }

    /** 处理 CUI 服务端 welink-athena 的会话未读或已读通知。 */
    public boolean handleCuiImUnreadNotifyData(@NonNull Map<String, Object> notifyData) {
        String notifyType = SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(notifyData.get("notify_type"))
        );
        if (!"session.unread".equals(notifyType) && !"session.read".equals(notifyType)) {
            return false;
        }
        Object rawContent = notifyData.get("notyfy_content");
        if (!(rawContent instanceof Map)) {
            WeLinkLogger.e(TAG, "ignore unread IM notification: notyfy_content is invalid");
            return true;
        }
        Map<?, ?> content = (Map<?, ?>) rawContent;
        String account = SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(content.get("assistantAccount"))
        );
        String sessionId = SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(content.get("welinkSessionId"))
        );
        if (account == null || sessionId == null) {
            WeLinkLogger.e(TAG, "ignore unread IM notification: assistantAccount or welinkSessionId is missing");
            return true;
        }
        synchronized (this) {
            if (!account.equals(partnerAccount)) {
                WeLinkLogger.i(TAG, "ignore unread IM notification for inactive assistant, partnerAccount=" + account);
                return true;
            }
            long sequence = optionalLong(content.get("maxSeq"), maxSeq(sessionId));
            if ("session.unread".equals(notifyType)) {
                if (sessionId.equals(viewingSessionId)) {
                    WeLinkLogger.i(TAG, "ignore unread state for viewing session, sessionId=" + sessionId);
                    return true;
                }
                sessionUnreadSet.put(sessionId, new WeAgentSessionUnreadState(sessionId, true, sequence));
            } else {
                sessionUnreadSet.put(sessionId, new WeAgentSessionUnreadState(sessionId, false, sequence));
            }
        }
        WeLinkLogger.i(TAG, "applied IM unread notification, type=" + notifyType + ", sessionId=" + sessionId);
        onUnReadedChanged("serverPush");
        return true;
    }

    @Nullable
    private synchronized GetWeAgentUnreadMessageResult snapshot(@NonNull String account, @NonNull String source) {
        if (!account.equals(partnerAccount)) { return null; }
        return result(account, source);
    }

    @NonNull
    private synchronized GetWeAgentUnreadMessageResult applyServerResult(@NonNull String account,
            @Nullable List<String> requestedSessionIds, @Nullable JsonElement payload, @NonNull String source) {
        // 将服务端返回的全量未读结果转换为当前助理的会话内存缓存。
        partnerAccount = account;
        myAgentUnread = false;
        // 服务端全量结果覆盖当前助理的临时未读状态。
        sessionUnreadSet.clear();
        JsonArray list = payload != null && payload.isJsonObject()
                && payload.getAsJsonObject().has("unreadSessionList")
                && payload.getAsJsonObject().get("unreadSessionList").isJsonArray()
                ? payload.getAsJsonObject().getAsJsonArray("unreadSessionList") : new JsonArray();
        for (JsonElement item : list) {
            if (!item.isJsonObject()) { continue; }
            JsonObject value = item.getAsJsonObject();
            String sessionId = SdkStringUtils.normalizeOptionalString(value.has("sessionId") ? value.get("sessionId").getAsString() : null);
            if (sessionId == null) { continue; }
            long maxSeq = value.has("maxSeq") ? value.get("maxSeq").getAsLong() : 0L;
            sessionUnreadSet.put(sessionId, new WeAgentSessionUnreadState(sessionId, !sessionId.equals(viewingSessionId), maxSeq));
        }
        if (requestedSessionIds != null) for (String id : requestedSessionIds) {
            String sessionId = SdkStringUtils.normalizeOptionalString(id);
            if (sessionId != null && !sessionUnreadSet.containsKey(sessionId)) { setRead(sessionId, 0L); }
        }
        return result(account, source);
    }

    private void refreshCurrentAssistantUnread(@NonNull String account, @Nullable String bizRobotTag) {
        // 根据助理类型选择员工助手或 CUI 未读接口刷新当前状态。
        clearUnreadState(account, bizRobotTag);
        if (isUniAssistant(bizRobotTag)) {
            WeLinkLogger.i(TAG, "skip unread query for uniassistant, partnerAccount=" + account);
            return;
        }
        if (isMyAgent(bizRobotTag)) {
            requestMyAgentUnreadMessage(new SkillCallback<JsonElement>() {
                @Override
                public void onSuccess(@Nullable JsonElement payload) {
                    synchronized (UnReadManager.this) {
                        if (!account.equals(partnerAccount)) {
                            WeLinkLogger.i(TAG, "ignore stale MyAgent unread response, partnerAccount=" + account);
                            return;
                        }
                        myAgentUnread = payload != null
                                && payload.isJsonObject()
                                && payload.getAsJsonObject().has("un_read_count")
                                && payload.getAsJsonObject().get("un_read_count").getAsLong() > 0L;
                    }
                    WeLinkLogger.i(TAG, "initialized MyAgent unread state, partnerAccount=" + account);
                    onUnReadedChanged("server");
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    WeLinkLogger.e(TAG, "initialize MyAgent unread state failed, error=" + error.getMessage());
                }
            });
            return;
        }
        requestWeAgentUnreadMessage(account, null, new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement payload) {
                synchronized (UnReadManager.this) {
                    if (!account.equals(partnerAccount)) {
                        WeLinkLogger.i(TAG, "ignore stale CUI unread response, partnerAccount=" + account);
                        return;
                    }
                    applyServerResult(account, null, payload, "server");
                }
                WeLinkLogger.i(TAG, "initialized CUI unread state, partnerAccount=" + account);
                onUnReadedChanged("server");
            }

            @Override
            public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "initialize CUI unread state failed, error=" + error.getMessage());
            }
        });
    }

    private synchronized void clearUnreadState(@NonNull String account, @Nullable String currentBizRobotTag) {
        // 切换助理前清理旧助理的会话、查看态和已读上报记录。
        partnerAccount = account;
        bizRobotTag = currentBizRobotTag;
        viewingSessionId = null;
        myAgentUnread = false;
        sessionUnreadSet.clear();
        reportedReadSeqBySession.clear();
    }

    /** 仅在未读状态初始化时读取宿主 AgentTabNotify ABTest 权限。 */
    private boolean isAgentTabNotifyEnabled() {
        // 待接入：调用宿主 ABTest 能力获取 AgentTabNotify 权限。
        return false;
    }

    private void registerImUnreadNotifications() {
        // 待接入：注册宿主 IM 在线和离线未读通知监听。
    }

    private synchronized void registerNetworkStatusListener() {
        if (connectivityManager == null) {
            return;
        }
        unregisterNetworkStatusListener();
        networkAvailable = isNetworkAvailable();
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(@NonNull Network network, @NonNull NetworkCapabilities capabilities) {
                onNetworkAvailabilityChanged(isNetworkAvailable(capabilities));
            }

            @Override
            public void onLost(@NonNull Network network) {
                onNetworkAvailabilityChanged(false);
            }
        };
        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();
        connectivityManager.registerNetworkCallback(request, networkCallback);
    }

    public synchronized void shutdown() {
        unregisterNetworkStatusListener();
    }

    private synchronized void unregisterNetworkStatusListener() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (IllegalArgumentException ignored) {
                // 系统可能已注销该回调，此处无需额外处理。
            }
        }
        networkCallback = null;
    }

    private boolean isNetworkAvailable() {
        if (connectivityManager == null) {
            return false;
        }
        Network activeNetwork = connectivityManager.getActiveNetwork();
        return isNetworkAvailable(connectivityManager.getNetworkCapabilities(activeNetwork));
    }

    private boolean isNetworkAvailable(@Nullable NetworkCapabilities capabilities) {
        return capabilities != null
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void onNetworkAvailabilityChanged(boolean available) {
        // 仅识别从不可用到可用的网络状态变化。
        boolean reconnected;
        synchronized (this) {
            reconnected = !networkAvailable && available;
            networkAvailable = available;
        }
        if (reconnected) {
            onNetworkReconnected();
        }
    }

    private void onNetworkReconnected() {
        // 网络恢复后保留旧缓存，查询成功才覆盖未读状态并刷新小红点。
        final String account;
        final String currentBizRobotTag;
        synchronized (this) {
            if (!agentTabNotifyEnabled || partnerAccount == null || networkRefreshInFlight) {
                return;
            }
            if (isUniAssistant(bizRobotTag)) {
                WeLinkLogger.i(TAG, "skip network reconnect unread refresh, partnerAccount=" + partnerAccount);
                return;
            }
            account = partnerAccount;
            currentBizRobotTag = bizRobotTag;
            networkRefreshInFlight = true;
        }
        WeLinkLogger.i(TAG, "start network reconnect unread refresh, partnerAccount=" + account);
        if (isMyAgent(currentBizRobotTag)) {
            requestMyAgentUnreadMessage(new SkillCallback<JsonElement>() {
                @Override
                public void onSuccess(@Nullable JsonElement payload) {
                    boolean current;
                    synchronized (UnReadManager.this) {
                        current = account.equals(partnerAccount);
                        if (current) {
                            myAgentUnread = payload != null
                                    && payload.isJsonObject()
                                    && payload.getAsJsonObject().has("un_read_count")
                                    && payload.getAsJsonObject().get("un_read_count").getAsLong() > 0L;
                        }
                        networkRefreshInFlight = false;
                    }
                    if (!current) {
                        return;
                    }
                    WeLinkLogger.i(TAG, "network reconnect unread refresh succeeded, partnerAccount=" + account);
                    onUnReadedChanged("networkReconnect");
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    finishNetworkReconnectRefresh(error);
                }
            });
            return;
        }
        requestWeAgentUnreadMessage(account, null, new SkillCallback<JsonElement>() {
            @Override
            public void onSuccess(@Nullable JsonElement payload) {
                boolean current;
                synchronized (UnReadManager.this) {
                    current = account.equals(partnerAccount);
                    if (current) {
                        applyServerResult(account, null, payload, "networkReconnect");
                    }
                    networkRefreshInFlight = false;
                }
                if (!current) {
                    return;
                }
                WeLinkLogger.i(TAG, "network reconnect unread refresh succeeded, partnerAccount=" + account);
                onUnReadedChanged("networkReconnect");
            }

            @Override
            public void onError(@NonNull Throwable error) {
                finishNetworkReconnectRefresh(error);
            }
        });
    }

    private void finishNetworkReconnectRefresh(@NonNull Throwable error) {
        synchronized (this) {
            networkRefreshInFlight = false;
        }
        WeLinkLogger.e(TAG, "network reconnect unread refresh failed, error=" + error.getMessage());
    }

    private boolean isMyAgent(@Nullable String currentBizRobotTag) {
        return "myAgent".equals(currentBizRobotTag);
    }

    private boolean isUniAssistant(@Nullable String currentBizRobotTag) {
        return "uniassistant".equals(currentBizRobotTag);
    }

    private void requestWeAgentUnreadMessage(@NonNull String account, @Nullable List<String> sessionIds,
            @NonNull SkillCallback<JsonElement> callback) {
        apiClient.getWeAgentUnreadMessage(account, sessionIds, callback);
    }

    private void requestMyAgentUnreadMessage(@NonNull SkillCallback<JsonElement> callback) {
        apiClient.getMyAgentUnreadMessage(callback);
    }

    /** 未读缓存变更后刷新宿主助理页小红点，并向 CUI 广播最新状态。 */
    private void onUnReadedChanged(@NonNull String source) {
        onUnReadedChanged(source, true);
    }

    private void onUnReadedChanged(@NonNull String source, boolean shouldBroadcast) {
        String account = partnerAccount;
        if (account == null || !agentTabNotifyEnabled) {
            return;
        }
        GetWeAgentUnreadMessageResult snapshot = result(account, source);
        boolean showHostRedDot = shouldShowHostWeAgentTabRedDot();
        setHostWeAgentTabRedDot(showHostRedDot);
        if (shouldBroadcast) {
            broadcastUnreadChanged(snapshot);
        }
        WeLinkLogger.i(TAG, "unread state changed, source=" + source
                + ", partnerAccount=" + account + ", redDotVisible=" + snapshot.isRedDotVisible()
                + ", showHostRedDot=" + showHostRedDot);
    }

    private boolean shouldShowHostWeAgentTabRedDot() {
        // 结合权限、助理类型、未读状态和 Tab 聚焦状态计算是否显示小红点。
        if (!agentTabNotifyEnabled) {
            return false;
        }
        if (isUniAssistant(bizRobotTag)) {
            return false;
        }
        if (isMyAgent(bizRobotTag)) {
            return myAgentUnread && !isHostWeAgentTabFocused();
        }
        for (WeAgentSessionUnreadState state : sessionUnreadSet.values()) {
            if (state.isHasUnRead() && (!isHostWeAgentTabFocused()
                    || !state.getWelinkSessionId().equals(viewingSessionId))) {
                return true;
            }
        }
        return false;
    }

    private boolean isHostWeAgentTabFocused() {
        // 待接入：从宿主读取助理 Tab 是否处于聚焦状态。
        return false;
    }

    private void setHostWeAgentTabRedDot(boolean visible) {
        // 待接入：调用宿主适配层显示或隐藏助理 Tab 小红点。
    }

    private void broadcastUnreadChanged(@NonNull GetWeAgentUnreadMessageResult result) {
        // 待接入：调用 HWH5INNER.eventListener 广播助理未读状态。
    }

    private void setRead(@NonNull String sessionId, long sequence) {
        sessionUnreadSet.put(sessionId, new WeAgentSessionUnreadState(sessionId, false, Math.max(sequence, maxSeq(sessionId))));
    }

    private long optionalLong(@Nullable Object value, long fallback) {
        if (value instanceof Number) {
            return Math.max(((Number) value).longValue(), 0L);
        }
        if (value instanceof String) {
            try {
                return Math.max(Long.parseLong(((String) value).trim()), 0L);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
    private long maxSeq(@NonNull String sessionId) {
        WeAgentSessionUnreadState state = sessionUnreadSet.get(sessionId);
        return state == null ? 0L : state.getMaxSeq();
    }
    @NonNull private GetWeAgentUnreadMessageResult result(@NonNull String account, @NonNull String source) {
        List<WeAgentSessionUnreadState> sessions = new ArrayList<>(sessionUnreadSet.values());
        boolean unread = myAgentUnread;
        for (WeAgentSessionUnreadState state : sessions) { unread |= state.isHasUnRead(); }
        return new GetWeAgentUnreadMessageResult(account, unread, agentTabNotifyEnabled, sessions, source);
    }
}
