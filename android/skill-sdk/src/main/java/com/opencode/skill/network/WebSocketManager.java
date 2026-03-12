package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.opencode.skill.SkillSDKConfig;
import com.opencode.skill.callback.SessionListener;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.SkillSdkException;
import com.opencode.skill.model.StreamMessage;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/**
* WebSocket connection + listener router.
*/
public final class WebSocketManager {
    public interface InternalListener {
        void onMessage(@NonNull StreamMessage message);

        default void onError(@NonNull SessionError error) {
        }

        default void onClosed(@Nullable String reason) {
        }
    }

    private static volatile WebSocketManager instance;

    @Nullable
    private OkHttpClient okHttpClient;
    @Nullable
    private String baseUrl;
    private boolean enableReconnect;
    private long reconnectIntervalMs;

    @Nullable
    private volatile WebSocket webSocket;
    private volatile boolean connected;
    private volatile boolean connecting;
    private volatile boolean manualClose;

    @NonNull
    private final Map<Long, CopyOnWriteArrayList<SessionListener>> sessionListeners = new ConcurrentHashMap<>();
    @NonNull
    private final CopyOnWriteArrayList<InternalListener> internalListeners = new CopyOnWriteArrayList<>();
    @NonNull
    private final CopyOnWriteArrayList<SkillCallback<Boolean>> pendingConnectCallbacks = new CopyOnWriteArrayList<>();
    @NonNull
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private WebSocketManager() {
    }

    @NonNull
    public static WebSocketManager getInstance() {
        if (instance == null) {
            synchronized (WebSocketManager.class) {
                if (instance == null) {
                    instance = new WebSocketManager();
                }
            }
        }
        return instance;
    }

    public synchronized void configure(@NonNull SkillSDKConfig config) {
        this.baseUrl = trimTrailingSlash(config.getBaseUrl());
        this.enableReconnect = config.isEnableReconnect();
        this.reconnectIntervalMs = config.getReconnectInterval();
        this.okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .pingInterval(30, TimeUnit.SECONDS)
                .build();
    }

    public void connect(@NonNull SkillCallback<Boolean> callback) {
        if (connected) {
            callback.onSuccess(Boolean.TRUE);
            return;
        }

        pendingConnectCallbacks.add(callback);
        synchronized (this) {
            if (connected) {
                flushConnectSuccess();
                return;
            }
            if (connecting) {
                return;
            }
            ensureConfigured();
            connecting = true;
            manualClose = false;
            Request request = new Request.Builder().url(buildWsUrl()).build();
            webSocket = requireClient().newWebSocket(request, new InternalWebSocketListener());
        }
    }

    public synchronized void disconnect() {
        manualClose = true;
        connecting = false;
        connected = false;
        if (webSocket != null) {
            webSocket.close(1000, "Client closing");
            webSocket = null;
        }
    }

    public boolean isConnected() {
        return connected;
    }

    public void addInternalListener(@NonNull InternalListener listener) {
        internalListeners.addIfAbsent(listener);
    }

    public void removeInternalListener(@NonNull InternalListener listener) {
        internalListeners.remove(listener);
    }

    public void registerListener(long welinkSessionId, @NonNull SessionListener listener) {
        sessionListeners.computeIfAbsent(welinkSessionId, key -> new CopyOnWriteArrayList<>()).addIfAbsent(listener);
    }

    public void unregisterListener(long welinkSessionId, @NonNull SessionListener listener) {
        CopyOnWriteArrayList<SessionListener> listeners = sessionListeners.get(welinkSessionId);
        if (listeners == null) {
            return;
        }
        listeners.remove(listener);
        if (listeners.isEmpty()) {
            sessionListeners.remove(welinkSessionId);
        }
    }

    public void clearSessionListeners(long welinkSessionId) {
        sessionListeners.remove(welinkSessionId);
    }

    public void clearAllListeners() {
        sessionListeners.clear();
    }

    public boolean hasAnySessionListeners() {
        return !sessionListeners.isEmpty();
    }

    public synchronized void shutdown() {
        disconnect();
        clearAllListeners();
        internalListeners.clear();
        pendingConnectCallbacks.clear();
        scheduler.shutdownNow();
        if (okHttpClient != null) {
            okHttpClient.dispatcher().executorService().shutdown();
            okHttpClient.connectionPool().evictAll();
        }
    }

