package com.opencode.skill;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.callback.SessionListener;
import com.opencode.skill.callback.SessionStatusCallback;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.callback.SkillWecodeStatusCallback;
import com.opencode.skill.constant.MessageType;
import com.opencode.skill.constant.SessionStatus;
import com.opencode.skill.constant.SkillWeCodeAction;
import com.opencode.skill.constant.SkillWecodeStatus;
import com.opencode.skill.model.ChatMessage;
import com.opencode.skill.model.CloseSkillResult;
import com.opencode.skill.model.ControlSkillWeCodeResult;
import com.opencode.skill.model.CreateSessionRequest;
import com.opencode.skill.model.ExecuteSkillParams;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.ReplyPermissionResult;
import com.opencode.skill.model.SendMessageResult;
import com.opencode.skill.model.SendMessageToIMResult;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.model.StopSkillResult;
import com.opencode.skill.model.StreamMessage;
import com.opencode.skill.network.ApiClient;
import com.opencode.skill.network.StreamingMessageCache;
import com.opencode.skill.network.WebSocketManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Skill SDK 主类 - 单例模式
 * 提供 13 个公开接口用于与 Skill 服务端交互
 */
public final class SkillSDK {

    private static volatile SkillSDK instance;

    @NonNull
    private final ApiClient apiClient;
    @NonNull
    private final WebSocketManager webSocketManager;
    @NonNull
    private final StreamingMessageCache streamingCache;
    @NonNull
    private final Map<String, SessionStatusCallback> statusCallbacks = new ConcurrentHashMap<>();
    @NonNull
    private final List<SkillWecodeStatusCallback> wecodeStatusCallbacks = new ArrayList<>();
    @Nullable
    private SkillSDKConfig config;

    private SkillSDK() {
        this.apiClient = new ApiClient();
        this.webSocketManager = WebSocketManager.getInstance();
        this.streamingCache = new StreamingMessageCache();
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
        this.apiClient.setBaseUrl(config.getBaseUrl());
        this.webSocketManager.setBaseUrl(config.getBaseUrl());
    }

    public boolean isInitialized() {
        return config != null;
    }

    // ==================== 1. executeSkill ====================
    
