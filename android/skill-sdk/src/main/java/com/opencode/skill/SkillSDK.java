package com.opencode.skill;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.opencode.skill.callback.SessionListener;
import com.opencode.skill.callback.SessionStatusCallback;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.callback.SkillWecodeStatusCallback;
import com.opencode.skill.constant.MessageType;
import com.opencode.skill.constant.SessionStatus;
import com.opencode.skill.constant.SkillWecodeStatus;
import com.opencode.skill.log.WeLinkLogger;
import com.opencode.skill.model.AgentTypeListResult;
import com.opencode.skill.model.CloseSkillResult;
import com.opencode.skill.model.ControlSkillWeCodeParams;
import com.opencode.skill.model.ControlSkillWeCodeResult;
import com.opencode.skill.model.CreateDigitalTwinParams;
import com.opencode.skill.model.CreateDigitalTwinResult;
import com.opencode.skill.model.CreateNewSessionParams;
import com.opencode.skill.model.CreateSessionParams;
import com.opencode.skill.model.CursorResult;
import com.opencode.skill.model.DeleteWeAgentParams;
import com.opencode.skill.model.DeleteWeAgentResult;
import com.opencode.skill.model.GetSessionMessageParams;
import com.opencode.skill.model.GetSessionMessageHistoryParams;
import com.opencode.skill.model.GetIsShowWeAgentResult;
import com.opencode.skill.model.GetWeAgentUnreadMessageParams;
import com.opencode.skill.model.GetWeAgentUnreadMessageResult;
import com.opencode.skill.model.HistorySessionsParams;
import com.opencode.skill.model.OnSessionStatusChangeParams;
import com.opencode.skill.model.OnAssistantChangedParams;
import com.opencode.skill.model.OnSessionViewingEndParams;
import com.opencode.skill.model.OnSessionViewingEndResult;
import com.opencode.skill.model.OnSessionViewingParams;
import com.opencode.skill.model.OnSessionViewingResult;
import com.opencode.skill.model.OpenAssistantEditPageParams;
import com.opencode.skill.model.OpenAssistantEditPageResult;
import com.opencode.skill.model.OpenWeAgentParams;
import com.opencode.skill.model.OpenWeAgentResult;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.PageParams;
import com.opencode.skill.model.QrcodeInfo;
import com.opencode.skill.model.QueryAssistantGraySingleParams;
import com.opencode.skill.model.QueryAssistantGraySingleResult;
import com.opencode.skill.model.QueryWeAgentParams;
import com.opencode.skill.model.QueryQrcodeInfoParams;
import com.opencode.skill.model.RegisterSessionListenerParams;
import com.opencode.skill.model.RegisterSessionListenerResult;
import com.opencode.skill.model.ReplyPermissionParams;
import com.opencode.skill.model.ReplyPermissionResult;
import com.opencode.skill.model.ReportWeAgentSessionReadParams;
import com.opencode.skill.model.ReportWeAgentSessionReadResult;
import com.opencode.skill.model.RegenerateAnswerParams;
import com.opencode.skill.model.SendMessageParams;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMParams;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SessionStatusResult;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.Session;
import com.opencode.skill.model.SkillWecodeStatusResult;
import com.opencode.skill.model.StopSkillParams;
import com.opencode.skill.model.StopSkillResult;
import com.opencode.skill.model.StreamMessage;
import com.opencode.skill.model.SetIsShowWeAgentParams;
import com.opencode.skill.model.SetIsShowWeAgentResult;
import com.opencode.skill.model.UnregisterSessionListenerParams;
import com.opencode.skill.model.UnregisterSessionListenerResult;
import com.opencode.skill.model.UpdateQrcodeInfoParams;
import com.opencode.skill.model.UpdateQrcodeInfoResult;
import com.opencode.skill.model.UpdateWeAgentParams;
import com.opencode.skill.model.UpdateWeAgentResult;
import com.opencode.skill.model.WeAgentDetailsArrayResult;
import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentListResult;
import com.opencode.skill.model.WeAgentUriResult;
import com.opencode.skill.network.ApiClient;
import com.opencode.skill.network.WebSocketManager;
import com.opencode.skill.util.ImNotifyManager;
import com.opencode.skill.util.SdkStringUtils;
import com.opencode.skill.util.SdkUriUtil;
import com.opencode.skill.util.SessionMessageHelper;
import com.opencode.skill.util.TypeConvertUtils;
import com.opencode.skill.util.UnReadManager;
import com.opencode.skill.util.WeAgentManager;
import com.opencode.skill.util.WeAgentStorage;
import com.opencode.skill.util.WeAgentUriBunilder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Singleton SDK exposing public APIs from SkillClientSdkInterfaceV1.md.
 */
public final class SkillSDK {
    private static volatile SkillSDK instance;
    private static final String TAG = "SkillSDK";
    @NonNull
    private final Gson gson = new Gson();
    @NonNull
    private final ApiClient apiClient = new ApiClient();
    @NonNull
    private final WebSocketManager webSocketManager = WebSocketManager.getInstance();
    @NonNull
    private final WeAgentStorage weAgentStorage = new WeAgentStorage();
    @NonNull
    private final WeAgentManager weAgentManager = new WeAgentManager(gson, apiClient, weAgentStorage);
    @NonNull
    private final UnReadManager unReadManager = new UnReadManager(apiClient, weAgentStorage);
    @NonNull
    private final ImNotifyManager imNotifyManager = new ImNotifyManager(gson, weAgentManager, unReadManager);
    @NonNull
    private final Map<String, SessionStatusCallback> sessionStatusCallbacks = new ConcurrentHashMap<>();
    @NonNull
    private final Map<String, SessionStatus> lastSessionStatusBySession = new ConcurrentHashMap<>();
    @NonNull
    private final CopyOnWriteArrayList<SkillWecodeStatusCallback> wecodeStatusCallbacks = new CopyOnWriteArrayList<>();
    @NonNull
    private final Map<String, ListenerBinding> listenerBindings = new ConcurrentHashMap<>();
    @NonNull
    private final Map<String, Boolean> awaitingExecutingBySession = new ConcurrentHashMap<>();
    @NonNull
    private final Map<String, Boolean> stoppedHoldingBySession = new ConcurrentHashMap<>();

    @Nullable
    private SkillSDKConfig config;

    @NonNull
    private final WebSocketManager.InternalListener internalStreamListener = new WebSocketManager.InternalListener() {
        @Override
        public void onMessage(@NonNull StreamMessage message) {
            emitSessionStatusByEvent(message);
            if ("session.deleted".equals(message.getType())) {
                unReadManager.onSessionDeleted(message.getWelinkSessionId());
            }
        }

        @Override
        public void onError(@NonNull SessionError error) {
            // Keep callback-level errors on registered session listeners.
        }

        @Override
        public void onClosed(@Nullable String reason) {
            // No-op.
        }
    };

