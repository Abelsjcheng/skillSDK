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
import java.util.HashMap;
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
 * WebSocket 连接与会话监听分发管理器。
 * 统一维护底层长连接，并按 welinkSessionId 将服务端 onmessage 事件分发给对应会话监听器。
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
    @Nullable
    private String wsUrl;
    private boolean enableReconnect;
    private long reconnectIntervalMs;
    @NonNull
    private Map<String, String> webSocketHeaders = Collections.emptyMap();

    @Nullable
    private volatile WebSocket webSocket;
    private volatile boolean connected;
    private volatile boolean connecting;
    private volatile boolean manualClose;

    @NonNull
    private final Map<String, CopyOnWriteArrayList<SessionListener>> sessionListeners = new ConcurrentHashMap<>();
    @NonNull
    private final CopyOnWriteArrayList<InternalListener> internalListeners = new CopyOnWriteArrayList<>();
    @NonNull
    private final CopyOnWriteArrayList<SkillCallback<Boolean>> pendingConnectCallbacks = new CopyOnWriteArrayList<>();
    @NonNull
    private final Map<String, SessionRoundBuffer> roundBuffers = new ConcurrentHashMap<>();
    @NonNull
    private final Map<String, ReplayState> replayStates = new ConcurrentHashMap<>();
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
        this.wsUrl = normalizeOptionalString(config.getWsUrl());
        this.enableReconnect = config.isEnableReconnect();
        this.reconnectIntervalMs = config.getReconnectInterval();
        this.webSocketHeaders = mergeWebSocketHeaders(config);
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
            Request.Builder requestBuilder = new Request.Builder().url(buildWsUrl());
            for (Map.Entry<String, String> entry : webSocketHeaders.entrySet()) {
                requestBuilder.addHeader(entry.getKey(), entry.getValue());
            }
            Request request = requestBuilder.build();
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

    public void registerListener(@NonNull String welinkSessionId, @NonNull SessionListener listener) {
        ReplayState replayState = replayStates.computeIfAbsent(welinkSessionId, key -> new ReplayState());
        boolean shouldReplay = false;
        synchronized (replayState) {
            sessionListeners.computeIfAbsent(welinkSessionId, key -> new CopyOnWriteArrayList<>()).addIfAbsent(listener);
            SessionRoundBuffer buffer = roundBuffers.get(welinkSessionId);
            if (buffer != null && !buffer.completed && !replayState.replaying) {
                // 先将当前会话标记为“正在补发缓存”状态，再让监听器真正参与实时消息分发。
                // 这样可以兜住一个很小的并发窗口：如果此时服务端刚好又推来一条实时消息，
                // 该消息不会插到历史补发消息前面，而是先进入 pendingLiveEvents，等补发完成后再顺序下发。
                replayState.replaying = true;
                shouldReplay = true;
            }
        }
        if (shouldReplay) {
            replayBufferedEventsIfNeeded(welinkSessionId, replayState);
        }
    }

    public void unregisterListener(@NonNull String welinkSessionId, @NonNull SessionListener listener) {
        CopyOnWriteArrayList<SessionListener> listeners = sessionListeners.get(welinkSessionId);
        if (listeners == null) {
            return;
        }
        listeners.remove(listener);
        if (listeners.isEmpty()) {
            sessionListeners.remove(welinkSessionId);
        }
    }

    public void clearSessionListeners(@NonNull String welinkSessionId) {
        sessionListeners.remove(welinkSessionId);
    }

    public void clearAllListeners() {
        sessionListeners.clear();
    }

    public void clearRoundBuffer(@NonNull String welinkSessionId) {
        roundBuffers.remove(welinkSessionId);
        replayStates.remove(welinkSessionId);
    }

    public void clearAllRoundBuffers() {
        roundBuffers.clear();
        replayStates.clear();
    }

    public boolean hasAnySessionListeners() {
        return !sessionListeners.isEmpty();
    }

    public synchronized void shutdown() {
        disconnect();
        clearAllListeners();
        clearAllRoundBuffers();
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

        String sessionId = message.getWelinkSessionId();
        if (sessionId == null || sessionId.trim().isEmpty()) {
            return;
        }
        appendToRoundBuffer(sessionId, message);
        if (shouldCompleteCurrentRound(message)) {
            markRoundCompleted(sessionId);
        }
        List<SessionListener> listeners = sessionListeners.getOrDefault(sessionId, new CopyOnWriteArrayList<>());
        if (listeners.isEmpty()) {
            return;
        }
        if (enqueueLiveEventDuringReplay(sessionId, message)) {
            return;
        }
        dispatchToSessionListeners(listeners, message);
    }

    private void replayBufferedEventsIfNeeded(@NonNull String welinkSessionId, @NonNull ReplayState replayState) {
        SessionRoundBuffer buffer = roundBuffers.get(welinkSessionId);
        if (buffer == null || buffer.completed) {
            synchronized (replayState) {
                replayState.replaying = false;
            }
            return;
        }

        List<StreamMessage> snapshot;
        synchronized (buffer) {
            // 复制一份当前轮次事件快照进行补发，避免补发过程中实时消息继续写入 events 时，
            // 直接遍历原始列表导致顺序错乱或并发修改问题。
            snapshot = new ArrayList<>(buffer.events);
        }

        for (StreamMessage message : snapshot) {
            List<SessionListener> listeners = sessionListeners.getOrDefault(welinkSessionId, new CopyOnWriteArrayList<>());
            if (listeners.isEmpty()) {
                synchronized (replayState) {
                    replayState.replaying = false;
                }
                return;
            }
            dispatchToSessionListeners(listeners, message);
        }
        flushPendingReplayEvents(welinkSessionId, replayState);
    }

    private void flushPendingReplayEvents(@NonNull String welinkSessionId, @NonNull ReplayState replayState) {
        while (true) {
            List<StreamMessage> pendingMessages;
            synchronized (replayState) {
                if (replayState.pendingLiveEvents.isEmpty()) {
                    // 只有在确认待补发的实时消息队列已经为空时，才允许退出补发状态。
                    // 这样可以避免“刚判断为空，立刻又进来一条实时消息”却没人再触发发送的竞态问题。
                    replayState.replaying = false;
                    return;
                }
                pendingMessages = new ArrayList<>(replayState.pendingLiveEvents);
                replayState.pendingLiveEvents.clear();
            }
            List<SessionListener> listeners = sessionListeners.getOrDefault(welinkSessionId, new CopyOnWriteArrayList<>());
            if (listeners.isEmpty()) {
                synchronized (replayState) {
                    replayState.replaying = false;
                }
                return;
            }
            for (StreamMessage pendingMessage : pendingMessages) {
                dispatchToSessionListeners(listeners, pendingMessage);
            }
        }
    }

    private boolean enqueueLiveEventDuringReplay(@NonNull String welinkSessionId, @NonNull StreamMessage message) {
        ReplayState replayState = replayStates.get(welinkSessionId);
        if (replayState == null) {
            return false;
        }
        synchronized (replayState) {
            if (!replayState.replaying) {
                return false;
            }
            // 页面层希望拿到的是一个严格有序的事件流。
            // 因此补发期间新到的实时消息不能直接透传，而是先排队，等待补发结束后立刻继续下发。
            replayState.pendingLiveEvents.add(message);
            return true;
        }
    }

    private void dispatchToSessionListeners(@NonNull List<SessionListener> listeners, @NonNull StreamMessage message) {
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

    private void appendToRoundBuffer(@NonNull String welinkSessionId, @NonNull StreamMessage message) {
        SessionRoundBuffer currentBuffer = roundBuffers.get(welinkSessionId);
        if (currentBuffer == null || currentBuffer.completed) {
            SessionRoundBuffer nextBuffer = new SessionRoundBuffer(welinkSessionId);
            roundBuffers.put(welinkSessionId, nextBuffer);
            currentBuffer = nextBuffer;
        }
        synchronized (currentBuffer) {
            // 这里缓存的是服务端原始 onmessage 事件，且必须保持到达顺序不变。
            // 后续若页面较晚注册监听器，就可以先补发这一轮“尚未结束”的完整事件序列，
            // 让页面看到的内容与一开始就在线监听时完全一致。
            currentBuffer.events.add(message);
            currentBuffer.updatedAt = System.currentTimeMillis();
        }
    }

    private void markRoundCompleted(@NonNull String welinkSessionId) {
        SessionRoundBuffer buffer = roundBuffers.get(welinkSessionId);
        if (buffer == null) {
            return;
        }
        synchronized (buffer) {
            // 一旦识别到当前轮次已经结束，只保留该状态用于下一轮开始时替换旧缓存，
            // 后续 registerSessionListener 不再补发这一轮缓存，页面应改走历史消息接口。
            buffer.completed = true;
            buffer.updatedAt = System.currentTimeMillis();
        }
    }

    private boolean shouldCompleteCurrentRound(@NonNull StreamMessage message) {
        String type = message.getType();
        if ("session.status".equals(type)) {
            return "idle".equalsIgnoreCase(message.getSessionStatus());
        }
        return "session.error".equals(type)
                || "error".equals(type)
                || "agent.offline".equals(type);
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
        message.setSourceMessageId(getString(json, "sourceMessageId"));
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
        message.setSubagentSessionId(getString(json, "subagentSessionId"));
        message.setSubagentName(getString(json, "subagentName"));
        message.setMessages(getArray(json, "messages"));
        message.setParts(getArray(json, "parts"));
        return message;
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
                // 重连成功后恢复连接状态，并继续复用现有监听与缓存能力。
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // 连接失败后继续按既定策略重试，直到显式断开或达到上层停止条件。
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
        if (wsUrl != null && !wsUrl.isEmpty()) {
            return wsUrl;
        }
        if (baseUrl == null) {
            throw new IllegalStateException("baseUrl not configured");
        }
        String wsBase = baseUrl.replaceFirst("^http://", "ws://").replaceFirst("^https://", "wss://");
        return wsBase + "/ws/skill/stream";
    }

    @NonNull
    private static Map<String, String> mergeWebSocketHeaders(@NonNull SkillSDKConfig config) {
        Map<String, String> merged = new HashMap<>();
        merged.putAll(config.getDefaultHeaders());
        merged.putAll(config.getWebSocketHeaders());
        return merged;
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

    /**
     * 单个 welinkSessionId 当前轮次的原始事件缓存。
     * 仅缓存“当前未结束轮次”的服务端报文，不在 SDK 内做聚合，页面层继续沿用现有渲染逻辑。
     */
    private static final class SessionRoundBuffer {
        @NonNull
        private final String welinkSessionId;
        @NonNull
        private final List<StreamMessage> events = new ArrayList<>();
        private final long createdAt = System.currentTimeMillis();
        private long updatedAt = createdAt;
        private boolean completed;

        private SessionRoundBuffer(@NonNull String welinkSessionId) {
            this.welinkSessionId = welinkSessionId;
        }
    }

    /**
     * 监听器补发期间的过渡状态。
     * replaying 表示正在补发缓存；pendingLiveEvents 保存补发窗口内新到的实时事件。
     */
    private static final class ReplayState {
        private boolean replaying;
        @NonNull
        private final List<StreamMessage> pendingLiveEvents = new ArrayList<>();
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