    public void executeSkill(@NonNull ExecuteSkillParams params, @NonNull SkillCallback<SkillSession> callback) {
        checkInitialized();

        CreateSessionRequest request = new CreateSessionRequest(
                Long.parseLong(params.getUserId()),
                params.getSkillDefinitionId()
        );
        request.agentId(params.getAgentId());
        request.title(params.getTitle());
        request.imChatId(params.getImChatId());

        apiClient.createSession(request, new SkillCallback<SkillSession>() {
            @Override
            public void onSuccess(@Nullable SkillSession session) {
                if (session == null) {
                    callback.onError(new SessionError("NULL_RESPONSE", "Session is null"));
                    return;
                }

                String sessionId = String.valueOf(session.getId());

                SessionListener internalListener = new SessionListener() {
                    @Override
                    public void onMessage(@NonNull StreamMessage message) {
                        streamingCache.updateCache(sessionId, message);
                        notifyStatusChange(sessionId, message.getType());
                    }

                    @Override
                    public void onError(@Nullable SessionError error) {
                        if (error != null) {
                            notifyStatusError(sessionId, error);
                        }
                    }

                    @Override
                    public void onClose(@Nullable String reason) {
                        notifyStatusChange(sessionId, MessageType.ERROR);
                    }
                };

                webSocketManager.registerListener(sessionId, internalListener);
                webSocketManager.connect();

                apiClient.sendMessage(session.getId(), params.getSkillContent(), new SkillCallback<SendMessageResult>() {
                    @Override
                    public void onSuccess(@Nullable SendMessageResult result) {
                        callback.onSuccess(session);
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        callback.onSuccess(session);
                    }
                });
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    // ==================== 2. closeSkill ====================
    
    public void closeSkill(@NonNull String sessionId, @NonNull SkillCallback<CloseSkillResult> callback) {
        checkInitialized();

        webSocketManager.clearListeners(sessionId);
        streamingCache.clearCache(sessionId);
        statusCallbacks.remove(sessionId);

        apiClient.closeSession(Long.parseLong(sessionId), callback);
    }

    // ==================== 3. stopSkill ====================
    
    public void stopSkill(@NonNull String sessionId, @NonNull SkillCallback<StopSkillResult> callback) {
        checkInitialized();

        webSocketManager.clearListeners(sessionId);
        streamingCache.clearCache(sessionId);
        notifyStatusChange(sessionId, "stopped");

        callback.onSuccess(new StopSkillResult("success"));
    }

    // ==================== 4. onSessionStatusChange ====================
    
    public void onSessionStatusChange(@NonNull String sessionId, @NonNull SessionStatusCallback callback) {
        checkInitialized();
        statusCallbacks.put(sessionId, callback);
    }

    // ==================== 5. onSkillWecodeStatusChange ====================
    
    public void onSkillWecodeStatusChange(@NonNull SkillWecodeStatusCallback callback) {
        checkInitialized();
        synchronized (wecodeStatusCallbacks) {
            if (!wecodeStatusCallbacks.contains(callback)) {
                wecodeStatusCallbacks.add(callback);
            }
        }
    }

    public void removeSkillWecodeStatusCallback(@NonNull SkillWecodeStatusCallback callback) {
        synchronized (wecodeStatusCallbacks) {
            wecodeStatusCallbacks.remove(callback);
        }
    }

    // ==================== 6. regenerateAnswer ====================
    
    public void regenerateAnswer(@NonNull String sessionId, @NonNull String content, @NonNull SkillCallback<SendMessageResult> callback) {
        checkInitialized();
        apiClient.sendMessage(Long.parseLong(sessionId), content, callback);
    }

    // ==================== 7. sendMessageToIM ====================
    
    public void sendMessageToIM(@NonNull String sessionId, @NonNull String content, @NonNull SkillCallback<SendMessageToIMResult> callback) {
        checkInitialized();
        apiClient.sendMessageToIM(Long.parseLong(sessionId), content, callback);
    }

    // ==================== 8. getSessionMessage ====================
    
    public void getSessionMessage(@NonNull String sessionId, int page, int size, @NonNull SkillCallback<PageResult<ChatMessage>> callback) {
        checkInitialized();

        apiClient.getMessages(Long.parseLong(sessionId), page, size, new SkillCallback<PageResult<ChatMessage>>() {
            @Override
            public void onSuccess(@Nullable PageResult<ChatMessage> result) {
                if (result == null) {
                    callback.onSuccess(new PageResult<>());
                    return;
                }

                ChatMessage streamingMessage = streamingCache.getStreamingMessage(sessionId);
                if (streamingMessage != null && streamingCache.isStreaming(sessionId)) {
                    List<ChatMessage> mergedList = new ArrayList<>(result.getContent());
                    mergedList.add(streamingMessage);
                    result.setContent(mergedList);
                    result.setTotalElements(result.getTotalElements() + 1);
                }

                callback.onSuccess(result);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    // ==================== 9. registerSessionListener ====================
    
    public void registerSessionListener(@NonNull String sessionId, @NonNull SessionListener listener) {
        checkInitialized();
        webSocketManager.registerListener(sessionId, listener);
    }

    // ==================== 10. unregisterSessionListener ====================
    
    public void unregisterSessionListener(@NonNull String sessionId, @NonNull SessionListener listener) {
        checkInitialized();
        webSocketManager.unregisterListener(sessionId, listener);
    }

    // ==================== 11. sendMessage ====================
    
    public void sendMessage(@NonNull String sessionId, @NonNull String content, @NonNull SkillCallback<SendMessageResult> callback) {
        checkInitialized();

        if (!webSocketManager.isConnected()) {
            webSocketManager.connect();
        }

        apiClient.sendMessage(Long.parseLong(sessionId), content, callback);
    }

    // ==================== 12. replyPermission ====================
    
    public void replyPermission(@NonNull String sessionId, @NonNull String permissionId, boolean approved, @NonNull SkillCallback<ReplyPermissionResult> callback) {
        checkInitialized();

        apiClient.replyPermission(Long.parseLong(sessionId), permissionId, approved, new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                callback.onSuccess(new ReplyPermissionResult(true, permissionId, approved));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    // ==================== 13. controlSkillWeCode ====================
    
    public void controlSkillWeCode(@NonNull SkillWeCodeAction action, @NonNull SkillCallback<ControlSkillWeCodeResult> callback) {
        checkInitialized();

        notifyWecodeStatusChange(action == SkillWeCodeAction.CLOSE ? SkillWecodeStatus.CLOSED : SkillWecodeStatus.MINIMIZED);

        callback.onSuccess(new ControlSkillWeCodeResult("success"));
    }

    // ==================== 辅助方法 ====================

    private void checkInitialized() {
        if (config == null) {
            throw new IllegalStateException("SkillSDK is not initialized. Call initialize() first.");
        }
    }

    private void notifyStatusChange(@NonNull String sessionId, @NonNull String messageType) {
        SessionStatusCallback callback = statusCallbacks.get(sessionId);
        if (callback != null) {
            String status;
            if (MessageType.DELTA.equals(messageType)) {
                status = SessionStatus.EXECUTING.getValue();
            } else if (MessageType.DONE.equals(messageType)) {
                status = SessionStatus.COMPLETED.getValue();
            } else if (MessageType.ERROR.equals(messageType) || MessageType.AGENT_OFFLINE.equals(messageType)) {
                status = SessionStatus.STOPPED.getValue();
            } else if ("stopped".equals(messageType)) {
                status = SessionStatus.STOPPED.getValue();
            } else {
                status = SessionStatus.EXECUTING.getValue();
            }
            callback.onStatusChange(sessionId, status);
        }
    }

    private void notifyStatusError(@NonNull String sessionId, @NonNull SessionError error) {
        SessionStatusCallback callback = statusCallbacks.get(sessionId);
        if (callback != null) {
            callback.onError(sessionId, error);
        }
    }

    private void notifyWecodeStatusChange(@NonNull SkillWecodeStatus status) {
        synchronized (wecodeStatusCallbacks) {
            for (SkillWecodeStatusCallback callback : new ArrayList<>(wecodeStatusCallbacks)) {
                callback.onStatusChange(status, System.currentTimeMillis(), null);
            }
        }
    }

    public void shutdown() {
        webSocketManager.shutdown();
        apiClient.shutdown();
        statusCallbacks.clear();
        wecodeStatusCallbacks.clear();
        streamingCache.clearAll();
        config = null;
    }

    // ==================== 同步方法 ====================

    @Nullable
    public SkillSession executeSkillSync(@NonNull ExecuteSkillParams params) throws Exception {
        AtomicReference<SkillSession> result = new AtomicReference<>();
        AtomicReference<Throwable> error = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);

        executeSkill(params, new SkillCallback<SkillSession>() {
            @Override
            public void onSuccess(@Nullable SkillSession session) {
                result.set(session);
                latch.countDown();
            }

            @Override
            public void onError(@NonNull Throwable e) {
                error.set(e);
                latch.countDown();
            }
        });

        if (!latch.await(60, TimeUnit.SECONDS)) {
            throw new Exception("executeSkill timeout");
        }

        if (error.get() != null) {
            throw new Exception(error.get());
        }

        return result.get();
    }

    @Nullable
    public CloseSkillResult closeSkillSync(@NonNull String sessionId) throws Exception {
        AtomicReference<CloseSkillResult> result = new AtomicReference<>();
        AtomicReference<Throwable> error = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);

        closeSkill(sessionId, new SkillCallback<CloseSkillResult>() {
            @Override
            public void onSuccess(@Nullable CloseSkillResult r) {
                result.set(r);
                latch.countDown();
            }

            @Override
            public void onError(@NonNull Throwable e) {
                error.set(e);
                latch.countDown();
            }
        });

        if (!latch.await(30, TimeUnit.SECONDS)) {
            throw new Exception("closeSkill timeout");
        }

        if (error.get() != null) {
            throw new Exception(error.get());
        }

        return result.get();
    }

    @Nullable
    public SendMessageResult sendMessageSync(@NonNull String sessionId, @NonNull String content) throws Exception {
        AtomicReference<SendMessageResult> result = new AtomicReference<>();
        AtomicReference<Throwable> error = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);

        sendMessage(sessionId, content, new SkillCallback<SendMessageResult>() {
            @Override
            public void onSuccess(@Nullable SendMessageResult r) {
                result.set(r);
                latch.countDown();
            }

            @Override
            public void onError(@NonNull Throwable e) {
                error.set(e);
                latch.countDown();
            }
        });

        if (!latch.await(30, TimeUnit.SECONDS)) {
            throw new Exception("sendMessage timeout");
        }

        if (error.get() != null) {
            throw new Exception(error.get());
        }

        return result.get();
    }

    @Nullable
    public PageResult<ChatMessage> getSessionMessageSync(@NonNull String sessionId, int page, int size) throws Exception {
        AtomicReference<PageResult<ChatMessage>> result = new AtomicReference<>();
        AtomicReference<Throwable> error = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);

        getSessionMessage(sessionId, page, size, new SkillCallback<PageResult<ChatMessage>>() {
            @Override
            public void onSuccess(@Nullable PageResult<ChatMessage> r) {
                result.set(r);
                latch.countDown();
            }

            @Override
            public void onError(@NonNull Throwable e) {
                error.set(e);
                latch.countDown();
            }
        });

        if (!latch.await(30, TimeUnit.SECONDS)) {
            throw new Exception("getSessionMessage timeout");
        }

        if (error.get() != null) {
            throw new Exception(error.get());
        }

        return result.get();
    }
}