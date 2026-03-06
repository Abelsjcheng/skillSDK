package com.opencode.skill;

import android.os.Handler;
import android.os.Looper;

import com.opencode.skill.api.SkillApiService;
import com.opencode.skill.config.SkillSDKConfig;
import com.opencode.skill.constant.SessionStatus;
import com.opencode.skill.constant.SkillWecodeStatus;
import com.opencode.skill.constant.StreamMessageType;
import com.opencode.skill.listener.SessionListener;
import com.opencode.skill.listener.SessionStatusCallback;
import com.opencode.skill.listener.SkillCallback;
import com.opencode.skill.listener.SkillWecodeStatusCallback;
import com.opencode.skill.model.AnswerResult;
import com.opencode.skill.model.ChatMessage;
import com.opencode.skill.model.CreateSessionRequest;
import com.opencode.skill.model.PageResult;
import com.opencode.skill.model.PermissionReplyRequest;
import com.opencode.skill.model.SendMessageRequest;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.model.StreamMessage;
import com.opencode.skill.websocket.SkillWebSocketManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class SkillSDK {
    private static SkillSDK instance;
    private final SkillSDKConfig config;
    private final SkillApiService apiService;
    private final SkillWebSocketManager wsManager;
    private final ExecutorService executorService;
    private final Handler mainHandler;
    private final Map<String, SkillSession> sessionCache;
    private final Map<String, List<SessionStatusCallback>> statusCallbacks;
    private final Map<String, String> sessionStatusMap;
    private SkillWecodeStatusCallback wecodeStatusCallback;

    private SkillSDK(SkillSDKConfig config) {
        this.config = config;
        this.executorService = Executors.newCachedThreadPool();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.sessionCache = new ConcurrentHashMap<>();
        this.statusCallbacks = new ConcurrentHashMap<>();
        this.sessionStatusMap = new ConcurrentHashMap<>();

        OkHttpClient okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.SECONDS)
                .readTimeout(config.getReadTimeout(), TimeUnit.SECONDS)
                .writeTimeout(config.getWriteTimeout(), TimeUnit.SECONDS)
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(config.getBaseUrl())
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        this.apiService = retrofit.create(SkillApiService.class);
        this.wsManager = new SkillWebSocketManager(config.getWsBaseUrl(), okHttpClient);
    }

    public static synchronized void initialize(SkillSDKConfig config) {
        if (instance == null) {
            instance = new SkillSDK(config);
        }
    }

    public static synchronized SkillSDK getInstance() {
        if (instance == null) {
            throw new IllegalStateException("SkillSDK not initialized. Call initialize() first.");
        }
        return instance;
    }

    public static synchronized void destroy() {
        if (instance != null) {
            instance.cleanup();
            instance = null;
        }
    }

    private void cleanup() {
        executorService.shutdown();
        for (String sessionId : sessionCache.keySet()) {
            wsManager.disconnect(sessionId);
        }
        sessionCache.clear();
        statusCallbacks.clear();
        sessionStatusMap.clear();
    }

    public void executeSkill(String imChatId, String userId, String skillContent, Long agentId, String title, SkillCallback<SkillSession> callback) {
        executorService.execute(() -> {
            Long userIdLong = Long.parseLong(userId);
            Long skillDefId = config.getDefaultSkillDefinitionId();
            
            CreateSessionRequest request = new CreateSessionRequest(userIdLong, skillDefId, agentId, title, imChatId);
            
            apiService.createSession(request).enqueue(new Callback<SkillSession>() {
                @Override
                public void onResponse(Call<SkillSession> call, Response<SkillSession> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        SkillSession session = response.body();
                        String sessionId = String.valueOf(session.getId());
                        sessionCache.put(sessionId, session);
                        sessionStatusMap.put(sessionId, SessionStatus.ACTIVE);
                        
                        SessionListenerImpl listener = new SessionListenerImpl(sessionId);
                        wsManager.connect(sessionId, listener);
                        
                        sendMessageInternal(sessionId, skillContent, new SkillCallback<Boolean>() {
                            @Override
                            public void onSuccess(Boolean result) {
                                mainHandler.post(() -> callback.onSuccess(session));
                            }

                            @Override
                            public void onError(Throwable error) {
                                mainHandler.post(() -> callback.onError(error));
                            }
                        });
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("Failed to create session: " + response.code())));
                    }
                }

                @Override
                public void onFailure(Call<SkillSession> call, Throwable t) {
                    mainHandler.post(() -> callback.onError(t));
                }
            });
        });
    }

    public void closeSkill(String sessionId, SkillCallback<Boolean> callback) {
        executorService.execute(() -> {
            Long sessionIdLong = Long.parseLong(sessionId);
            apiService.closeSession(sessionIdLong).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    if (response.isSuccessful()) {
                        wsManager.disconnect(sessionId);
                        sessionCache.remove(sessionId);
                        sessionStatusMap.remove(sessionId);
                        mainHandler.post(() -> callback.onSuccess(true));
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("Failed to close session: " + response.code())));
                    }
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    mainHandler.post(() -> callback.onError(t));
                }
            });
        });
    }

    public void stopSkill(String sessionId, SkillCallback<Boolean> callback) {
        wsManager.disconnect(sessionId);
        sessionStatusMap.put(sessionId, SessionStatus.STOPPED);
        notifyStatusChange(sessionId, SessionStatus.STOPPED);
        mainHandler.post(() -> callback.onSuccess(true));
    }

    public void onSessionStatus(String sessionId, SessionStatusCallback callback) {
        List<SessionStatusCallback> callbacks = statusCallbacks.computeIfAbsent(sessionId, k -> new ArrayList<>());
        callbacks.add(callback);
    }

    public void onSkillWecodeStatus(SkillWecodeStatusCallback callback) {
        this.wecodeStatusCallback = callback;
    }

    public void regenerateAnswer(String sessionId, SkillCallback<AnswerResult> callback) {
        getSessionMessage(sessionId, 0, 50, new SkillCallback<PageResult<ChatMessage>>() {
            @Override
            public void onSuccess(PageResult<ChatMessage> result) {
                if (result.getContent() != null && !result.getContent().isEmpty()) {
                    String lastUserContent = null;
                    for (int i = result.getContent().size() - 1; i >= 0; i--) {
                        ChatMessage msg = result.getContent().get(i);
                        if ("USER".equals(msg.getRole())) {
                            lastUserContent = msg.getContent();
                            break;
                        }
                    }
                    
                    if (lastUserContent != null) {
                        sendMessageInternal(sessionId, lastUserContent, new SkillCallback<Boolean>() {
                            @Override
                            public void onSuccess(Boolean result) {
                                AnswerResult answerResult = new AnswerResult();
                                answerResult.setSuccess(true);
                                mainHandler.post(() -> callback.onSuccess(answerResult));
                            }

                            @Override
                            public void onError(Throwable error) {
                                mainHandler.post(() -> callback.onError(error));
                            }
                        });
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("No user message found")));
                    }
                } else {
                    mainHandler.post(() -> callback.onError(new Exception("No messages found")));
                }
            }

            @Override
            public void onError(Throwable error) {
                mainHandler.post(() -> callback.onError(error));
            }
        });
    }

    public void sendMessageToIM(String sessionId, String content, SkillCallback<Boolean> callback) {
        executorService.execute(() -> {
            Long sessionIdLong = Long.parseLong(sessionId);
            SendMessageRequest request = new SendMessageRequest(content);
            
            apiService.sendMessageToIM(sessionIdLong, request).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        Map<String, Object> result = response.body();
                        Boolean success = (Boolean) result.get("success");
                        mainHandler.post(() -> callback.onSuccess(success != null && success));
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("Failed to send message to IM: " + response.code())));
                    }
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    mainHandler.post(() -> callback.onError(t));
                }
            });
        });
    }

    public void getSessionMessage(String sessionId, int page, int size, SkillCallback<PageResult<ChatMessage>> callback) {
        executorService.execute(() -> {
            Long sessionIdLong = Long.parseLong(sessionId);
            
            apiService.getMessages(sessionIdLong, page, size).enqueue(new Callback<PageResult<ChatMessage>>() {
                @Override
                public void onResponse(Call<PageResult<ChatMessage>> call, Response<PageResult<ChatMessage>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        mainHandler.post(() -> callback.onSuccess(response.body()));
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("Failed to get messages: " + response.code())));
                    }
                }

                @Override
                public void onFailure(Call<PageResult<ChatMessage>> call, Throwable t) {
                    mainHandler.post(() -> callback.onError(t));
                }
            });
        });
    }

    public void registerSessionListener(String sessionId, SessionListener listener) {
        wsManager.connect(sessionId, listener);
    }

    public void unregisterSessionListener(String sessionId, SessionListener listener) {
        wsManager.disconnect(sessionId, listener);
    }

    public void sendMessage(String sessionId, String content, SkillCallback<Boolean> callback) {
        sendMessageInternal(sessionId, content, callback);
    }

    private void sendMessageInternal(String sessionId, String content, SkillCallback<Boolean> callback) {
        executorService.execute(() -> {
            Long sessionIdLong = Long.parseLong(sessionId);
            SendMessageRequest request = new SendMessageRequest(content);
            
            apiService.sendMessage(sessionIdLong, request).enqueue(new Callback<ChatMessage>() {
                @Override
                public void onResponse(Call<ChatMessage> call, Response<ChatMessage> response) {
                    if (response.isSuccessful()) {
                        sessionStatusMap.put(sessionId, SessionStatus.EXECUTING);
                        notifyStatusChange(sessionId, SessionStatus.EXECUTING);
                        mainHandler.post(() -> callback.onSuccess(true));
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("Failed to send message: " + response.code())));
                    }
                }

                @Override
                public void onFailure(Call<ChatMessage> call, Throwable t) {
                    mainHandler.post(() -> callback.onError(t));
                }
            });
        });
    }

    public void replyPermission(String sessionId, String permissionId, boolean approved, SkillCallback<Boolean> callback) {
        executorService.execute(() -> {
            Long sessionIdLong = Long.parseLong(sessionId);
            PermissionReplyRequest request = new PermissionReplyRequest(approved);
            
            apiService.replyPermission(sessionIdLong, permissionId, request).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        Map<String, Object> result = response.body();
                        Boolean success = (Boolean) result.get("success");
                        mainHandler.post(() -> callback.onSuccess(success != null && success));
                    } else {
                        mainHandler.post(() -> callback.onError(new Exception("Failed to reply permission: " + response.code())));
                    }
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    mainHandler.post(() -> callback.onError(t));
                }
            });
        });
    }

    public void controlSkillWeCode(String action, SkillCallback<Boolean> callback) {
        if (SkillWecodeStatus.CLOSED.equals(action)) {
            if (wecodeStatusCallback != null) {
                mainHandler.post(() -> wecodeStatusCallback.onStatusChanged(SkillWecodeStatus.CLOSED));
            }
        } else if (SkillWecodeStatus.MINIMIZED.equals(action)) {
            if (wecodeStatusCallback != null) {
                mainHandler.post(() -> wecodeStatusCallback.onStatusChanged(SkillWecodeStatus.MINIMIZED));
            }
        }
        mainHandler.post(() -> callback.onSuccess(true));
    }

    private void notifyStatusChange(String sessionId, String status) {
        List<SessionStatusCallback> callbacks = statusCallbacks.get(sessionId);
        if (callbacks != null) {
            for (SessionStatusCallback callback : callbacks) {
                mainHandler.post(() -> callback.onStatusChanged(status));
            }
        }
    }

    private class SessionListenerImpl implements SessionListener {
        private final String sessionId;

        public SessionListenerImpl(String sessionId) {
            this.sessionId = sessionId;
        }

        @Override
        public void onMessage(StreamMessage message) {
            String type = message.getType();
            if (StreamMessageType.DONE.equals(type)) {
                sessionStatusMap.put(sessionId, SessionStatus.COMPLETED);
                notifyStatusChange(sessionId, SessionStatus.COMPLETED);
            } else if (StreamMessageType.ERROR.equals(type) || StreamMessageType.AGENT_OFFLINE.equals(type)) {
                sessionStatusMap.put(sessionId, SessionStatus.STOPPED);
                notifyStatusChange(sessionId, SessionStatus.STOPPED);
            } else if (StreamMessageType.DELTA.equals(type)) {
                sessionStatusMap.put(sessionId, SessionStatus.EXECUTING);
            }
        }

        @Override
        public void onError(com.opencode.skill.listener.SessionError error) {
            sessionStatusMap.put(sessionId, SessionStatus.STOPPED);
            notifyStatusChange(sessionId, SessionStatus.STOPPED);
        }

        @Override
        public void onClose(String reason) {
            if (!SessionStatus.COMPLETED.equals(sessionStatusMap.get(sessionId))) {
                sessionStatusMap.put(sessionId, SessionStatus.STOPPED);
                notifyStatusChange(sessionId, SessionStatus.STOPPED);
            }
        }
    }
}