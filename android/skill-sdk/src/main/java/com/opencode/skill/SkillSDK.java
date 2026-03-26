package com.opencode.skill;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.callback.SessionListener;
import com.opencode.skill.callback.SessionStatusCallback;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.callback.SkillWecodeStatusCallback;
import com.opencode.skill.constant.MessageType;
import com.opencode.skill.constant.SessionStatus;
import com.opencode.skill.constant.SkillWecodeStatus;
import com.opencode.skill.model.AgentTypeListResult;
import com.opencode.skill.model.CloseSkillResult;
import com.opencode.skill.model.ControlSkillWeCodeParams;
import com.opencode.skill.model.ControlSkillWeCodeResult;
import com.opencode.skill.model.CreateDigitalTwinParams;
import com.opencode.skill.model.CreateDigitalTwinResult;
import com.opencode.skill.model.CreateNewSessionParams;
import com.opencode.skill.model.CreateSessionParams;
import com.opencode.skill.model.GetSessionMessageParams;
import com.opencode.skill.model.HistorySessionsParams;
import com.opencode.skill.model.OnSessionStatusChangeParams;
import com.opencode.skill.model.OnSkillWecodeStatusChangeParams;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.PageParams;
import com.opencode.skill.model.QueryWeAgentParams;
import com.opencode.skill.model.RegisterSessionListenerParams;
import com.opencode.skill.model.RegisterSessionListenerResult;
import com.opencode.skill.model.ReplyPermissionParams;
import com.opencode.skill.model.ReplyPermissionResult;
import com.opencode.skill.model.RegenerateAnswerParams;
import com.opencode.skill.model.SendMessageParams;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMParams;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SessionStatusResult;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.model.SkillWecodeStatusResult;
import com.opencode.skill.model.StopSkillParams;
import com.opencode.skill.model.StopSkillResult;
import com.opencode.skill.model.StreamMessage;
import com.opencode.skill.model.UnregisterSessionListenerParams;
import com.opencode.skill.model.UnregisterSessionListenerResult;
import com.opencode.skill.model.WeAgentDetailsArrayResult;
import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentListResult;
import com.opencode.skill.model.WeAgentUriResult;
import com.opencode.skill.network.ApiClient;
import com.opencode.skill.network.StreamingMessageCache;
import com.opencode.skill.network.WebSocketManager;
import com.opencode.skill.util.TypeConvertUtils;
import com.opencode.skill.util.WeAgentStorage;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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
    private static final String ASSISTANT_H5_URI = "h5://123456/html/index.html";

    @NonNull
    private final ApiClient apiClient = new ApiClient();
    @NonNull
    private final WebSocketManager webSocketManager = WebSocketManager.getInstance();
    @NonNull
    private final StreamingMessageCache streamingMessageCache = new StreamingMessageCache();
    @NonNull
    private final WeAgentStorage weAgentStorage = new WeAgentStorage();

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
            streamingMessageCache.ingestStreamMessage(message);
            emitSessionStatusByEvent(message);
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
        webSocketManager.removeInternalListener(internalStreamListener);
        webSocketManager.addInternalListener(internalStreamListener);
    }

    public boolean isInitialized() {
        return config != null;
    }

    // 1. createSession
    public void createSession(@NonNull CreateSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (isBlank(params.getImGroupId())) {
            callback.onError(error(1000, "imGroupId is required"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                String optionalAk = normalizeOptionalString(params.getAk());
                apiClient.listSessions(params.getImGroupId(), optionalAk, "ACTIVE", 0, 20,
                        new SkillCallback<PageResult<SkillSession>>() {
                            @Override
                            public void onSuccess(@Nullable PageResult<SkillSession> pageResult) {
                                SkillSession reused = selectLatestActiveSession(pageResult == null ? null : pageResult.getContent(), params);
                                if (reused != null) {
                                    callback.onSuccess(reused);
                                    return;
                                }

                                apiClient.createSession(params, new SkillCallback<SkillSession>() {
                                    @Override
                                    public void onSuccess(@Nullable SkillSession session) {
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
            streamingMessageCache.clearAll();
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
        if (isBlank(params.getWelinkSessionId())) {
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
        if (isBlank(params.getWelinkSessionId()) || params.getCallback() == null) {
            throw error(1000, "welinkSessionId and callback are required");
        }
        sessionStatusCallbacks.put(params.getWelinkSessionId(), params.getCallback());
    }

    // 5. onSkillWecodeStatusChange
    public void onSkillWecodeStatusChange(@NonNull OnSkillWecodeStatusChangeParams params) {
        ensureInitializedForVoid();
        if (params.getCallback() == null) {
            throw error(1000, "callback is required");
        }
        wecodeStatusCallbacks.addIfAbsent(params.getCallback());
    }

    // 6. regenerateAnswer
    public void regenerateAnswer(@NonNull RegenerateAnswerParams params, @NonNull SkillCallback<SendMessageResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                String cached = streamingMessageCache.findLastUserMessageContent(params.getWelinkSessionId());
                if (cached != null && !cached.trim().isEmpty()) {
                    sendMessageInternal(params.getWelinkSessionId(), cached, null, callback);
                    return;
                }

                apiClient.getMessages(params.getWelinkSessionId(), 0, 100, new SkillCallback<PageResult<SessionMessage>>() {
                    @Override
                    public void onSuccess(@Nullable PageResult<SessionMessage> result) {
                        PageResult<SessionMessage> page = result == null ? new PageResult<>() : result;
                        streamingMessageCache.ingestServerMessages(params.getWelinkSessionId(), page.getContent());
                        String latest = streamingMessageCache.findLastUserMessageContent(params.getWelinkSessionId());
                        if (latest == null || latest.trim().isEmpty()) {
                            callback.onError(error(4002, "No user message to regenerate"));
                            return;
                        }
                        sendMessageInternal(params.getWelinkSessionId(), latest, null, callback);
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
        if (isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
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
                        apiClient.sendMessageToIM(params.getWelinkSessionId(), content, params.getChatId(),
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
        if (isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }
        int page = Math.max(params.getPage(), 0);
        int size = params.getSize() <= 0 ? 50 : params.getSize();
        boolean isFirst = params.isFirst();

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.getMessages(params.getWelinkSessionId(), page, size, new SkillCallback<PageResult<SessionMessage>>() {
                    @Override
                    public void onSuccess(@Nullable PageResult<SessionMessage> result) {
                        PageResult<SessionMessage> serverPage = normalizeSessionMessagePage(result, page, size);
                        if (!isFirst) {
                            streamingMessageCache.ingestServerMessages(params.getWelinkSessionId(), serverPage.getContent());
                            callback.onSuccess(serverPage);
                            return;
                        }
                        PageResult<SessionMessage> merged = streamingMessageCache.mergeWithLocalCache(
                                params.getWelinkSessionId(), serverPage);
                        callback.onSuccess(merged);
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

    @NonNull
    private static PageResult<SessionMessage> normalizeSessionMessagePage(@Nullable PageResult<SessionMessage> pageResult,
            int requestPage, int requestSize) {
        PageResult<SessionMessage> source = pageResult == null ? new PageResult<>() : pageResult;

        int safePage = source.getPage() < 0 ? requestPage : source.getPage();
        int safeSize = source.getSize() <= 0 ? requestSize : source.getSize();
        List<SessionMessage> content = source.getContent() == null ? new ArrayList<>() : new ArrayList<>(source.getContent());
        long safeTotal = source.getTotal() < 0 ? content.size() : source.getTotal();
        int safeTotalPages = source.getTotalPages() < 0 ? 0 : source.getTotalPages();

        PageResult<SessionMessage> normalized = new PageResult<>();
        normalized.setContent(content);
        normalized.setPage(safePage);
        normalized.setSize(safeSize);
        normalized.setTotal(safeTotal);
        normalized.setTotalPages(safeTotalPages);
        return normalized;
    }

    // 9. registerSessionListener
    public RegisterSessionListenerResult registerSessionListener(@NonNull RegisterSessionListenerParams params) {
        ensureInitializedForVoid();
        if (isBlank(params.getWelinkSessionId()) || params.getOnMessage() == null) {
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
        ListenerBinding previous = listenerBindings.putIfAbsent(params.getWelinkSessionId(), binding);
        if (previous != null) {
            return new RegisterSessionListenerResult("success");
        }
        webSocketManager.registerListener(params.getWelinkSessionId(), listener);
        return new RegisterSessionListenerResult("success");
    }

    // 10. unregisterSessionListener
    public UnregisterSessionListenerResult unregisterSessionListener(@NonNull UnregisterSessionListenerParams params) {
        ensureInitializedForVoid();
        if (isBlank(params.getWelinkSessionId())) {
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
        if (isBlank(params.getWelinkSessionId()) || params.getContent().trim().isEmpty()) {
            callback.onError(error(1000, "welinkSessionId and content are required"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                sendMessageInternal(params.getWelinkSessionId(), params.getContent(), params.getToolCallId(), callback);
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
        if (isBlank(params.getWelinkSessionId()) || params.getPermId().trim().isEmpty() || params.getResponse().trim().isEmpty()) {
            callback.onError(error(1000, "welinkSessionId, permId and response are required"));
            return;
        }
        if (!isPermissionResponseValid(params.getResponse())) {
            callback.onError(error(1000, "response must be once/always/reject"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.replyPermission(params.getWelinkSessionId(), params.getPermId(), params.getResponse(),
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
    public void createNewSession(@NonNull CreateNewSessionParams params, @NonNull SkillCallback<SkillSession> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }

        final CreateNewSessionParams normalizedParams;
        try {
            String ak = TypeConvertUtils.requireString(params.getAk(), "ak");
            String bussinessDomain = TypeConvertUtils.requireString(params.getBussinessDomain(), "bussinessDomain");
            String bussinessType = TypeConvertUtils.requireString(params.getBussinessType(), "bussinessType");
            String bussinessId = TypeConvertUtils.requireString(params.getBussinessId(), "bussinessId");
            String assistantAccount = TypeConvertUtils.requireString(params.getAssistantAccount(), "assistantAccount");
            String title = TypeConvertUtils.optionalString(params.getTitle());
            normalizedParams = new CreateNewSessionParams(
                    ak,
                    title,
                    bussinessDomain,
                    bussinessType,
                    bussinessId,
                    assistantAccount
            );
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.createNewSession(normalizedParams, new SkillCallback<SkillSession>() {
                    @Override
                    public void onSuccess(@Nullable SkillSession session) {
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
            @NonNull SkillCallback<PageResult<SkillSession>> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }

        final HistorySessionsParams requestParams;
        String status;
        try {
            status = TypeConvertUtils.optionalString(params.getStatus());
            if (status != null) {
                status = status.toUpperCase(Locale.ROOT);
            }
            int page = TypeConvertUtils.toNonNegativeInt(params.getPage(), 0, "page");
            int size = TypeConvertUtils.toPositiveInt(params.getSize(), 50, "size");
            String ak = TypeConvertUtils.optionalString(params.getAk());
            String bussinessId = TypeConvertUtils.optionalString(params.getBussinessId());
            String assistantAccount = TypeConvertUtils.optionalString(params.getAssistantAccount());
            requestParams = new HistorySessionsParams(page, size, status, ak, bussinessId, assistantAccount);
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        if (status != null && !isSessionRecordStatusValid(status)) {
            callback.onError(error(1000, "status must be ACTIVE/IDLE/CLOSED"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean connected) {
                apiClient.getHistorySessionsList(requestParams, new SkillCallback<PageResult<SkillSession>>() {
                    @Override
                    public void onSuccess(@Nullable PageResult<SkillSession> result) {
                        PageResult<SkillSession> pageResult = result == null ? new PageResult<>() : result;
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
        final int weCrewType;
        final String bizRobotId;
        try {
            name = TypeConvertUtils.requireString(params.getName(), "name");
            icon = TypeConvertUtils.requireString(params.getIcon(), "icon");
            description = TypeConvertUtils.requireString(params.getDescription(), "description");
            weCrewType = TypeConvertUtils.requireInteger(params.getWeCrewType(), "weCrewType");
            bizRobotId = TypeConvertUtils.optionalString(params.getBizRobotId());
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }

        if (weCrewType != 0 && weCrewType != 1) {
            callback.onError(error(1000, "weCrewType must be 0 or 1"));
            return;
        }

        apiClient.createDigitalTwin(name, icon, description, weCrewType, bizRobotId,
                new SkillCallback<CreateDigitalTwinResult>() {
                    @Override
                    public void onSuccess(@Nullable CreateDigitalTwinResult result) {
                        CreateDigitalTwinResult resolved = result == null ? new CreateDigitalTwinResult() : result;
                        if (isBlank(resolved.getMessage())) {
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
        final int safePageSize = clamp(pageSize, 1, 100);
        final int safePageNumber = clamp(pageNumber, 1, 1000);

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

        final List<String> partnerAccounts;
        try {
            partnerAccounts = TypeConvertUtils.requireStringList(params.getPartnerAccounts(), "partnerAccounts");
        } catch (SkillSdkException e) {
            callback.onError(e);
            return;
        }
        if (partnerAccounts.isEmpty()) {
            callback.onError(error(1000, "partnerAccounts is required"));
            return;
        }

        apiClient.getWeAgentDetails(partnerAccounts, new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                WeAgentDetailsArrayResult resolved = result == null ? new WeAgentDetailsArrayResult() : result;
                if (partnerAccounts.size() == 1 && !resolved.getWeAgentDetailsArray().isEmpty()) {
                    weAgentStorage.saveCurrentWeAgentDetail(resolved.getWeAgentDetailsArray().get(0));
                }
                callback.onSuccess(resolved);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(wrapError(error));
            }
        });
    }

    // 20. getWeAgentUri
    @NonNull
    public WeAgentUriResult getWeAgentUri() {
        ensureInitializedForVoid();
        WeAgentDetails details = weAgentStorage.getCurrentWeAgentDetail();
        String weCodeUrl = details == null ? null : normalizeOptionalString(details.getWeCodeUrl());
        String partnerAccount = details == null ? null : normalizeOptionalString(details.getPartnerAccount());

        String weAgentUri = appendQueryParameter(weCodeUrl, "wecodePlace", "weAgent");
        String assistantDetailUri = appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        String switchAssistantUri = appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);

        return new WeAgentUriResult(
                weAgentUri == null ? "" : weAgentUri,
                assistantDetailUri == null ? "" : assistantDetailUri,
                switchAssistantUri == null ? "" : switchAssistantUri
        );
    }

    public synchronized void shutdown() {
        webSocketManager.removeInternalListener(internalStreamListener);
        webSocketManager.shutdown();
        apiClient.shutdown();
        listenerBindings.clear();
        sessionStatusCallbacks.clear();
        lastSessionStatusBySession.clear();
        wecodeStatusCallbacks.clear();
        awaitingExecutingBySession.clear();
        stoppedHoldingBySession.clear();
        streamingMessageCache.clearAll();
        config = null;
    }

    private void sendMessageInternal(@NonNull String welinkSessionId, @NonNull String content, @Nullable String toolCallId,
            @NonNull SkillCallback<SendMessageResult> callback) {
        awaitingExecutingBySession.put(welinkSessionId, Boolean.TRUE);
        apiClient.sendMessage(welinkSessionId, content, toolCallId, new SkillCallback<SendMessageResult>() {
            @Override
            public void onSuccess(@Nullable SendMessageResult result) {
                if (result == null) {
                    awaitingExecutingBySession.put(welinkSessionId, Boolean.FALSE);
                }
                if (result != null) {
                    streamingMessageCache.recordUserMessage(result);
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
        String fromCache = streamingMessageCache.getCompletedMessageContent(params.getWelinkSessionId(), params.getMessageId());
        if (fromCache != null && !fromCache.trim().isEmpty()) {
            callback.onSuccess(fromCache);
            return;
        }

        apiClient.getMessages(params.getWelinkSessionId(), 0, 100, new SkillCallback<PageResult<SessionMessage>>() {
            @Override
            public void onSuccess(@Nullable PageResult<SessionMessage> result) {
                PageResult<SessionMessage> page = result == null ? new PageResult<>() : result;
                streamingMessageCache.ingestServerMessages(params.getWelinkSessionId(), page.getContent());
                String content = streamingMessageCache.getCompletedMessageContent(params.getWelinkSessionId(), params.getMessageId());
                if (content != null && !content.trim().isEmpty()) {
                    callback.onSuccess(content);
                    return;
                }

                if (!isBlank(params.getMessageId())) {
                    String messageId = params.getMessageId();
                    if (!streamingMessageCache.hasMessage(params.getWelinkSessionId(), messageId)) {
                        callback.onError(error(4003, "Message does not exist"));
                        return;
                    }
                    if (!streamingMessageCache.isMessageCompleted(params.getWelinkSessionId(), messageId)) {
                        callback.onError(error(4004, "Message is not completed"));
                        return;
                    }
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
        String sessionId = normalizeOptionalString(message.getWelinkSessionId());
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
    private SkillSession selectLatestActiveSession(@Nullable List<SkillSession> sessions, @NonNull CreateSessionParams params) {
        if (sessions == null || sessions.isEmpty()) {
            return null;
        }
        String expectedAk = normalizeOptionalString(params.getAk());
        return sessions.stream()
                .filter(session -> "ACTIVE".equalsIgnoreCase(session.getStatus()))
                .filter(session -> expectedAk == null || expectedAk.equals(session.getAk()))
                .filter(session -> params.getImGroupId().equals(session.getImGroupId()))
                .max(Comparator.comparing(this::safeUpdatedAt))
                .orElse(null);
    }

    @Nullable
    private static String normalizeOptionalString(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @NonNull
    private Instant safeUpdatedAt(@NonNull SkillSession session) {
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

    private static boolean isPermissionResponseValid(@NonNull String value) {
        return "once".equalsIgnoreCase(value) || "always".equalsIgnoreCase(value) || "reject".equalsIgnoreCase(value);
    }

    private static boolean isSessionRecordStatusValid(@NonNull String value) {
        return "ACTIVE".equalsIgnoreCase(value)
                || "IDLE".equalsIgnoreCase(value)
                || "CLOSED".equalsIgnoreCase(value);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }

    @Nullable
    private static String appendQueryParameter(@Nullable String baseUrl, @NonNull String key, @Nullable String value) {
        if (baseUrl == null) {
            return null;
        }
        String trimmedBase = baseUrl.trim();
        if (trimmedBase.isEmpty()) {
            return null;
        }
        String encoded;
        try {
            encoded = URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            encoded = value == null ? "" : value;
        }
        String connector;
        if (trimmedBase.contains("?")) {
            connector = trimmedBase.endsWith("?") || trimmedBase.endsWith("&") ? "" : "&";
        } else {
            connector = "?";
        }
        return trimmedBase + connector + key + "=" + encoded;
    }

    private static boolean isBlank(@Nullable String value) {
        return value == null || value.trim().isEmpty();
    }

    private static final class ListenerBinding {
        @NonNull
        private final SessionListener sessionListener;

        private ListenerBinding(@NonNull SessionListener sessionListener) {
            this.sessionListener = sessionListener;
        }
    }
}