    private void handleRawMessage(@NonNull String text) {
        StreamMessage message;
        try {
            message = parseMessage(text);
        } catch (Exception parseError) {
            SessionError error = new SessionError("PARSE_ERROR", parseError.getMessage() == null
                    ? "Failed to parse websocket message" : parseError.getMessage());
            notifyAllError(error);
            for (InternalListener listener : internalListeners) {
                listener.onError(error);
            }
            return;
        }

        for (InternalListener listener : internalListeners) {
            listener.onMessage(message);
        }

        Long sessionId = parseSessionId(message.getWelinkSessionId());
        if (sessionId == null) {
            return;
        }
        List<SessionListener> listeners = sessionListeners.getOrDefault(sessionId, new CopyOnWriteArrayList<>());
        for (SessionListener listener : listeners) {
            try {
                listener.onMessage(message);
            } catch (Exception callbackError) {
                SessionError error = new SessionError("CALLBACK_ERROR", callbackError.getMessage() == null
                        ? "Session listener callback failed" : callbackError.getMessage());
                listener.onError(error);
            }
        }
    }

    @NonNull
    private StreamMessage parseMessage(@NonNull String text) {
        JsonObject json = JsonParser.parseString(text).getAsJsonObject();
        StreamMessage message = new StreamMessage();
        message.setRaw(json.deepCopy());

        message.setType(getString(json, "type"));
        message.setSeq(getLong(json, "seq"));
        message.setWelinkSessionId(firstNonEmpty(getString(json, "welinkSessionId"), getString(json, "sessionId")));
        message.setEmittedAt(getString(json, "emittedAt"));

        message.setMessageId(getString(json, "messageId"));
        message.setMessageSeq(getInteger(json, "messageSeq"));
        message.setRole(getString(json, "role"));
        message.setPartId(getString(json, "partId"));
        message.setPartSeq(getInteger(json, "partSeq"));

        message.setContent(getString(json, "content"));
        message.setToolName(getString(json, "toolName"));
        message.setToolCallId(getString(json, "toolCallId"));
        message.setStatus(getString(json, "status"));
        message.setInput(getElement(json, "input"));
        message.setOutput(getString(json, "output"));
        message.setError(getString(json, "error"));
        message.setTitle(getString(json, "title"));
        message.setHeader(getString(json, "header"));
        message.setQuestion(getString(json, "question"));
        message.setOptions(getStringList(json, "options"));
        message.setFileName(getString(json, "fileName"));
        message.setFileUrl(getString(json, "fileUrl"));
        message.setFileMime(getString(json, "fileMime"));
        message.setTokens(getObject(json, "tokens"));
        message.setCost(getDouble(json, "cost"));
        message.setReason(getString(json, "reason"));
        message.setSessionStatus(getString(json, "sessionStatus"));
        message.setPermissionId(getString(json, "permissionId"));
        message.setPermType(getString(json, "permType"));
        message.setMetadata(getObject(json, "metadata"));
        message.setResponse(getString(json, "response"));
        message.setMessages(getArray(json, "messages"));
        message.setParts(getArray(json, "parts"));
        return message;
    }

