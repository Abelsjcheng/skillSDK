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
import com.opencode.skill.model.CloseSkillResult;
import com.opencode.skill.model.ControlSkillWeCodeParams;
import com.opencode.skill.model.ControlSkillWeCodeResult;
import com.opencode.skill.model.CreateSessionParams;
import com.opencode.skill.model.GetSessionMessageParams;
import com.opencode.skill.model.OnSessionStatusChangeParams;
import com.opencode.skill.model.OnSkillWecodeStatusChangeParams;
import com.opencode.skill.model.PageResult;
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
import com.opencode.skill.network.ApiClient;
import com.opencode.skill.network.StreamingMessageCache;
import com.opencode.skill.network.WebSocketManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
* Singleton SDK exposing 13 public APIs from SkillClientSdkInterfaceV1.md.
*/
public final class SkillSDK {
    private static volatile SkillSDK instance;

    @NonNull
    private final ApiClient apiClient = new ApiClient();
    @NonNull
    private final WebSocketManager webSocketManager = WebSocketManager.getInstance();
    @NonNull
    private final StreamingMessageCache streamingMessageCache = new StreamingMessageCache();

    @NonNull
    private final Map<Long, CopyOnWriteArrayList<SessionStatusCallback>> sessionStatusCallbacks = new ConcurrentHashMap<>();
    @NonNull
    private final CopyOnWriteArrayList<SkillWecodeStatusCallback> wecodeStatusCallbacks = new CopyOnWriteArrayList<>();
    @NonNull
    private final Map<Long, ListenerBinding> listenerBindings = new ConcurrentHashMap<>();
    @NonNull
    private final Map<Long, Boolean> awaitingExecutingBySession = new ConcurrentHashMap<>();

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
        if (params.getAk().trim().isEmpty() || params.getImGroupId().trim().isEmpty()) {
            callback.onError(error(1000, "ak and imGroupId are required"));
            return;
        }

        ensureConnected(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                apiClient.listSessions(params.getImGroupId(), params.getAk(), "ACTIVE", 0, 20,
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

        try {
            webSocketManager.disconnect();
            webSocketManager.clearAllListeners();
            listenerBindings.clear();
            sessionStatusCallbacks.clear();
            awaitingExecutingBySession.clear();
            streamingMessageCache.clearAll();
            callback.onSuccess(new CloseSkillResult("success"));
        } catch (Exception e) {
            callback.onError(error(5000, "Close skill failed: " + e.getMessage()));
        }
    }

    // 3. stopSkill
    public void stopSkill(@NonNull StopSkillParams params, @NonNull SkillCallback<StopSkillResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params.getWelinkSessionId() <= 0) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }

