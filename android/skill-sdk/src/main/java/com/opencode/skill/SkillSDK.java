package com.opencode.skill;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.gson.reflect.TypeToken;
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
import com.opencode.skill.model.HistorySessionsParams;
import com.opencode.skill.model.OnSessionStatusChangeParams;
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
import com.opencode.skill.model.RegenerateAnswerParams;
import com.opencode.skill.model.SendMessageParams;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMParams;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SessionMessage;
import com.opencode.skill.model.SessionMessagePart;
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
import com.opencode.skill.util.TypeConvertUtils;
import com.opencode.skill.util.WeAgentStorage;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Singleton SDK exposing public APIs from SkillClientSdkInterfaceV1.md.
 */
public final class SkillSDK {
    private static volatile SkillSDK instance;
    private static final String ASSISTANT_H5_URI = "h5://S008623/index.html";
    private static final String WE_AGENT_CUI_APPID = "S008623";
    private static final String WE_AGENT_EVENT_NAME = "agentskills.agentUpdated";
    private static final String IM_NOTIFY_MODULE = "welink-athena";
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
    private final ArrayDeque<WeAgentCacheMutation> weAgentCacheMutationQueue = new ArrayDeque<>();
    private boolean processingWeAgentCacheMutation;
    private int weAgentCacheMutationGeneration;

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
        refreshWeAgentsOnColdStart();
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
        if (isBlank(params.getWelinkSessionId())) {
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
                        String latest = findLatestUserMessageContent(page.getContent());
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
        if (isBlank(params.getWelinkSessionId())) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }
        String directContent = params.getContent();
        String normalizedChatId = normalizeOptionalString(params.getChatId());
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
        if (isBlank(params.getWelinkSessionId())) {
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
                        PageResult<SessionMessage> serverPage = normalizeSessionMessagePage(result, page, size);
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
                                CursorResult<SessionMessage> cursorResult = normalizeSessionMessageCursor(result, size);
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

    @NonNull
    private static CursorResult<SessionMessage> normalizeSessionMessageCursor(
            @Nullable CursorResult<SessionMessage> cursorResult,
            int requestSize
    ) {
        CursorResult<SessionMessage> source = cursorResult == null ? new CursorResult<>() : cursorResult;
        int safeSize = source.getSize() <= 0 ? requestSize : source.getSize();
        List<SessionMessage> safeContent = new ArrayList<>(source.getContent());

        CursorResult<SessionMessage> normalized = new CursorResult<>();
        normalized.setContent(safeContent);
        normalized.setSize(safeSize);
        normalized.setHasMore(source.isHasMore());
        normalized.setNextBeforeSeq(source.getNextBeforeSeq());
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

        if (status != null && !isSessionRecordStatusValid(status)) {
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
                WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                cacheWeAgentDetailsResult(partnerAccount, resolved);
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
            WeAgentDetailsArrayResult cachedResult = wrapWeAgentDetail(cached);
            callback.onSuccess(cachedResult);
            refreshAssistantDetailsCache(partnerAccount);
            return;
        }

        apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                cacheWeAgentDetailsResult(partnerAccount, resolved, false);
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
        if (normalizeOptionalString(result.getTagName()) == null) {
            result.setTagName("助手");
        }
        if (normalizeOptionalString(result.getTagNameEn()) == null) {
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
        buildWeAgentUriResult(weAgentStorage.getCurrentWeAgentDetail(), callback);
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
                enqueueWeAgentCacheMutation(completion -> {
                    weAgentStorage.updateCachedWeAgentDetails(partnerAccount, name, icon, description);
                    broadcastWeAgentEvent(
                            WE_AGENT_EVENT_NAME,
                            buildWeAgentPayload("update", data, "local"),
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

        DeleteWeAgentContext context = buildDeleteWeAgentContext(partnerAccount);
        requestDeleteWeAgent(context, new SkillCallback<DeleteWeAgentResult>() {
            @Override
            public void onSuccess(@Nullable DeleteWeAgentResult result) {
                WeLinkLogger.i(TAG, "deleteWeAgent request succeeded, enqueue cache mutation, partnerAccount="
                        + partnerAccount);
                enqueueWeAgentCacheMutation(
                        completion -> handleDeleteWeAgentResult(context, result, callback, completion)
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
        if (!IM_NOTIFY_MODULE.equals(normalizeOptionalString(valueAsString(payload.get("notify_module"))))) {
            WeLinkLogger.i(TAG, "ignore we-agent IM notification: notify_module does not match");
            return;
        }
        Map<String, Object> notifyData = valueAsMap(payload.get("notify_data"));
        if (notifyData == null) {
            WeLinkLogger.e(TAG, "ignore we-agent IM notification: notify_data parse failed");
            return;
        }
        WeLinkLogger.i(TAG, "we-agent IM notification parsed, enqueue server mutation");
        enqueueWeAgentCacheMutation(completion -> handleWeAgentNotifyData(notifyData, "server", completion));
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

        final String partnerAccount = normalizeOptionalString(params.getPartnerAccount());

        // TODO: save isShowWeAgent = true by calling host saveSettings.
        // TODO: broadcast isShowWeAgent = true to host.
        if (partnerAccount != null) {
            getAssistantDetails(new QueryWeAgentParams(partnerAccount), new SkillCallback<WeAgentDetailsArrayResult>() {
                @Override
                public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                    WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                    WeAgentDetails targetDetail = resolved.getWeAgentDetailsArray().isEmpty()
                            ? null
                            : resolved.getWeAgentDetailsArray().get(0);
                    if (targetDetail == null) {
                        callback.onError(error(7000, "getAssistantDetails returned empty detail"));
                        return;
                    }
                    String weCodeUrl = normalizeOptionalString(targetDetail.getWeCodeUrl());
                    if (weCodeUrl == null) {
                        callback.onError(error(7000, "getAssistantDetails returned empty weCodeUrl"));
                        return;
                    }
                    weAgentStorage.saveCurrentWeAgentDetail(targetDetail);
                    buildWeAgentUriResult(targetDetail, new SkillCallback<WeAgentUriResult>() {
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
        final String robotId = normalizeOptionalString(params.getRobotId());
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
            refreshAssistantGraySingleCache(partnerAccount);
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
        webSocketManager.shutdown();
        apiClient.shutdown();
        listenerBindings.clear();
        sessionStatusCallbacks.clear();
        lastSessionStatusBySession.clear();
        wecodeStatusCallbacks.clear();
        awaitingExecutingBySession.clear();
        stoppedHoldingBySession.clear();
        synchronized (weAgentCacheMutationQueue) {
            weAgentCacheMutationQueue.clear();
            processingWeAgentCacheMutation = false;
            weAgentCacheMutationGeneration++;
        }
        config = null;
    }

    @NonNull
    private WeAgentDetailsArrayResult resolveWeAgentDetailsResult(@Nullable WeAgentDetailsArrayResult result) {
        return result == null ? new WeAgentDetailsArrayResult() : result;
    }

    private void cacheWeAgentDetailsResult(
            @NonNull String partnerAccount,
            @NonNull WeAgentDetailsArrayResult result
    ) {
        cacheWeAgentDetailsResult(partnerAccount, result, true);
    }

    private void cacheWeAgentDetailsResult(
            @NonNull String partnerAccount,
            @NonNull WeAgentDetailsArrayResult result,
            boolean saveCurrentDetail
    ) {
        if (result.getWeAgentDetailsArray().isEmpty()) {
            return;
        }
        WeAgentDetails cachedDetail = result.getWeAgentDetailsArray().get(0);
        weAgentStorage.saveWeAgentDetails(partnerAccount, cachedDetail);
        if (saveCurrentDetail) {
            weAgentStorage.saveCurrentWeAgentDetail(cachedDetail);
        }
    }

    private void refreshAssistantDetailsCache(@NonNull String partnerAccount) {
        apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                cacheWeAgentDetailsResult(partnerAccount, resolveWeAgentDetailsResult(result), false);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // Ignore background refresh failures.
            }
        });
    }

    private void refreshAssistantGraySingleCache(@NonNull String partnerAccount) {
        apiClient.queryAssistantGraySingle(partnerAccount, new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                if (result == null) {
                    return;
                }
                weAgentStorage.saveAssistantGraySingle(partnerAccount, result);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // Ignore async refresh failure and keep old cache.
            }
        });
    }

    /**
     * 在 SDK 冷启动时用服务端数据补偿本地助理缓存。
     *
     * <p>该方法合并详情缓存和当前助理中的账号后发起一次批量查询。服务端未返回的账号会从
     * 统一删除流程清理缓存、处理当前助理后续 URI 并广播删除事件；返回且与本地有差异的
     * 详情只覆盖已存在的缓存并广播更新事件。请求失败时保持本地状态不变。</p>
     */
    private void refreshWeAgentsOnColdStart() {
        enqueueWeAgentCacheMutation(this::performColdStartWeAgentRefresh);
    }

    private void performColdStartWeAgentRefresh(@NonNull SkillCallback<Void> completion) {
        List<String> partnerAccounts = weAgentStorage.getCachedWeAgentPartnerAccounts();
        if (partnerAccounts.isEmpty()) {
            WeLinkLogger.i(TAG, "cold-start we-agent refresh skipped: no cached partnerAccount");
            completion.onSuccess(null);
            return;
        }
        WeLinkLogger.i(TAG, "cold-start we-agent refresh started, accountCount=" + partnerAccounts.size());
        Map<String, WeAgentDetails> cachedDetails = weAgentStorage.loadWeAgentDetailsCache();
        WeAgentDetails currentDetail = weAgentStorage.getCurrentWeAgentDetail();
        apiClient.getWeAgentDetails(String.join(",", partnerAccounts), new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                WeLinkLogger.i(TAG, "cold-start we-agent detail request succeeded, remoteCount="
                        + resolved.getWeAgentDetailsArray().size());
                Map<String, WeAgentDetails> remoteDetails = new HashMap<>();
                for (WeAgentDetails detail : resolved.getWeAgentDetailsArray()) {
                    String partnerAccount = normalizeOptionalString(detail.getPartnerAccount());
                    if (partnerAccount != null) {
                        remoteDetails.put(partnerAccount, detail);
                    }
                }
                processColdStartWeAgentAccounts(
                        partnerAccounts,
                        remoteDetails,
                        cachedDetails,
                        currentDetail,
                        0,
                        completion
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // Cold-start compensation failures do not change cache or emit broadcasts.
                WeLinkLogger.e(TAG, "cold-start we-agent detail request failed, error=" + error.getMessage());
                completion.onSuccess(null);
            }
        });
    }

    private void processColdStartWeAgentAccounts(
            @NonNull List<String> partnerAccounts,
            @NonNull Map<String, WeAgentDetails> remoteDetails,
            @NonNull Map<String, WeAgentDetails> cachedDetails,
            @Nullable WeAgentDetails currentDetail,
            int index,
            @NonNull SkillCallback<Void> completion
    ) {
        if (index >= partnerAccounts.size()) {
            WeLinkLogger.i(TAG, "cold-start we-agent refresh completed, accountCount=" + partnerAccounts.size());
            completion.onSuccess(null);
            return;
        }
        String partnerAccount = partnerAccounts.get(index);
        WeAgentDetails remoteDetail = remoteDetails.get(partnerAccount);
        if (remoteDetail == null) {
            WeLinkLogger.i(TAG, "cold-start detected deleted we-agent, partnerAccount=" + partnerAccount);
            handleDeletedWeAgent(
                    partnerAccount,
                    buildWeAgentData(partnerAccount),
                    "server",
                    continueColdStartProcessing(
                            partnerAccounts,
                            remoteDetails,
                            cachedDetails,
                            currentDetail,
                            index,
                            completion
                    )
            );
            return;
        }
        WeAgentDetails cachedDetail = cachedDetails.get(partnerAccount);
        boolean currentMatches = matchesWeAgentDetails(currentDetail, partnerAccount);
        boolean changed = cachedDetail != null && !detailsEqual(cachedDetail, remoteDetail);
        changed = changed || currentMatches && !detailsEqual(currentDetail, remoteDetail);
        if (changed) {
            WeLinkLogger.i(TAG, "cold-start detected updated we-agent, partnerAccount=" + partnerAccount);
            weAgentStorage.replaceCachedWeAgentDetailsIfPresent(partnerAccount, remoteDetail);
            dispatchHostBroadcast(WE_AGENT_EVENT_NAME, buildResolvedUpdatePayload(remoteDetail, "server"));
        }
        processColdStartWeAgentAccounts(
                partnerAccounts,
                remoteDetails,
                cachedDetails,
                currentDetail,
                index + 1,
                completion
        );
    }

    @NonNull
    private SkillCallback<Void> continueColdStartProcessing(
            @NonNull List<String> partnerAccounts,
            @NonNull Map<String, WeAgentDetails> remoteDetails,
            @NonNull Map<String, WeAgentDetails> cachedDetails,
            @Nullable WeAgentDetails currentDetail,
            int index,
            @NonNull SkillCallback<Void> completion
    ) {
        return new SkillCallback<Void>() {
            @Override
            public void onSuccess(@Nullable Void ignored) {
                processColdStartWeAgentAccounts(
                        partnerAccounts,
                        remoteDetails,
                        cachedDetails,
                        currentDetail,
                        index + 1,
                        completion
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // A failed URI calculation must not block compensation for the remaining accounts.
                onSuccess(null);
            }
        };
    }

    /**
     * 比较两个助理详情对象的完整序列化内容是否一致，用于判断冷启动补偿是否需要写缓存和广播。
     */
    private boolean detailsEqual(@Nullable WeAgentDetails left, @Nullable WeAgentDetails right) {
        if (left == null || right == null) {
            return left == right;
        }
        return gson.toJsonTree(left).equals(gson.toJsonTree(right));
    }

    @NonNull
    /**
     * 将已补拉完成的完整助理详情转换为统一更新广播载荷。
     *
     * <p>详情对象先转换为通用 Map，再交给统一载荷构造方法补充事件类型和来源。</p>
     */
    private Map<String, Object> buildResolvedUpdatePayload(
            @NonNull WeAgentDetails detail,
            @NonNull String source
    ) {
        Map<String, Object> data = gson.fromJson(
                gson.toJson(detail),
                new TypeToken<Map<String, Object>>() {
                }.getType()
        );
        return buildWeAgentPayload("update", data, source);
    }

    /**
     * 解析并执行助理更新或删除通知。
     *
     * <p>更新通知仅修改本地已存在详情的基础字段，随后补拉完整详情再广播；删除通知复用
     * 统一删除流程处理缓存、当前助理跳转和广播。缺少 action、weCrew 或必要账号时不继续处理。</p>
     */
    private void handleWeAgentNotifyData(
            @NonNull Map<String, Object> notifyData,
            @NonNull String source,
            @NonNull SkillCallback<Void> completion
    ) {
        String action = normalizeOptionalString(valueAsString(notifyData.get("action")));
        Map<String, Object> weCrew = valueAsMap(notifyData.get("weCrew"));
        if (action == null || weCrew == null) {
            WeLinkLogger.e(TAG, "ignore we-agent notification: action or weCrew is missing");
            completion.onSuccess(null);
            return;
        }
        String partnerAccount = normalizeOptionalString(valueAsString(weCrew.get("partnerAccount")));
        if ("update".equalsIgnoreCase(action)) {
            if (partnerAccount == null) {
                WeLinkLogger.e(TAG, "ignore we-agent update notification: partnerAccount is missing");
                completion.onSuccess(null);
                return;
            }
            WeLinkLogger.i(TAG, "process server we-agent update, partnerAccount=" + partnerAccount);
            updateCachedBasicFieldsIfPresent(partnerAccount, weCrew);
            broadcastWeAgentEvent(
                    WE_AGENT_EVENT_NAME,
                    buildWeAgentPayload("update", weCrew, source),
                    completion
            );
            return;
        }
        if ("delete".equalsIgnoreCase(action)) {
            if (partnerAccount == null) {
                WeLinkLogger.e(TAG, "ignore we-agent delete notification: partnerAccount is missing");
                completion.onSuccess(null);
                return;
            }
            WeLinkLogger.i(TAG, "process server we-agent delete, partnerAccount=" + partnerAccount);
            handleDeletedWeAgent(partnerAccount, weCrew, source, completion);
            return;
        }
        completion.onSuccess(null);
    }

    /**
     * 使用通知中的名称、头像和描述更新已存在的助理缓存。
     *
     * <p>三个基础字段必须齐全；描述同时兼容 {@code description} 和 {@code desc}。
     * 缓存层负责只更新命中的记录，不创建新的详情缓存。</p>
     */
    private void updateCachedBasicFieldsIfPresent(@NonNull String partnerAccount, @NonNull Map<String, Object> data) {
        String name = normalizeOptionalString(valueAsString(data.get("name")));
        String icon = normalizeOptionalString(valueAsString(data.get("icon")));
        String description = normalizeOptionalString(valueAsString(data.get("description")));
        if (description == null) {
            description = normalizeOptionalString(valueAsString(data.get("desc")));
        }
        if (name == null || icon == null || description == null) {
            return;
        }
        weAgentStorage.updateCachedWeAgentDetails(partnerAccount, name, icon, description);
    }

    @NonNull
    private Map<String, Object> buildWeAgentData(@NonNull String partnerAccount) {
        Map<String, Object> data = new HashMap<>();
        data.put("partnerAccount", partnerAccount);
        return data;
    }

    @NonNull
    /**
     * 构造三端统一的助理广播结构：事件类型、业务数据和来源扩展信息。
     */
    private Map<String, Object> buildWeAgentPayload(
            @NonNull String type,
            @NonNull Map<String, Object> data,
            @NonNull String source
    ) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("data", data);
        Map<String, Object> extraData = new HashMap<>();
        extraData.put("source", source);
        payload.put("extraData", extraData);
        return payload;
    }

    /**
     * 按方案规则发送助理事件。
     *
     * <p>更新事件必须先根据 partnerAccount 补拉完整详情，并以完整详情替换原始 data 后广播；
     * 账号缺失、详情为空或请求失败均不广播。删除事件无需网络请求，直接交给宿主广播适配层。</p>
     */
    private void broadcastWeAgentEvent(
            @NonNull String eventName,
            @NonNull Map<String, Object> payload,
            @NonNull SkillCallback<Void> completion
    ) {
        Object type = payload.get("type");
        if ("update".equals(type)) {
            Map<String, Object> data = valueAsMap(payload.get("data"));
            String partnerAccount = data == null ? null : normalizeOptionalString(valueAsString(data.get("partnerAccount")));
            if (partnerAccount == null) {
                WeLinkLogger.e(TAG, "skip we-agent update broadcast: partnerAccount is missing");
                completion.onSuccess(null);
                return;
            }
            apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
                @Override
                public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                    WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                    if (resolved.getWeAgentDetailsArray().isEmpty()) {
                        WeLinkLogger.e(TAG, "skip we-agent update broadcast: detail response is empty, partnerAccount="
                                + partnerAccount);
                        completion.onSuccess(null);
                        return;
                    }
                    WeAgentDetails detail = resolved.getWeAgentDetailsArray().get(0);
                    Map<String, Object> finalPayload = new HashMap<>(payload);
                    finalPayload.put("data", gson.fromJson(gson.toJson(detail), new TypeToken<Map<String, Object>>() {
                    }.getType()));
                    dispatchHostBroadcast(eventName, finalPayload);
                    WeLinkLogger.i(TAG, "we-agent update broadcast completed, partnerAccount=" + partnerAccount);
                    completion.onSuccess(null);
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    // Per plan: update broadcast detail fetch failures do not emit a broadcast.
                    WeLinkLogger.e(TAG, "fetch detail before update broadcast failed, partnerAccount="
                            + partnerAccount + ", error=" + error.getMessage());
                    completion.onSuccess(null);
                }
            });
            return;
        }
        dispatchHostBroadcast(eventName, payload);
        WeLinkLogger.i(TAG, "we-agent delete broadcast completed");
        completion.onSuccess(null);
    }

    /**
     * 调用宿主广播能力的统一出口。
     *
     * <p>当前仅保留适配点，后续接入 WeBroadCast 时应在此处透传事件名和完整载荷。</p>
     */
    private void dispatchHostBroadcast(@NonNull String eventName, @NonNull Map<String, Object> payload) {
        // TODO: call host WeBroadCast(eventName, payload) when the host broadcast adapter is wired.
    }

    @Nullable
    /**
     * 将通知字段安全转换为字符串；仅接受字符串、数字和布尔值，复杂类型返回 null。
     */
    private String valueAsString(@Nullable Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String) {
            return (String) value;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        return null;
    }

    @Nullable
    /**
     * 将通知字段安全转换为字符串键 Map。
     *
     * <p>输入可以是 Map 或 JSON 字符串；非法 JSON、数组及其他类型返回 null，避免异常通知
     * 中断同步链路。</p>
     */
    private Map<String, Object> valueAsMap(@Nullable Object value) {
        if (value instanceof Map) {
            Map<?, ?> raw = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : raw.entrySet()) {
                if (entry.getKey() instanceof String) {
                    result.put((String) entry.getKey(), entry.getValue());
                }
            }
            return result;
        }
        if (value instanceof String) {
            try {
                return gson.fromJson((String) value, new TypeToken<Map<String, Object>>() {
                }.getType());
            } catch (JsonSyntaxException ignored) {
                return null;
            }
        }
        return null;
    }

    @NonNull
    private WeAgentDetailsArrayResult wrapWeAgentDetail(@NonNull WeAgentDetails detail) {
        WeAgentDetailsArrayResult result = new WeAgentDetailsArrayResult();
        List<WeAgentDetails> list = new ArrayList<>();
        list.add(detail);
        result.setWeAgentDetailsArray(list);
        return result;
    }

    @NonNull
    /**
     * 创建删除请求上下文，统一保存服务端删除接口所需的 partnerAccount。
     */
    private DeleteWeAgentContext buildDeleteWeAgentContext(@NonNull String partnerAccount) {
        return new DeleteWeAgentContext(partnerAccount);
    }

    /**
     * 使用上下文中的 partnerAccount 调用服务端删除接口，并原样转发异步结果。
     */
    private void requestDeleteWeAgent(
            @NonNull DeleteWeAgentContext context,
            @NonNull SkillCallback<DeleteWeAgentResult> callback
    ) {
        apiClient.deleteWeAgent(context.partnerAccount, callback);
    }

    /**
     * 处理本端删除助理成功后的缓存、跳转和广播。
     *
     * <p>所有删除都会先移除列表与详情缓存；非当前助理随后直接广播并回调成功。删除当前助理
     * 时还会清空当前详情并调用 getWeAgentUri 计算后续页面，成功后再发送删除广播。</p>
     */
    private void handleDeleteWeAgentResult(
            @NonNull DeleteWeAgentContext context,
            @Nullable DeleteWeAgentResult result,
            @NonNull SkillCallback<DeleteWeAgentResult> callback,
            @NonNull SkillCallback<Void> completion
    ) {
        handleDeletedWeAgent(
                context.partnerAccount,
                buildWeAgentData(context.partnerAccount),
                "local",
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
    }

    /**
     * 统一处理冷启动补偿、服务端通知和本端接口触发的助理删除。
     *
     * <p>方法先判断目标是否为当前助理，再幂等清理列表和详情缓存。删除当前助理时还会清空
     * 当前详情并调用 getWeAgentUri 计算后续页面；无论 URI 计算成功或失败，三种来源最终
     * 都使用传入数据和来源发送相同结构的删除广播。</p>
     */
    private void handleDeletedWeAgent(
            @NonNull String partnerAccount,
            @NonNull Map<String, Object> data,
            @NonNull String source,
            @NonNull SkillCallback<Void> callback
    ) {
        boolean deletingCurrentWeAgent = isCurrentWeAgent(partnerAccount);
        WeLinkLogger.i(TAG, "handle we-agent delete mutation, partnerAccount=" + partnerAccount
                + ", source=" + source + ", deletingCurrent=" + deletingCurrentWeAgent);
        weAgentStorage.removeWeAgentFromList(partnerAccount);
        weAgentStorage.removeWeAgentDetails(partnerAccount);
        if (!deletingCurrentWeAgent) {
            broadcastWeAgentEvent(
                    WE_AGENT_EVENT_NAME,
                    buildWeAgentPayload("delete", data, source),
                    callback
            );
            return;
        }
        weAgentStorage.saveCurrentWeAgentDetail(null);
        getWeAgentUri(new SkillCallback<WeAgentUriResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentUriResult nextUris) {
                WeLinkLogger.i(TAG, "resolved URI after deleting current we-agent, partnerAccount=" + partnerAccount);
                // TODO: call openWeAgentCUI with nextUris.weAgentUri, nextUris.assistantDetailUri and nextUris.switchAssistantUri.
                broadcastWeAgentEvent(
                        WE_AGENT_EVENT_NAME,
                        buildWeAgentPayload("delete", data, source),
                        callback
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "resolve URI after deleting current we-agent failed, partnerAccount="
                        + partnerAccount + ", error=" + error.getMessage());
                broadcastWeAgentEvent(
                        WE_AGENT_EVENT_NAME,
                        buildWeAgentPayload("delete", data, source),
                        callback
                );
            }
        });
    }

    /**
     * 判断指定 partnerAccount 是否与当前助理详情中的账号一致。
     */
    private boolean isCurrentWeAgent(@NonNull String partnerAccount) {
        return matchesWeAgentDetails(weAgentStorage.getCurrentWeAgentDetail(), partnerAccount);
    }

    private boolean matchesWeAgentDetails(
            @Nullable WeAgentDetails details,
            @NonNull String partnerAccount
    ) {
        if (details == null) {
            return false;
        }
        return partnerAccount.equals(normalizeOptionalString(details.getPartnerAccount()));
    }

    private void buildWeAgentUriResult(
            @Nullable WeAgentDetails details,
            @NonNull SkillCallback<WeAgentUriResult> callback
    ) {
        if (details != null) {
            if (normalizeOptionalString(details.getWeCodeUrl()) == null) {
                callback.onSuccess(buildActivateAssistantFallbackUriResult());
                return;
            }
            callback.onSuccess(isMyAgentDetail(details)
                    ? buildMyAgentWeAgentUriResult(details)
                    : buildLegacyWeAgentUriResult(details));
            return;
        }

        resolveMyWeAgentDetail(new SkillCallback<WeAgentDetails>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetails myAgentDetail) {
                if (myAgentDetail == null) {
                    callback.onSuccess(buildActivateAssistantFallbackUriResult());
                    return;
                }
                if (normalizeOptionalString(myAgentDetail.getWeCodeUrl()) == null) {
                    callback.onSuccess(buildActivateAssistantFallbackUriResult());
                    return;
                }
                callback.onSuccess(buildMyAgentWeAgentUriResult(myAgentDetail));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onSuccess(buildActivateAssistantFallbackUriResult());
            }
        });
    }

    private void resolveMyWeAgentDetail(@NonNull SkillCallback<WeAgentDetails> callback) {
        apiClient.getMyWeAgentDetail(new SkillCallback<WeAgentDetails>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetails detail) {
                if (detail != null) {
                    cacheMyWeAgentDetail(detail);
                }
                callback.onSuccess(detail);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    private void cacheMyWeAgentDetail(@NonNull WeAgentDetails detail) {
        WeAgentDetails currentDetail = weAgentStorage.getCurrentWeAgentDetail();
        if (currentDetail == null || isMyAgentDetail(currentDetail)) {
            weAgentStorage.saveCurrentWeAgentDetail(detail);
        }
    }

    private boolean isMyAgentDetail(@Nullable WeAgentDetails detail) {
        return detail != null
                && "myagent".equalsIgnoreCase(normalizeOptionalString(detail.getBizRobotTag()));
    }

    @NonNull
    private WeAgentUriResult buildActivateAssistantFallbackUriResult() {
        String weAgentUri = appendQueryParameter(ASSISTANT_H5_URI, "wecodePlace", "weAgent");
        weAgentUri = appendHashFragment(weAgentUri, "activateAssistant");
        return new WeAgentUriResult(
                weAgentUri == null ? "" : weAgentUri,
                "",
                ""
        );
    }

    @NonNull
    private WeAgentUriResult buildLegacyWeAgentUriResult(@NonNull WeAgentDetails details) {
        String partnerAccount = normalizeOptionalString(details.getPartnerAccount());
        String weCodeUrl = normalizeOptionalString(details.getWeCodeUrl());
        String detailId = normalizeOptionalString(details.getId());
        String weCodeUrlHost = extractUriHost(weCodeUrl);

        String baseWeAgentUri = appendQueryParameter(weCodeUrl, "wecodePlace", "weAgent");
        String weAgentUri;
        if (WE_AGENT_CUI_APPID.equalsIgnoreCase(weCodeUrlHost == null ? "" : weCodeUrlHost)) {
            weAgentUri = appendQueryParameter(baseWeAgentUri, "assistantAccount", partnerAccount);
        } else {
            weAgentUri = appendQueryParameter(baseWeAgentUri, "robotId", detailId);
        }

        String assistantDetailUri = appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        assistantDetailUri = appendHashFragment(assistantDetailUri, "assistantDetail");

        String switchAssistantUri = appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        switchAssistantUri = appendHashFragment(switchAssistantUri, "switchAssistant");

        return new WeAgentUriResult(
                weAgentUri == null ? "" : weAgentUri,
                assistantDetailUri == null ? "" : assistantDetailUri,
                switchAssistantUri == null ? "" : switchAssistantUri
        );
    }

    @NonNull
    private WeAgentUriResult buildMyAgentWeAgentUriResult(@NonNull WeAgentDetails details) {
        String partnerAccount = normalizeOptionalString(details.getPartnerAccount());
        String weAgentUri = appendQueryParameter(details.getWeCodeUrl(), "wecodePlace", "weAgent");
        weAgentUri = appendQueryParameter(weAgentUri, "from", "weAgent");
        String assistantDetailUri = appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        assistantDetailUri = appendHashFragment(assistantDetailUri, "assistantDetail");
        String switchAssistantUri = appendQueryParameter(ASSISTANT_H5_URI, "partnerAccount", partnerAccount);
        switchAssistantUri = appendHashFragment(switchAssistantUri, "switchAssistant");
        return new WeAgentUriResult(
                weAgentUri == null ? "" : weAgentUri,
                assistantDetailUri == null ? "" : assistantDetailUri,
                switchAssistantUri == null ? "" : switchAssistantUri
        );
    }

    /**
     * 将缓存变更任务加入 FIFO 队列；当前任务完成缓存、网络和广播后才启动下一任务。
     */
    private void enqueueWeAgentCacheMutation(@NonNull WeAgentCacheMutation mutation) {
        boolean shouldStart;
        synchronized (weAgentCacheMutationQueue) {
            weAgentCacheMutationQueue.offer(mutation);
            WeLinkLogger.i(TAG, "we-agent cache mutation enqueued, queueSize=" + weAgentCacheMutationQueue.size());
            shouldStart = !processingWeAgentCacheMutation;
            if (shouldStart) {
                processingWeAgentCacheMutation = true;
            }
        }
        if (shouldStart) {
            processNextWeAgentCacheMutation();
        }
    }

    private void processNextWeAgentCacheMutation() {
        WeAgentCacheMutation mutation;
        int generation;
        synchronized (weAgentCacheMutationQueue) {
            mutation = weAgentCacheMutationQueue.peek();
            if (mutation == null) {
                processingWeAgentCacheMutation = false;
                return;
            }
            generation = weAgentCacheMutationGeneration;
            WeLinkLogger.i(TAG, "we-agent cache mutation started, queueSize=" + weAgentCacheMutationQueue.size());
        }
        AtomicBoolean finished = new AtomicBoolean(false);
        try {
            mutation.execute(new SkillCallback<Void>() {
                @Override
                public void onSuccess(@Nullable Void ignored) {
                    if (finished.compareAndSet(false, true)) {
                        finishWeAgentCacheMutation(generation);
                    }
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    if (finished.compareAndSet(false, true)) {
                        finishWeAgentCacheMutation(generation);
                    }
                }
            });
        } catch (Throwable ignored) {
            WeLinkLogger.e(TAG, "we-agent cache mutation threw unexpectedly, error=" + ignored.getMessage());
            if (finished.compareAndSet(false, true)) {
                finishWeAgentCacheMutation(generation);
            }
        }
    }

    private void finishWeAgentCacheMutation(int generation) {
        synchronized (weAgentCacheMutationQueue) {
            if (generation != weAgentCacheMutationGeneration) {
                return;
            }
            weAgentCacheMutationQueue.poll();
            WeLinkLogger.i(TAG, "we-agent cache mutation completed, remaining=" + weAgentCacheMutationQueue.size());
        }
        processNextWeAgentCacheMutation();
    }

    private interface WeAgentCacheMutation {
        void execute(@NonNull SkillCallback<Void> completion);
    }

    private static final class DeleteWeAgentContext {
        @NonNull
        private final String partnerAccount;

        private DeleteWeAgentContext(@NonNull String partnerAccount) {
            this.partnerAccount = partnerAccount;
        }
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
        String directContent = normalizeOptionalString(params.getContent());
        if (directContent != null) {
            callback.onSuccess(directContent);
            return;
        }
        apiClient.getMessagesHistory(params.getWelinkSessionId(), null, 100, new SkillCallback<CursorResult<SessionMessage>>() {
            @Override
            public void onSuccess(@Nullable CursorResult<SessionMessage> result) {
                CursorResult<SessionMessage> page = result == null ? new CursorResult<>() : result;
                String content = resolveSendToImContent(page.getContent());
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

    @Nullable
    private static String findLatestUserMessageContent(@Nullable List<SessionMessage> messages) {
        if (messages == null) {
            return null;
        }
        for (SessionMessage message : messages) {
            if (message == null) {
                continue;
            }
            if (!"user".equalsIgnoreCase(normalizeOptionalString(message.getRole()))) {
                continue;
            }
            String content = normalizeOptionalString(message.getContent());
            if (content != null) {
                return content;
            }
        }
        return null;
    }

    @Nullable
    private static String resolveSendToImContent(@Nullable List<SessionMessage> messages) {
        if (messages == null) {
            return null;
        }
        for (int index = messages.size() - 1; index >= 0; index--) {
            SessionMessage message = messages.get(index);
            if (message == null) {
                continue;
            }
            String content = resolveMessageDisplayContent(message);
            if (content != null) {
                return content;
            }
        }
        return null;
    }

    @Nullable
    private static String resolveMessageDisplayContent(@NonNull SessionMessage message) {
        String content = normalizeOptionalString(message.getContent());
        if (content != null) {
            return content;
        }
        List<SessionMessagePart> parts = message.getParts();
        if (parts == null || parts.isEmpty()) {
            return null;
        }
        StringBuilder builder = new StringBuilder();
        for (SessionMessagePart part : parts) {
            if (part == null) {
                continue;
            }
            String partContent = normalizeOptionalString(part.getContent());
            if (partContent == null) {
                partContent = normalizeOptionalString(part.getOutput());
            }
            if (partContent == null) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(partContent);
        }
        return builder.length() == 0 ? null : builder.toString();
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
    private Session selectLatestReusableSession(@Nullable List<Session> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return null;
        }
        return sessions.stream()
                .filter(session -> !"CLOSED".equalsIgnoreCase(session.getStatus()))
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

    private static boolean isPermissionResponseValid(@NonNull String value) {
        return "once".equalsIgnoreCase(value) || "always".equalsIgnoreCase(value) || "reject".equalsIgnoreCase(value);
    }

    private static boolean isSessionRecordStatusValid(@NonNull String value) {
        return "ACTIVE".equalsIgnoreCase(value)
                || "IDLE".equalsIgnoreCase(value)
                || "CLOSED".equalsIgnoreCase(value);
    }

    @NonNull
    /**
     * 构造助理编辑页 URI，仅使用必填 partnerAccount 作为定位参数。
     */
    private String buildAssistantEditPageUri(@NonNull String partnerAccount) {
        String uri = appendHashFragment(ASSISTANT_H5_URI, "editAssistant");
        String withPartnerAccount = appendQueryParameter(uri, "partnerAccount", partnerAccount.trim());
        if (withPartnerAccount == null) {
            throw error(5000, "Failed to build assistant edit page uri");
        }
        return withPartnerAccount;
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
        String fragment = null;
        int hashIndex = trimmedBase.indexOf('#');
        if (hashIndex >= 0) {
            fragment = trimmedBase.substring(hashIndex + 1);
            trimmedBase = trimmedBase.substring(0, hashIndex);
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
        String result = trimmedBase + connector + key + "=" + encoded;
        if (fragment == null || fragment.isEmpty()) {
            return result;
        }
        return result + "#" + fragment;
    }

    @Nullable
    private static String appendHashFragment(@Nullable String baseUrl, @NonNull String hash) {
        if (baseUrl == null) {
            return null;
        }
        String trimmedBase = baseUrl.trim();
        if (trimmedBase.isEmpty()) {
            return null;
        }
        int hashIndex = trimmedBase.indexOf('#');
        String baseWithoutHash = hashIndex >= 0 ? trimmedBase.substring(0, hashIndex) : trimmedBase;
        return baseWithoutHash + "#" + hash;
    }

    @Nullable
    private static String extractUriHost(@Nullable String uri) {
        if (isBlank(uri)) {
            return null;
        }
        String host = Uri.parse(uri.trim()).getHost();
        if (isBlank(host)) {
            return null;
        }
        return host.trim();
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