    @Nullable
    private Long parseSessionId(@Nullable String sessionIdRaw) {
        if (sessionIdRaw == null || sessionIdRaw.isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(sessionIdRaw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private void notifyAllError(@NonNull SessionError error) {
        for (List<SessionListener> listeners : sessionListeners.values()) {
            for (SessionListener listener : listeners) {
                listener.onError(error);
            }
        }
    }

    private void notifyAllClosed(@Nullable String reason) {
        for (List<SessionListener> listeners : sessionListeners.values()) {
            for (SessionListener listener : listeners) {
                listener.onClose(reason);
            }
        }
        for (InternalListener listener : internalListeners) {
            listener.onClosed(reason);
        }
    }

    private void flushConnectSuccess() {
        for (SkillCallback<Boolean> callback : new ArrayList<>(pendingConnectCallbacks)) {
            callback.onSuccess(Boolean.TRUE);
        }
        pendingConnectCallbacks.clear();
    }

    private void flushConnectError(@NonNull Throwable error) {
        for (SkillCallback<Boolean> callback : new ArrayList<>(pendingConnectCallbacks)) {
            callback.onError(error);
        }
        pendingConnectCallbacks.clear();
    }

    private void scheduleReconnect() {
        if (!enableReconnect || manualClose) {
            return;
        }
        scheduler.schedule(() -> connect(new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                // Reconnected.
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // Keep retrying.
            }
        }), reconnectIntervalMs, TimeUnit.MILLISECONDS);
    }

    @NonNull
    private synchronized OkHttpClient requireClient() {
        if (okHttpClient == null) {
            throw new IllegalStateException("WebSocketManager is not configured");
        }
        return okHttpClient;
    }

    private synchronized void ensureConfigured() {
        if (baseUrl == null || baseUrl.isEmpty() || okHttpClient == null) {
            throw new SkillSdkException(5000, "WebSocketManager is not configured");
        }
    }

    @NonNull
    private synchronized String buildWsUrl() {
        if (baseUrl == null) {
            throw new IllegalStateException("baseUrl not configured");
        }
        String wsBase = baseUrl.replaceFirst("^http://", "ws://").replaceFirst("^https://", "wss://");
        return wsBase + "/ws/skill/stream";
    }

    @NonNull
    private static String trimTrailingSlash(@NonNull String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    @Nullable
    private static JsonElement getElement(@NonNull JsonObject json, @NonNull String key) {
        if (!json.has(key) || json.get(key).isJsonNull()) {
            return null;
        }
        return json.get(key);
    }

    @Nullable
    private static JsonObject getObject(@NonNull JsonObject json, @NonNull String key) {
        JsonElement value = getElement(json, key);
        if (value == null || !value.isJsonObject()) {
            return null;
        }
        return value.getAsJsonObject();
    }

    @Nullable
    private static JsonArray getArray(@NonNull JsonObject json, @NonNull String key) {
        JsonElement value = getElement(json, key);
        if (value == null || !value.isJsonArray()) {
            return null;
        }
        return value.getAsJsonArray();
    }

    @Nullable
    private static String getString(@NonNull JsonObject json, @NonNull String key) {
        JsonElement value = getElement(json, key);
        if (value == null || !value.isJsonPrimitive()) {
            return null;
        }
        return value.getAsString();
    }

    @Nullable
    private static Long getLong(@NonNull JsonObject json, @NonNull String key) {
        JsonElement value = getElement(json, key);
        if (value == null || !value.isJsonPrimitive()) {
            return null;
        }
        return value.getAsLong();
    }

    @Nullable
    private static Integer getInteger(@NonNull JsonObject json, @NonNull String key) {
        JsonElement value = getElement(json, key);
        if (value == null || !value.isJsonPrimitive()) {
            return null;
        }
        return value.getAsInt();
    }

    @Nullable
    private static Double getDouble(@NonNull JsonObject json, @NonNull String key) {
        JsonElement value = getElement(json, key);
        if (value == null || !value.isJsonPrimitive()) {
            return null;
        }
        return value.getAsDouble();
    }

    @NonNull
    private static List<String> getStringList(@NonNull JsonObject json, @NonNull String key) {
        JsonArray array = getArray(json, key);
        if (array == null) {
            return Collections.emptyList();
        }
        List<String> result = new ArrayList<>();
        for (JsonElement element : array) {
            if (element != null && element.isJsonPrimitive()) {
                result.add(element.getAsString());
            }
        }
        return result;
    }

    @Nullable
    private static String firstNonEmpty(@Nullable String first, @Nullable String second) {
        if (first != null && !first.isEmpty()) {
            return first;
        }
        if (second != null && !second.isEmpty()) {
            return second;
        }
        return null;
    }

    private final class InternalWebSocketListener extends WebSocketListener {
        @Override
        public void onOpen(@NonNull WebSocket webSocket, @NonNull Response response) {
            connected = true;
            connecting = false;
            flushConnectSuccess();
        }

        @Override
        public void onMessage(@NonNull WebSocket webSocket, @NonNull String text) {
            handleRawMessage(text);
        }

        @Override
        public void onClosed(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
            connected = false;
            connecting = false;
            notifyAllClosed(reason);
            scheduleReconnect();
        }

        @Override
        public void onFailure(@NonNull WebSocket webSocket, @NonNull Throwable t, @Nullable Response response) {
            connected = false;
            connecting = false;
            SkillSdkException exception = new SkillSdkException(6000,
                    t.getMessage() == null ? "WebSocket error" : t.getMessage(), t);
            SessionError sessionError = new SessionError("WEBSOCKET_ERROR", exception.getErrorMessage());
            notifyAllError(sessionError);
            for (InternalListener listener : internalListeners) {
                listener.onError(sessionError);
            }
            flushConnectError(exception);
            scheduleReconnect();
        }
    }
}