        apiClient.abortSession(params.getWelinkSessionId(), new SkillCallback<StopSkillResult>() {
            @Override
            public void onSuccess(@Nullable StopSkillResult result) {
                StopSkillResult resolved = result == null
                        ? new StopSkillResult(params.getWelinkSessionId(), "aborted")
                        : result;
                awaitingExecutingBySession.put(params.getWelinkSessionId(), Boolean.FALSE);
                emitSessionStatus(params.getWelinkSessionId(), SessionStatus.STOPPED);
                callback.onSuccess(resolved);
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
        if (params.getWelinkSessionId() <= 0 || params.getCallback() == null) {
            throw error(1000, "welinkSessionId and callback are required");
        }
        if (!webSocketManager.isConnected()) {
            throw error(3000, "WebSocket is not connected");
        }
        sessionStatusCallbacks.computeIfAbsent(params.getWelinkSessionId(), key -> new CopyOnWriteArrayList<>())
                .addIfAbsent(params.getCallback());
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
        if (params.getWelinkSessionId() <= 0) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }

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

    // 7. sendMessageToIM
    public void sendMessageToIM(@NonNull SendMessageToIMParams params,
            @NonNull SkillCallback<SendMessageToIMResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params.getWelinkSessionId() <= 0) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }
        if (params.getMessageId() != null && params.getMessageId().trim().isEmpty()) {
            callback.onError(error(1000, "messageId cannot be empty"));
            return;
        }
        if (params.getChatId() != null && params.getChatId().trim().isEmpty()) {
            callback.onError(error(1000, "chatId cannot be empty"));
            return;
        }

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
                        callback.onSuccess(result == null ? new SendMessageToIMResult("failed", null, null, "Empty response") : result);
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
        if (params.getWelinkSessionId() <= 0) {
            callback.onError(error(1000, "welinkSessionId is invalid"));
            return;
        }
        int page = Math.max(params.getPage(), 0);
        int size = params.getSize() <= 0 ? 50 : params.getSize();

        apiClient.getMessages(params.getWelinkSessionId(), page, size, new SkillCallback<PageResult<SessionMessage>>() {
            @Override
            public void onSuccess(@Nullable PageResult<SessionMessage> result) {
                PageResult<SessionMessage> serverPage = result == null ? new PageResult<>() : result;
                PageResult<SessionMessage> merged = streamingMessageCache.mergeWithLocalCache(params.getWelinkSessionId(), page, size,
                        serverPage);
                callback.onSuccess(merged);
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
        if (params.getWelinkSessionId() <= 0 || params.getOnMessage() == null) {
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
        if (params.getWelinkSessionId() <= 0) {
            throw error(1000, "welinkSessionId is required");
        }

        ListenerBinding binding = listenerBindings.remove(params.getWelinkSessionId());
        if (binding == null) {
            throw error(4006, "Listener does not exist");
        }

        webSocketManager.unregisterListener(params.getWelinkSessionId(), binding.sessionListener);
        return new UnregisterSessionListenerResult("success");
    }

    // 11. sendMessage
    public void sendMessage(@NonNull SendMessageParams params, @NonNull SkillCallback<SendMessageResult> callback) {
        if (!isInitialized()) {
            callback.onError(error(5000, "SkillSDK is not initialized"));
            return;
        }
        if (params.getWelinkSessionId() <= 0 || params.getContent().trim().isEmpty()) {
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
        if (params.getWelinkSessionId() <= 0 || params.getPermId().trim().isEmpty() || params.getResponse().trim().isEmpty()) {
            callback.onError(error(1000, "welinkSessionId, permId and response are required"));
            return;
        }
        if (!isPermissionResponseValid(params.getResponse())) {
            callback.onError(error(1000, "response must be once/always/reject"));
            return;
        }

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

    public synchronized void shutdown() {
        webSocketManager.removeInternalListener(internalStreamListener);
        webSocketManager.shutdown();
        apiClient.shutdown();
        listenerBindings.clear();
        sessionStatusCallbacks.clear();
        wecodeStatusCallbacks.clear();
        awaitingExecutingBySession.clear();
        streamingMessageCache.clearAll();
        config = null;
    }

    private void sendMessageInternal(long welinkSessionId, @NonNull String content, @Nullable String toolCallId,
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

                if (params.getMessageId() != null) {
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
        Long sessionId = parseLong(message.getWelinkSessionId());
        if (sessionId == null) {
            return;
        }
        SessionStatus mapped = mapStatus(sessionId, message);
        if (mapped == null) {
            return;
        }
        emitSessionStatus(sessionId, mapped);
    }

    private void emitSessionStatus(long sessionId, @NonNull SessionStatus status) {
        List<SessionStatusCallback> callbacks = sessionStatusCallbacks.get(sessionId);
        if (callbacks == null || callbacks.isEmpty()) {
            return;
        }
        SessionStatusResult result = new SessionStatusResult(status);
        for (SessionStatusCallback callback : new ArrayList<>(callbacks)) {
            callback.onStatusChange(result);
        }
    }

    private void emitWecodeStatus(@NonNull SkillWecodeStatus status, @Nullable String message) {
        SkillWecodeStatusResult result = new SkillWecodeStatusResult(status, System.currentTimeMillis(), message);
        for (SkillWecodeStatusCallback callback : new ArrayList<>(wecodeStatusCallbacks)) {
            callback.onStatusChange(result);
        }
    }

    @Nullable
    private SessionStatus mapStatus(long sessionId, @NonNull StreamMessage message) {
        String type = message.getType();
        if (type == null) {
            return null;
        }
        switch (type) {
            case MessageType.SESSION_STATUS:
                if ("busy".equalsIgnoreCase(message.getSessionStatus()) || "retry".equalsIgnoreCase(message.getSessionStatus())) {
                    if (Boolean.TRUE.equals(awaitingExecutingBySession.get(sessionId))) {
                        return SessionStatus.EXECUTING;
                    }
                    return null;
                }
                if ("idle".equalsIgnoreCase(message.getSessionStatus())) {
                    awaitingExecutingBySession.put(sessionId, Boolean.FALSE);
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
        return sessions.stream()
                .filter(session -> "ACTIVE".equalsIgnoreCase(session.getStatus()))
                .filter(session -> params.getAk().equals(session.getAk()))
                .filter(session -> params.getImGroupId().equals(session.getImGroupId()))
                .max(Comparator.comparing(this::safeUpdatedAt))
                .orElse(null);
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

    @Nullable
    private static Long parseLong(@Nullable String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static final class ListenerBinding {
        @NonNull
        private final SessionListener sessionListener;

        private ListenerBinding(@NonNull SessionListener sessionListener) {
            this.sessionListener = sessionListener;
        }
    }
}