    private SkillSDK() {
    }

    @NonNull
    public static SkillSDK getInstance() {
        if (instance == null) {
            synchronized (SkillSDK.class) {
                if (instance == null) {
                    instance = new SkillSDK();
                }
            }
        }
        return instance;
    }

    public synchronized void initialize(@NonNull SkillSDKConfig config) {
        this.config = config;
        apiClient.configure(config);
        webSocketManager.configure(config);
        weAgentStorage.configure(config.getContext());
        unReadManager.configure(config.getContext());
        webSocketManager.removeInternalListener(internalStreamListener);
        webSocketManager.addInternalListener(internalStreamListener);
        weAgentManager.refreshWeAgentsOnColdStart();
        unReadManager.initUnReadState();
    }

    public boolean isInitialized() {
        return config != null;
    }

    // 1. createSession
    public void createSession(@NonNull CreateSessionParams params, @NonNull SkillCallback<Session> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        final CreateSessionParams normalizedParams;
        try {
            String businessSessionDomain = TypeConvertUtils.requireString(
                    params.getBusinessSessionDomain(),
                    "businessSessionDomain"
            );
            String businessSessionId = TypeConvertUtils.requireString(params.getBusinessSessionId(), "businessSessionId");
            String businessSessionType = TypeConvertUtils.requireString(
                    params.getBusinessSessionType(),
                    "businessSessionType"
            );
            String ak = TypeConvertUtils.optionalString(params.getAk());
            String title = TypeConvertUtils.optionalString(params.getTitle());
            String assistantAccount = TypeConvertUtils.optionalString(params.getAssistantAccount());
            normalizedParams = new CreateSessionParams(
                    ak,
                    title,
                    businessSessionDomain,
                    businessSessionId,
                    businessSessionType,
                    assistantAccount
            );
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                String optionalAk = normalizedParams.getAk();
                String optionalAssistantAccount = normalizedParams.getAssistantAccount();
                String businessSessionDomain = normalizedParams.getBusinessSessionDomain();
                HistorySessionsParams historyParams = new HistorySessionsParams(
                        0,
                        50,
                        null,
                        optionalAk,
                        normalizedParams.getBusinessSessionId(),
                        optionalAssistantAccount,
                        businessSessionDomain
                );
                apiClient.getHistorySessionsList(historyParams, new SkillCallback<PageResult<Session>>() {
                            @Override
                            public void onSuccess(@Nullable PageResult<Session> pageResult) {
                                Session reused = selectLatestReusableSession(pageResult == null ? null : pageResult.getContent());
                                if (reused != null) {
                                    callback.onSuccess(reused);
                                    return;
                                }

                                CreateSessionParams createParams = new CreateSessionParams(
                                        optionalAk,
                                        normalizedParams.getTitle(),
                                        normalizedParams.getBusinessSessionDomain(),
                                        normalizedParams.getBusinessSessionId(),
                                        normalizedParams.getBusinessSessionType(),
                                        optionalAssistantAccount
                                );
                                apiClient.createSession(createParams, new SkillCallback<Session>() {
                                    @Override
                                    public void onSuccess(@Nullable Session session) {
                                        if (session == null) {
                                            callback.onError(error(7000, "Create session returned empty data"));
                                            return;
                                        }
                                        callback.onSuccess(session);
                                    }

                                    @Override
                                    public void onError(@NonNull Throwable error) {
                                        callback.onError(wrapError(error));
                                    }
                                });
                            }

                            @Override
                            public void onError(@NonNull Throwable error) {
                                callback.onError(wrapError(error));
                            }
                        });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 2. closeSkill
    public void closeSkill(@NonNull SkillCallback<CloseSkillResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (!webSocketManager.isConnected()) {
            callback.onError(error(3000, "WebSocket is not connected"));
            return;
        }

        Exception disconnectException = null;
        try {
            webSocketManager.disconnect();
        } catch (Exception e) {
            disconnectException = e;
        }

        Exception cleanupException = null;
        try {
            webSocketManager.clearAllListeners();
            listenerBindings.clear();
            sessionStatusCallbacks.clear();
            lastSessionStatusBySession.clear();
            awaitingExecutingBySession.clear();
            stoppedHoldingBySession.clear();
        } catch (Exception e) {
            cleanupException = e;
        }

        if (disconnectException != null || cleanupException != null) {
            StringBuilder messageBuilder = new StringBuilder("Close skill failed");
            if (disconnectException != null) {
                messageBuilder.append(", disconnect error: ").append(disconnectException.getMessage());
            }
            if (cleanupException != null) {
                messageBuilder.append(", cleanup error: ").append(cleanupException.getMessage());
            }
            callback.onError(error(5000, messageBuilder.toString()));
            return;
        }

        callback.onSuccess(new CloseSkillResult("success"));
    }

    // 3. stopSkill
    public void stopSkill(@NonNull StopSkillParams params, @NonNull SkillCallback<StopSkillResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (SdkStringUtils.isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.abortSession(params.getWelinkSessionId(), new SkillCallback<StopSkillResult>() {
                    @Override
                    public void onSuccess(@Nullable StopSkillResult result) {
                        StopSkillResult resolved = result == null
                                ? new StopSkillResult(params.getWelinkSessionId(), "aborted")
                                : result;
                        awaitingExecutingBySession.put(params.getWelinkSessionId(), Boolean.FALSE);
                        stoppedHoldingBySession.put(params.getWelinkSessionId(), Boolean.TRUE);
                        emitSessionStatus(params.getWelinkSessionId(), SessionStatus.STOPPED);
                        callback.onSuccess(resolved);
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 4. onSessionStatusChange
    public void onSessionStatusChange(@NonNull OnSessionStatusChangeParams params) {
        ensureInitializedForVoid();
        if (SdkStringUtils.isBlank(params.getWelinkSessionId()) || params.getCallback() == null) {
            throw error(1000, "welinkSessionId and callback are required");
        }
        sessionStatusCallbacks.put(params.getWelinkSessionId(), params.getCallback());
    }

    // 5. onSkillWecodeStatusChange
    public void onSkillWecodeStatusChange(@NonNull SkillWecodeStatusCallback callback) {
        ensureInitializedForVoid();
        if (callback == null) {
            throw error(1000, "callback is required");
        }
        wecodeStatusCallbacks.addIfAbsent(callback);
    }

    // 5.1. offSkillWecodeStatusChange
    public void offSkillWecodeStatusChange(@NonNull SkillWecodeStatusCallback callback) {
        ensureInitializedForVoid();
        if (callback == null) {
            throw error(1000, "callback is required");
        }
        boolean removed = wecodeStatusCallbacks.remove(callback);
        WeLinkLogger.i(TAG, "offSkillWecodeStatusChange remove callback, removed="
                + removed + ", remaining=" + wecodeStatusCallbacks.size());
    }

    // 6. regenerateAnswer
    public void regenerateAnswer(@NonNull RegenerateAnswerParams params, @NonNull SkillCallback<SendMessageResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (SdkStringUtils.isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.getMessages(params.getWelinkSessionId(), 0, 100, new SkillCallback<PageResult<SessionMessage>>() {
                    @Override
                    public void onSuccess(@Nullable PageResult<SessionMessage> result) {
                        PageResult<SessionMessage> page = result == null ? new PageResult<>() : result;
                        String latest = SessionMessageHelper.findLatestUserMessageContent(page.getContent());
                        if (latest == null || latest.trim().isEmpty()) {
                            callback.onError(error(4002, "No user message to regenerate"));
                            return;
                        }
                        sendMessageInternal(
                                params.getWelinkSessionId(),
                                latest,
                                null,
                                null,
                                null,
                                null,
                                callback
                        );
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 7. sendMessageToIM
    public void sendMessageToIM(@NonNull SendMessageToIMParams params,
            @NonNull SkillCallback<SendMessageToIMResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (SdkStringUtils.isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }
        String directContent = params.getContent();
        String normalizedChatId = SdkStringUtils.normalizeOptionalString(params.getChatId());
        if (directContent != null && directContent.trim().isEmpty()) {
            callback.onError(error(1000, "content is invalid"));
            return;
        }
        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                tryResolveSendToImContent(params, new SkillCallback<String>() {
                    @Override
                    public void onSuccess(@Nullable String content) {
                        if (content == null || content.trim().isEmpty()) {
                            callback.onError(error(4005, "No completed message content found"));
                            return;
                        }
                        apiClient.sendMessageToIM(params.getWelinkSessionId(), content, normalizedChatId,
                                new SkillCallback<SendMessageToIMResult>() {
                            @Override
                            public void onSuccess(@Nullable SendMessageToIMResult result) {
                                callback.onSuccess(result == null ? new SendMessageToIMResult(false) : result);
                            }

                            @Override
                            public void onError(@NonNull Throwable error) {
                                callback.onError(wrapError(error));
                            }
                        });
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 8. getSessionMessage
    public void getSessionMessage(@NonNull GetSessionMessageParams params,
            @NonNull SkillCallback<PageResult<SessionMessage>> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (SdkStringUtils.isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }
        int page = Math.max(params.getPage(), 0);
        int size = params.getSize() <= 0 ? 50 : params.getSize();

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.getMessages(params.getWelinkSessionId(), page, size, new SkillCallback<PageResult<SessionMessage>>() {
                    @Override
                    public void onSuccess(@Nullable PageResult<SessionMessage> result) {
                        PageResult<SessionMessage> serverPage = SessionMessageHelper.normalizeSessionMessagePage(result, page, size);
                        callback.onSuccess(serverPage);
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 8.1 getSessionMessageHistory
    public void getSessionMessageHistory(
            @NonNull GetSessionMessageHistoryParams params,
            @NonNull SkillCallback<CursorResult<SessionMessage>> callback
    ) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        final String welinkSessionId;
        final Integer beforeSeq;
        final int size;
        try {
            welinkSessionId = TypeConvertUtils.requireString(params.getWelinkSessionId(), "welinkSessionId");
            beforeSeq = TypeConvertUtils.optionalInteger(params.getBeforeSeq(), "beforeSeq");
            if (beforeSeq != null && beforeSeq < 0) {
                callback.onError(error(1000, "beforeSeq must be greater than or equal to 0"));
                return;
            }
            size = TypeConvertUtils.toPositiveInt(params.getSize(), 50, "size");
        } catch (SkillSdkException exception) {
            callback.onError(exception);
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.getMessagesHistory(
                        welinkSessionId,
                        beforeSeq,
                        size,
                        new SkillCallback<CursorResult<SessionMessage>>() {
                            @Override
                            public void onSuccess(@Nullable CursorResult<SessionMessage> result) {
                                CursorResult<SessionMessage> cursorResult = SessionMessageHelper.normalizeSessionMessageCursor(result, size);
                                callback.onSuccess(cursorResult);
                                if (beforeSeq == null) {
                                    // beforeSeq 为空视为首屏历史请求；历史成功返回后自动补发一次 resume。
                                    webSocketManager.sendResume(welinkSessionId);
                                }
                            }

                            @Override
                            public void onError(@NonNull Throwable error) {
                                callback.onError(wrapError(error));
                            }
                        }
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 9. registerSessionListener
    public RegisterSessionListenerResult registerSessionListener(@NonNull RegisterSessionListenerParams params) {
        ensureInitializedForVoid();
        if (SdkStringUtils.isBlank(params.getWelinkSessionId()) || params.getOnMessage() == null) {
            throw error(1000, "welinkSessionId and onMessage are required");
        }

        SessionListener listener = new SessionListener() {
            @Override
            public void onMessage(@NonNull StreamMessage message) {
                params.getOnMessage().onMessage(message);
            }

            @Override
            public void onError(@Nullable SessionError error) {
                if (error != null && params.getOnError() != null) {
                    params.getOnError().onError(error);
                }
            }

            @Override
            public void onClose(@Nullable String reason) {
                if (params.getOnClose() != null) {
                    params.getOnClose().onClose(reason);
                }
            }
        };

        ListenerBinding binding = new ListenerBinding(listener);
        ListenerBinding previous = listenerBindings.put(params.getWelinkSessionId(), binding);
        if (previous != null) {
            webSocketManager.unregisterListener(params.getWelinkSessionId(), previous.sessionListener);
        }
        webSocketManager.registerListener(params.getWelinkSessionId(), listener);
        return new RegisterSessionListenerResult("success");
    }

    // 10. unregisterSessionListener
    public UnregisterSessionListenerResult unregisterSessionListener(@NonNull UnregisterSessionListenerParams params) {
        ensureInitializedForVoid();
        if (SdkStringUtils.isBlank(params.getWelinkSessionId())) {
            throw error(1000, "welinkSessionId is required");
        }

        ListenerBinding binding = listenerBindings.remove(params.getWelinkSessionId());
        if (binding != null) {
            webSocketManager.unregisterListener(params.getWelinkSessionId(), binding.sessionListener);
        }
        return new UnregisterSessionListenerResult("success");
    }

    // 11. sendMessage
    public void sendMessage(@NonNull SendMessageParams params, @NonNull SkillCallback<SendMessageResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (SdkStringUtils.isBlank(params.getWelinkSessionId()) || params.getContent().trim().isEmpty()) {
            callback.onError(error(1000, "welinkSessionId and content are required"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                sendMessageInternal(
                        params.getWelinkSessionId(),
                        params.getContent(),
                        params.getToolCallId(),
                        params.getQuestionId(),
                        params.getSubagentSessionId(),
                        params.getBusinessExtParam(),
                        callback
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 12. replyPermission
    public void replyPermission(@NonNull ReplyPermissionParams params,
            @NonNull SkillCallback<ReplyPermissionResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (SdkStringUtils.isBlank(params.getWelinkSessionId()) || params.getPermId().trim().isEmpty() || params.getResponse().trim().isEmpty()) {
            callback.onError(error(1000, "welinkSessionId, permId and response are required"));
            return;
        }
        if (!SdkStringUtils.isPermissionResponseValid(params.getResponse())) {
            callback.onError(error(1000, "response must be once/always/reject"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.replyPermission(
                        params.getWelinkSessionId(),
                        params.getPermId(),
                        params.getResponse(),
                        params.getSubagentSessionId(),
                        params.getBusinessExtParam(),
                        new SkillCallback<ReplyPermissionResult>() {
                            @Override
                            public void onSuccess(@Nullable ReplyPermissionResult result) {
                                callback.onSuccess(result);
                            }

                            @Override
                            public void onError(@NonNull Throwable error) {
                                callback.onError(wrapError(error));
                            }
                        });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 13. controlSkillWeCode
    public void controlSkillWeCode(@NonNull ControlSkillWeCodeParams params,
            @NonNull SkillCallback<ControlSkillWeCodeResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params.getAction() == null) {
            callback.onError(error(1000, "action is required"));
            return;
        }

        SkillWecodeStatus status = params.getAction().getValue().equals("close")
                ? SkillWecodeStatus.CLOSED
                : SkillWecodeStatus.MINIMIZED;
        emitWecodeStatus(status, null);
        callback.onSuccess(new ControlSkillWeCodeResult("success"));
    }

    // 14. createNewSession
    public void createNewSession(@NonNull CreateNewSessionParams params, @NonNull SkillCallback<Session> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }

        final CreateNewSessionParams normalizedParams;
        try {
            String businessSessionDomain = TypeConvertUtils.requireString(
                    params.getBusinessSessionDomain(),
                    "businessSessionDomain"
            );
            String businessSessionType = TypeConvertUtils.requireString(
                    params.getBusinessSessionType(),
                    "businessSessionType"
            );
            String businessSessionId = TypeConvertUtils.requireString(params.getBusinessSessionId(), "businessSessionId");
            String ak = TypeConvertUtils.optionalString(params.getAk());
            String assistantAccount = TypeConvertUtils.optionalString(params.getAssistantAccount());
            String title = TypeConvertUtils.optionalString(params.getTitle());
            normalizedParams = new CreateNewSessionParams(
                    ak,
                    title,
                    businessSessionDomain,
                    businessSessionType,
                    businessSessionId,
                    assistantAccount
            );
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.createNewSession(normalizedParams, new SkillCallback<Session>() {
                    @Override
                    public void onSuccess(@Nullable Session session) {
                        if (session == null) {
                            callback.onError(error(7000, "Create session returned empty data"));
                            return;
                        }
                        callback.onSuccess(session);
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 15. getHistorySessionsList
    public void getHistorySessionsList(@NonNull HistorySessionsParams params,
            @NonNull SkillCallback<PageResult<Session>> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }

        final HistorySessionsParams requestParams;
        String status;
        String businessSessionDomain;
        try {
            status = TypeConvertUtils.optionalString(params.getStatus());
            if (status != null) {
                status = status.toUpperCase(Locale.ROOT);
            }
            int page = TypeConvertUtils.toNonNegativeInt(params.getPage(), 0, "page");
            int size = TypeConvertUtils.toPositiveInt(params.getSize(), 50, "size");
            String ak = TypeConvertUtils.optionalString(params.getAk());
            String businessSessionId = TypeConvertUtils.optionalString(params.getBusinessSessionId());
            String assistantAccount = TypeConvertUtils.optionalString(params.getAssistantAccount());
            businessSessionDomain = TypeConvertUtils.optionalString(params.getBusinessSessionDomain());
            requestParams = new HistorySessionsParams(
                    page,
                    size,
                    status,
                    ak,
                    businessSessionId,
                    assistantAccount,
                    businessSessionDomain
            );
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        if (status != null && !SdkStringUtils.isSessionRecordStatusValid(status)) {
            callback.onError(error(1000, "status must be ACTIVE/IDLE/CLOSED"));
            return;
        }
        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.getHistorySessionsList(requestParams, new SkillCallback<PageResult<Session>>() {
                    @Override
                    public void onSuccess(@Nullable PageResult<Session> result) {
                        PageResult<Session> pageResult = result == null ? new PageResult<>() : result;
                        callback.onSuccess(pageResult);
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 16. createDigitalTwin
    public void createDigitalTwin(@NonNull CreateDigitalTwinParams params,
            @NonNull SkillCallback<CreateDigitalTwinResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String name;
        final String icon;
        final String description;
        final Integer weCrewType;
        final String bizRobotId;
        final String qrcode;
        try {
            name = TypeConvertUtils.requireString(params.getName(), "name");
            icon = TypeConvertUtils.requireString(params.getIcon(), "icon");
            description = TypeConvertUtils.requireString(params.getDescription(), "description");
            weCrewType = TypeConvertUtils.optionalInteger(params.getWeCrewType(), "weCrewType");
            bizRobotId = TypeConvertUtils.optionalString(params.getBizRobotId());
            qrcode = TypeConvertUtils.optionalString(params.getQrcode());
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        if (weCrewType != null && weCrewType != 0 && weCrewType != 1) {
            callback.onError(error(1000, "weCrewType must be 0 or 1"));
            return;
        }

        apiClient.createDigitalTwin(name, icon, description, weCrewType, bizRobotId, qrcode,
                new SkillCallback<CreateDigitalTwinResult>() {
                    @Override
                    public void onSuccess(@Nullable CreateDigitalTwinResult result) {
                        CreateDigitalTwinResult resolved = result == null ? new CreateDigitalTwinResult() : result;
                        if (SdkStringUtils.isBlank(resolved.getMessage())) {
                            resolved.setMessage("success");
                        }
                        callback.onSuccess(resolved);
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onError(wrapError(error));
                    }
                });
    }

    // 17. getAgentType
    public void getAgentType(@NonNull SkillCallback<AgentTypeListResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        apiClient.getAgentType(new SkillCallback<AgentTypeListResult>() {
            @Override
            public void onSuccess(@Nullable AgentTypeListResult result) {
                AgentTypeListResult resolved = result == null ? new AgentTypeListResult() : result;
                callback.onSuccess(resolved);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 18. getWeAgentList
    public void getWeAgentList(@NonNull PageParams params, @NonNull SkillCallback<WeAgentListResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final int pageSize;
        final int pageNumber;
        try {
            pageSize = TypeConvertUtils.requireInteger(params.getPageSize(), "pageSize");
            pageNumber = TypeConvertUtils.requireInteger(params.getPageNumber(), "pageNumber");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }
        if (pageSize <= 0 || pageNumber <= 0) {
            callback.onError(error(1000, "pageSize and pageNumber must be positive integers"));
            return;
        }
        final int safePageSize = SdkStringUtils.clamp(pageSize, 1, 100);
        final int safePageNumber = SdkStringUtils.clamp(pageNumber, 1, 1000);

        apiClient.getWeAgentList(safePageSize, safePageNumber, new SkillCallback<WeAgentListResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentListResult result) {
                WeAgentListResult resolved = result == null ? new WeAgentListResult() : result;
                weAgentStorage.saveWeAgentList(resolved.getContent());
                callback.onSuccess(resolved);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 19. getWeAgentDetails
    public void getWeAgentDetails(@NonNull QueryWeAgentParams params,
            @NonNull SkillCallback<WeAgentDetailsArrayResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getPartnerAccount(), "partnerAccount");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                WeAgentDetailsArrayResult resolved = WeAgentManager.resolveWeAgentDetailsResult(result);
                weAgentManager.cacheWeAgentDetailsResult(partnerAccount, resolved);
                callback.onSuccess(resolved);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 19.1. getAssistantDetails
    public void getAssistantDetails(@NonNull QueryWeAgentParams params,
            @NonNull SkillCallback<WeAgentDetailsArrayResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getPartnerAccount(), "partnerAccount");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        WeAgentDetails cached = weAgentStorage.getWeAgentDetails(partnerAccount);
        if (cached != null) {
            WeAgentDetailsArrayResult cachedResult = WeAgentManager.wrapWeAgentDetail(cached);
            callback.onSuccess(cachedResult);
            weAgentManager.refreshAssistantDetailsCache(partnerAccount);
            return;
        }

        apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                WeAgentDetailsArrayResult resolved = WeAgentManager.resolveWeAgentDetailsResult(result);
                weAgentManager.cacheWeAgentDetailsResult(partnerAccount, resolved, false);
                callback.onSuccess(resolved);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    /**
     * 读取当前助理完整详情。
     *
     * <p>方法仅访问本地 current_we_agent_detail 缓存，不发起网络请求或回写缓存。返回前复制缓存对象，
     * 并仅对缺失的 tagName、tagNameEn 分别使用“助手”和“Agent”兜底。</p>
     */
    @NonNull
    public WeAgentDetails getWeAgentInfo() {
        WeAgentDetails cachedDetail = weAgentStorage.getCurrentWeAgentDetail();
        WeAgentDetails result = cachedDetail == null
                ? new WeAgentDetails()
                : cachedDetail;
        if (SdkStringUtils.normalizeOptionalString(result.getTagName()) == null) {
            result.setTagName("助手");
        }
        if (SdkStringUtils.normalizeOptionalString(result.getTagNameEn()) == null) {
            result.setTagNameEn("Agent");
        }
        WeLinkLogger.i(TAG, "getWeAgentInfo succeeded, partnerAccount="
                + result.getPartnerAccount()
                + ", tagName=" + result.getTagName()
                + ", tagNameEn=" + result.getTagNameEn());
        return result;
    }

    // 20. getWeAgentUri
    public void getWeAgentUri(@NonNull SkillCallback<WeAgentUriResult> callback) {
        if (callback == null) {
            throw new IllegalArgumentException("callback == null");
        }
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        weAgentManager.buildWeAgentUriResult(
                weAgentStorage.getCurrentWeAgentDetail(),
                callback
        );
    }

    // 21. updateWeAgent
    public void updateWeAgent(@NonNull UpdateWeAgentParams params,
            @NonNull SkillCallback<UpdateWeAgentResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getPartnerAccount(), "partnerAccount");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        final String name;
        final String icon;
        final String description;
        try {
            name = TypeConvertUtils.requireString(params.getName(), "name");
            icon = TypeConvertUtils.requireString(params.getIcon(), "icon");
            description = TypeConvertUtils.requireString(params.getDescription(), "description");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        apiClient.updateWeAgent(partnerAccount, name, icon, description, new SkillCallback<UpdateWeAgentResult>() {
            @Override
            public void onSuccess(@Nullable UpdateWeAgentResult result) {
                WeLinkLogger.i(TAG, "updateWeAgent request succeeded, enqueue cache mutation, partnerAccount="
                        + partnerAccount);
                Map<String, Object> data = new HashMap<>();
                data.put("partnerAccount", partnerAccount);
                data.put("name", name);
                data.put("icon", icon);
                data.put("description", description);
                WeAgentManager.enqueueWeAgentCacheMutation(completion -> {
                    weAgentStorage.updateCachedWeAgentDetails(partnerAccount, name, icon, description);
                    weAgentManager.broadcastWeAgentEvent(
                            WeAgentManager.getWeAgentEventName(),
                            WeAgentManager.buildWeAgentPayload("update", data, "local"),
                            new SkillCallback<Void>() {
                                @Override
                                public void onSuccess(@Nullable Void ignored) {
                                    try {
                                        callback.onSuccess(result);
                                    } finally {
                                        completion.onSuccess(null);
                                    }
                                }

                                @Override
                                public void onError(@NonNull Throwable error) {
                                    try {
                                        callback.onError(error);
                                    } finally {
                                        completion.onError(error);
                                    }
                                }
                            }
                    );
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "updateWeAgent request failed, partnerAccount=" + partnerAccount
                        + ", error=" + error.getMessage());
                callback.onError(wrapError(error));
            }
        });
    }

    // 22. deleteWeAgent
    public void deleteWeAgent(@NonNull DeleteWeAgentParams params,
            @NonNull SkillCallback<DeleteWeAgentResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getPartnerAccount(), "partnerAccount");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        WeAgentManager.DeleteWeAgentContext context = weAgentManager.buildDeleteWeAgentContext(partnerAccount);
        weAgentManager.requestDeleteWeAgent(context, new SkillCallback<DeleteWeAgentResult>() {
            @Override
            public void onSuccess(@Nullable DeleteWeAgentResult result) {
                WeLinkLogger.i(TAG, "deleteWeAgent request succeeded, enqueue cache mutation, partnerAccount="
                        + partnerAccount);
                WeAgentManager.enqueueWeAgentCacheMutation(
                        completion -> weAgentManager.handleDeleteWeAgentResult(context, result, callback, completion)
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "deleteWeAgent request failed, partnerAccount=" + partnerAccount
                        + ", error=" + error.getMessage());
                callback.onError(wrapError(error));
            }
        });
    }

    public void handleWeAgentImNotifyBroadcast(@NonNull Map<String, Object> payload) {
        imNotifyManager.handleWeAgentImNotifyBroadcast(payload);
    }

    /** 单独处理宿主 IM 未读通知，不进入助理更新或删除流程。 */
    public void handleWeAgentUnreadImNotifyBroadcast(@NonNull Map<String, Object> payload) {
        imNotifyManager.handleWeAgentUnreadImNotifyBroadcast(payload);
    }

    public void getWeAgentUnreadMessage(@NonNull GetWeAgentUnreadMessageParams params,
            @NonNull SkillCallback<GetWeAgentUnreadMessageResult> callback) {
        if (!isInitialized()) {
            WeLinkLogger.e(TAG, "getWeAgentUnreadMessage failed: SkillSDK is not initialized");
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (!unReadManager.isAgentTabNotifyEnabled()) {
            WeLinkLogger.e(TAG, "getWeAgentUnreadMessage failed: AgentTabNotify is unavailable");
            callback.onError(error(4011, "Permission denied: AgentTabNotify is disabled"));
            return;
        }
        if (params == null) {
            WeLinkLogger.e(TAG, "getWeAgentUnreadMessage failed: params is required");
            callback.onError(error(1000, "params is required"));
            return;
        }
        final String partnerAccount;
        final List<String> sessionIds;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getAssistantAccount(), "assistantAccount");
            sessionIds = TypeConvertUtils.optionalStringList(params.getSessionIds(), "sessionIds");
        } catch (SkillSdkException error) {
            WeLinkLogger.e(TAG, "getWeAgentUnreadMessage failed, error=" + error.getErrorMessage());
            callback.onError(error);
            return;
        }
        unReadManager.getWeAgentUnreadMessage(partnerAccount, sessionIds, new SkillCallback<GetWeAgentUnreadMessageResult>() {
            @Override public void onSuccess(@Nullable GetWeAgentUnreadMessageResult result) {
                WeLinkLogger.i(TAG, "getWeAgentUnreadMessage succeeded");
                callback.onSuccess(result);
            }
            @Override public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "getWeAgentUnreadMessage failed, error=" + error.getMessage());
                callback.onError(wrapError(error));
            }
        });
    }

    public void reportWeAgentSessionRead(@NonNull ReportWeAgentSessionReadParams params,
            @NonNull SkillCallback<ReportWeAgentSessionReadResult> callback) {
        if (!isInitialized()) {
            WeLinkLogger.e(TAG, "reportWeAgentSessionRead failed: SkillSDK is not initialized");
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (!unReadManager.isAgentTabNotifyEnabled()) {
            WeLinkLogger.e(TAG, "reportWeAgentSessionRead failed: AgentTabNotify is unavailable");
            callback.onError(error(4011, "Permission denied: AgentTabNotify is disabled"));
            return;
        }
        if (params == null) {
            WeLinkLogger.e(TAG, "reportWeAgentSessionRead failed: params is required");
            callback.onError(error(1000, "params is required"));
            return;
        }
        final String sessionId;
        try {
            sessionId = TypeConvertUtils.requireString(params.getWelinkSessionId(), "welinkSessionId");
        } catch (SkillSdkException error) {
            WeLinkLogger.e(TAG, "reportWeAgentSessionRead failed, error=" + error.getErrorMessage());
            callback.onError(error);
            return;
        }
        long readSeq = params.getReadSeq();
        if (readSeq <= 0) {
            WeLinkLogger.e(TAG, "reportWeAgentSessionRead failed: readSeq must be a positive integer");
            callback.onError(error(1000, "readSeq must be a positive integer"));
            return;
        }
        unReadManager.reportWeAgentSessionRead(sessionId, readSeq, new SkillCallback<Void>() {
            @Override public void onSuccess(@Nullable Void ignored) {
                WeLinkLogger.i(TAG, "reportWeAgentSessionRead succeeded");
                callback.onSuccess(new ReportWeAgentSessionReadResult("success"));
            }
            @Override public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "reportWeAgentSessionRead failed, error=" + error.getMessage());
                callback.onError(wrapError(error));
            }
        });
    }

    public void onSessionViewing(@NonNull OnSessionViewingParams params,
            @NonNull SkillCallback<OnSessionViewingResult> callback) {
        if (!isInitialized()) {
            WeLinkLogger.e(TAG, "onSessionViewing failed: SkillSDK is not initialized");
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (!unReadManager.isAgentTabNotifyEnabled()) {
            WeLinkLogger.e(TAG, "onSessionViewing failed: AgentTabNotify is unavailable");
            callback.onError(error(4011, "Permission denied: AgentTabNotify is disabled"));
            return;
        }
        unReadManager.onSessionViewing(params);
        WeLinkLogger.i(TAG, "onSessionViewing succeeded, sessionId=" + params.getWelinkSessionId());
        callback.onSuccess(new OnSessionViewingResult("success"));
    }

    public void onSessionViewingEnd(@NonNull OnSessionViewingEndParams params,
            @NonNull SkillCallback<OnSessionViewingEndResult> callback) {
        if (!isInitialized()) {
            WeLinkLogger.e(TAG, "onSessionViewingEnd failed: SkillSDK is not initialized");
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (!unReadManager.isAgentTabNotifyEnabled()) {
            WeLinkLogger.e(TAG, "onSessionViewingEnd failed: AgentTabNotify is unavailable");
            callback.onError(error(4011, "Permission denied: AgentTabNotify is disabled"));
            return;
        }
        unReadManager.onSessionViewingEnd(params);
        WeLinkLogger.i(TAG, "onSessionViewingEnd succeeded, sessionId=" + params.getWelinkSessionId());
        callback.onSuccess(new OnSessionViewingEndResult("success"));
    }

    /** 宿主切换当前助理后通知 SDK 刷新未读状态。 */
    public void onAssistantChanged(@NonNull OnAssistantChangedParams params) {
        unReadManager.onAssistantChanged(params.getAssistantDetail());
        WeLinkLogger.i(TAG, "onAssistantChanged succeeded");
    }

    // 23. setIsShowWeAgent
    public void setIsShowWeAgent(@NonNull SetIsShowWeAgentParams params,
            @NonNull SkillCallback<SetIsShowWeAgentResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        boolean isShowWeAgent = params.isShowWeAgent();
        // TODO: save isShowWeAgent by calling host saveSettings.
        // TODO: broadcast isShowWeAgent change to host.
        if (isShowWeAgent) {
            // TODO: open we-agent tab by calling host capability.
        } else {
            // TODO: close we-agent tab by calling host capability.
        }
        callback.onSuccess(new SetIsShowWeAgentResult("success"));
    }

    // 24. getIsShowWeAgent
    public void getIsShowWeAgent(@NonNull SkillCallback<GetIsShowWeAgentResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (callback == null) {
            throw new IllegalArgumentException("callback == null");
        }

        // TODO: read isShowWeAgent by calling host getSettings.
        callback.onSuccess(new GetIsShowWeAgentResult(false));
    }

    // 25. openWeAgent
    public void openWeAgent(@NonNull OpenWeAgentParams params,
            @NonNull SkillCallback<OpenWeAgentResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount = SdkStringUtils.normalizeOptionalString(params.getPartnerAccount());

        // TODO: save isShowWeAgent = true by calling host saveSettings.
        // TODO: broadcast isShowWeAgent = true to host.
        if (partnerAccount != null) {
            getAssistantDetails(new QueryWeAgentParams(partnerAccount), new SkillCallback<WeAgentDetailsArrayResult>() {
                @Override
                public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                    WeAgentDetailsArrayResult resolved = WeAgentManager.resolveWeAgentDetailsResult(result);
                    WeAgentDetails targetDetail = resolved.getWeAgentDetailsArray().isEmpty()
                            ? null
                            : resolved.getWeAgentDetailsArray().get(0);
                    if (targetDetail == null) {
                        callback.onError(error(7000, "getAssistantDetails returned empty detail"));
                        return;
                    }
                    String weCodeUrl = SdkStringUtils.normalizeOptionalString(targetDetail.getWeCodeUrl());
                    if (weCodeUrl == null) {
                        callback.onError(error(7000, "getAssistantDetails returned empty weCodeUrl"));
                        return;
                    }
                    weAgentStorage.saveCurrentWeAgentDetail(targetDetail);
                    weAgentManager.buildWeAgentUriResult(targetDetail, new SkillCallback<WeAgentUriResult>() {
                        @Override
                        public void onSuccess(@Nullable WeAgentUriResult uris) {
                            // TODO: open we-agent tab by calling host capability.
                            // TODO: call host openWeAgentCUI with uris.weAgentUri, uris.assistantDetailUri and uris.switchAssistantUri.
                            callback.onSuccess(new OpenWeAgentResult("success"));
                        }

                        @Override
                        public void onError(@NonNull Throwable error) {
                            callback.onError(wrapError(error));
                        }
                    });
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    callback.onError(wrapError(error));
                }
            });
            return;
        }

        getWeAgentUri(new SkillCallback<WeAgentUriResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentUriResult uris) {
                // TODO: open we-agent tab by calling host capability.
                // TODO: call host openWeAgentCUI with uris.weAgentUri, uris.assistantDetailUri and uris.switchAssistantUri.
                callback.onSuccess(new OpenWeAgentResult("success"));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 26. openAssistantEditPage
    public void openAssistantEditPage(@NonNull OpenAssistantEditPageParams params,
            @NonNull SkillCallback<OpenAssistantEditPageResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getPartnerAccount(), "partnerAccount");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        Context context = config == null ? null : config.getContext();
        if (context == null) {
            callback.onError(error(5000, "context is required"));
            return;
        }

        try {
            String uri = buildAssistantEditPageUri(partnerAccount);
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            callback.onSuccess(new OpenAssistantEditPageResult("success"));
        } catch (Throwable throwable) {
            callback.onError(wrapError(throwable));
        }
    }

    // 27. queryQrcodeInfo
    public void queryQrcodeInfo(@NonNull QueryQrcodeInfoParams params,
            @NonNull SkillCallback<QrcodeInfo> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String qrcode;
        try {
            qrcode = TypeConvertUtils.requireString(params.getQrcode(), "qrcode");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        apiClient.queryQrcodeInfo(qrcode, new SkillCallback<QrcodeInfo>() {
            @Override
            public void onSuccess(@Nullable QrcodeInfo result) {
                callback.onSuccess(result);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 28. updateQrcodeInfo
    public void updateQrcodeInfo(@NonNull UpdateQrcodeInfoParams params,
            @NonNull SkillCallback<UpdateQrcodeInfoResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String qrcode;
        final String robotId = SdkStringUtils.normalizeOptionalString(params.getRobotId());
        final int status;
        try {
            qrcode = TypeConvertUtils.requireString(params.getQrcode(), "qrcode");
            status = TypeConvertUtils.requireInteger(params.getStatus(), "status");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        apiClient.updateQrcodeInfo(qrcode, robotId, status, new SkillCallback<UpdateQrcodeInfoResult>() {
            @Override
            public void onSuccess(@Nullable UpdateQrcodeInfoResult result) {
                callback.onSuccess(result);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 29. queryAssistantGraySingle
    public void queryAssistantGraySingle(@NonNull QueryAssistantGraySingleParams params,
            @NonNull SkillCallback<QueryAssistantGraySingleResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params == null) {
            callback.onError(error(1000, "params is required"));
            return;
        }

        final String partnerAccount;
        try {
            partnerAccount = TypeConvertUtils.requireString(params.getPartnerAccount(), "partnerAccount");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        Boolean cached = weAgentStorage.getAssistantGraySingle(partnerAccount);
        if (cached != null) {
            callback.onSuccess(new QueryAssistantGraySingleResult(cached));
            weAgentManager.refreshAssistantGraySingleCache(partnerAccount);
            return;
        }

        apiClient.queryAssistantGraySingle(partnerAccount, new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                boolean resolved = result != null && result;
                weAgentStorage.saveAssistantGraySingle(partnerAccount, resolved);
                callback.onSuccess(new QueryAssistantGraySingleResult(resolved));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    public synchronized void shutdown() {
        webSocketManager.removeInternalListener(internalStreamListener);
        unReadManager.shutdown();
        webSocketManager.shutdown();
        apiClient.shutdown();
        listenerBindings.clear();
        sessionStatusCallbacks.clear();
        lastSessionStatusBySession.clear();
        wecodeStatusCallbacks.clear();
        awaitingExecutingBySession.clear();
        stoppedHoldingBySession.clear();
        WeAgentManager.shutdown();
        config = null;
    }

    private void sendMessageInternal(
            @NonNull String welinkSessionId,
            @NonNull String content,
            @Nullable String toolCallId,
            @Nullable String questionId,
            @Nullable String subagentSessionId,
            @Nullable com.google.gson.JsonObject businessExtParam,
            @NonNull SkillCallback<SendMessageResult> callback) {
        awaitingExecutingBySession.put(welinkSessionId, Boolean.TRUE);
        apiClient.sendMessage(
                welinkSessionId,
                content,
                toolCallId,
                questionId,
                subagentSessionId,
                businessExtParam,
                new SkillCallback<SendMessageResult>() {
            @Override
            public void onSuccess(@Nullable SendMessageResult result) {
                if (result == null) {
                    awaitingExecutingBySession.put(welinkSessionId, Boolean.FALSE);
                }
                callback.onSuccess(result);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                awaitingExecutingBySession.put(welinkSessionId, Boolean.FALSE);
                callback.onError(wrapError(error));
            }
        });
    }

    private void tryResolveSendToImContent(@NonNull SendMessageToIMParams params,
            @NonNull SkillCallback<String> callback) {
        String directContent = SdkStringUtils.normalizeOptionalString(params.getContent());
        if (directContent != null) {
            callback.onSuccess(directContent);
            return;
        }
        apiClient.getMessagesHistory(params.getWelinkSessionId(), null, 100, new SkillCallback<CursorResult<SessionMessage>>() {
            @Override
            public void onSuccess(@Nullable CursorResult<SessionMessage> result) {
                CursorResult<SessionMessage> page = result == null ? new CursorResult<>() : result;
                String content = SessionMessageHelper.resolveSendToImContent(page.getContent());
                if (content != null && !content.trim().isEmpty()) {
                    callback.onSuccess(content);
                    return;
                }
                callback.onError(error(4005, "No completed message found"));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    private void ensureConnected(@NonNull SkillCallback<Boolean> callback) {
        if (webSocketManager.isConnected()) {
            callback.onSuccess(Boolean.TRUE);
            return;
        }
        webSocketManager.connect(callback);
    }

    private void emitSessionStatusByEvent(@NonNull StreamMessage message) {
        String sessionId = SdkStringUtils.normalizeOptionalString(message.getWelinkSessionId());
        if (sessionId == null) {
            return;
        }
        SessionStatus mapped = mapStatus(sessionId, message);
        if (mapped == null) {
            return;
        }
        emitSessionStatus(sessionId, mapped);
    }

    private void emitSessionStatus(@NonNull String sessionId, @NonNull SessionStatus status) {
        SessionStatus lastStatus = lastSessionStatusBySession.get(sessionId);
        if (lastStatus == status) {
            return;
        }
        lastSessionStatusBySession.put(sessionId, status);
        SessionStatusCallback callback = sessionStatusCallbacks.get(sessionId);
        if (callback == null) {
            return;
        }
        SessionStatusResult result = new SessionStatusResult(status);
        callback.onStatusChange(result);
    }

    private void emitWecodeStatus(@NonNull SkillWecodeStatus status, @Nullable String message) {
        SkillWecodeStatusResult result = new SkillWecodeStatusResult(status, System.currentTimeMillis(), message);
        for (SkillWecodeStatusCallback callback : new ArrayList<>(wecodeStatusCallbacks)) {
            callback.onStatusChange(result);
        }
    }

    @Nullable
    private SessionStatus mapStatus(@NonNull String sessionId, @NonNull StreamMessage message) {
        String type = message.getType();
        if (type == null) {
            return null;
        }
        switch (type) {
            case MessageType.SESSION_STATUS:
                String sessionStatus = message.getSessionStatus();
                if (sessionStatus == null) {
                    return null;
                }
                if ("busy".equalsIgnoreCase(sessionStatus) || "retry".equalsIgnoreCase(sessionStatus)) {
                    if (Boolean.TRUE.equals(awaitingExecutingBySession.get(sessionId))) {
                        stoppedHoldingBySession.put(sessionId, Boolean.FALSE);
                        return SessionStatus.EXECUTING;
                    }
                    return null;
                }
                if ("idle".equalsIgnoreCase(sessionStatus)) {
                    awaitingExecutingBySession.put(sessionId, Boolean.FALSE);
                    // Keep STOPPED after stopSkill; ignore idle until a new round enters busy/retry.
                    if (Boolean.TRUE.equals(stoppedHoldingBySession.get(sessionId))) {
                        return null;
                    }
                    return SessionStatus.COMPLETED;
                }
                return null;
            default:
                return null;
        }
    }

    @Nullable
    private Session selectLatestReusableSession(@Nullable List<Session> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return null;
        }
        return sessions.stream()
                .filter(session -> !"CLOSED".equalsIgnoreCase(session.getStatus()))
                .max(Comparator.comparing(this::safeUpdatedAt))
                .orElse(null);
    }

    @NonNull
    private Instant safeUpdatedAt(@NonNull Session session) {
        try {
            return Instant.parse(session.getUpdatedAt());
        } catch (Exception ignored) {
            return Instant.EPOCH;
        }
    }

    private void ensureInitializedForVoid() {
        if (!isInitialized()) {
            throw error(5000, "SkillSDK is not initialized");
        }
    }

    @NonNull
    private SkillSdkException wrapError(@NonNull Throwable error) {
        if (error instanceof SkillSdkException) {
            return (SkillSdkException) error;
        }
        return new SkillSdkException(5000, error.getMessage() == null ? "Internal error" : error.getMessage(), error);
    }

    @NonNull
    private SkillSdkException error(int code, @NonNull String message) {
        return new SkillSdkException(code, message);
    }

    @NonNull
    /**
     * 构造助理编辑页 URI，仅使用必填 partnerAccount 作为定位参数。
     */
    private String buildAssistantEditPageUri(@NonNull String partnerAccount) {
        String uri = SdkUriUtil.appendHashFragment(WeAgentUriBunilder.getAssistantH5Uri(), "editAssistant");
        String withPartnerAccount = SdkUriUtil.appendQueryParameter(uri, "partnerAccount", partnerAccount.trim());
        if (withPartnerAccount == null) {
            throw error(5000, "Failed to build assistant edit page uri");
        }
        return withPartnerAccount;
    }

    private static final class ListenerBinding {
        @NonNull
        private final SessionListener sessionListener;

        private ListenerBinding(@NonNull SessionListener sessionListener) {
            this.sessionListener = sessionListener;
        }
    }
}
