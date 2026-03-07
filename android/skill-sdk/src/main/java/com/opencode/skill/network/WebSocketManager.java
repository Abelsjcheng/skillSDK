package com.opencode.skill.network;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.opencode.skill.callback.SessionListener;
import com.opencode.skill.model.SessionError;
import com.opencode.skill.model.StreamMessage;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/**
 * WebSocket 管理器 - 单例模式
 * 负责与服务端建立 WebSocket 连接，接收并分发流式消息
 */
public class WebSocketManager {

    private static volatile WebSocketManager instance;

    @NonNull
    private final OkHttpClient okHttpClient;
    @NonNull
    private final Gson gson;
    @Nullable
    private volatile WebSocket webSocket;
    @NonNull
    private final Map<String, List<SessionListener>> sessionListeners = new ConcurrentHashMap<>();
    @NonNull
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private volatile boolean isConnected = false;
    @Nullable
    private String baseUrl;

    private WebSocketManager() {
        this.okHttpClient = new OkHttpClient.Builder()
                .pingInterval(30, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
        this.gson = new Gson();
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

    public void setBaseUrl(@NonNull String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public synchronized void connect() {
        if (isConnected && webSocket != null) {
            return;
        }

        if (baseUrl == null || baseUrl.isEmpty()) {
            notifyErrorToAll(new SessionError("CONFIG_ERROR", "Base URL is not configured"));
            return;
        }

        String wsUrl = buildWebSocketUrl(baseUrl);
        Request request = new Request.Builder()
                .url(wsUrl)
                .build();

        webSocket = okHttpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket webSocket, @NonNull Response response) {
                isConnected = true;
            }

            @Override
            public void onMessage(@NonNull WebSocket webSocket, @NonNull String text) {
                handleMessage(text);
            }

            @Override
            public void onClosing(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
                webSocket.close(1000, null);
            }

            @Override
            public void onClosed(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
                isConnected = false;
                notifyCloseToAll(reason);
            }

            @Override
            public void onFailure(@NonNull WebSocket webSocket, @NonNull Throwable t, @Nullable Response response) {
                isConnected = false;
                notifyErrorToAll(new SessionError("WEBSOCKET_ERROR", t.getMessage() != null ? t.getMessage() : "WebSocket connection failed"));
            }
        });
    }

    public synchronized void disconnect() {
        if (webSocket != null) {
            webSocket.close(1000, "Client closing");
            webSocket = null;
        }
        isConnected = false;
    }

    public boolean isConnected() {
        return isConnected;
    }

    public void registerListener(@NonNull String sessionId, @NonNull SessionListener listener) {
        List<SessionListener> listeners = sessionListeners.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>());
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
        
        if (!isConnected) {
            connect();
        }
    }

    public void unregisterListener(@NonNull String sessionId, @NonNull SessionListener listener) {
        List<SessionListener> listeners = sessionListeners.get(sessionId);
        if (listeners != null) {
            listeners.remove(listener);
            if (listeners.isEmpty()) {
                sessionListeners.remove(sessionId);
            }
        }
    }

    public void clearListeners(@NonNull String sessionId) {
        sessionListeners.remove(sessionId);
    }

    private void handleMessage(@NonNull String text) {
        executor.execute(() -> {
            try {
                StreamMessage message = parseStreamMessage(text);
                if (message != null) {
                    dispatchMessage(message);
                }
            } catch (Exception e) {
                notifyErrorToAll(new SessionError("PARSE_ERROR", "Failed to parse message: " + e.getMessage()));
            }
        });
    }

    @Nullable
    private StreamMessage parseStreamMessage(@NonNull String text) {
        JsonObject json = JsonParser.parseString(text).getAsJsonObject();
        StreamMessage message = new StreamMessage();
        
        if (json.has("sessionId")) {
            message.setSessionId(json.get("sessionId").getAsString());
        }
        if (json.has("type")) {
            message.setType(json.get("type").getAsString());
        }
        if (json.has("seq")) {
            message.setSeq(json.get("seq").getAsLong());
        }
        if (json.has("content")) {
            message.setContent(json.get("content"));
        }
        
        return message;
    }

    private void dispatchMessage(@NonNull StreamMessage message) {
        String sessionId = message.getSessionId();
        List<SessionListener> listeners = sessionListeners.get(sessionId);
        
        if (listeners != null) {
            for (SessionListener listener : new ArrayList<>(listeners)) {
                try {
                    listener.onMessage(message);
                } catch (Exception e) {
                    listener.onError(new SessionError("CALLBACK_ERROR", e.getMessage()));
                }
            }
        }
    }

    private void notifyErrorToAll(@NonNull SessionError error) {
        for (List<SessionListener> listeners : sessionListeners.values()) {
            for (SessionListener listener : new ArrayList<>(listeners)) {
                try {
                    listener.onError(error);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private void notifyCloseToAll(@Nullable String reason) {
        for (List<SessionListener> listeners : sessionListeners.values()) {
            for (SessionListener listener : new ArrayList<>(listeners)) {
                try {
                    listener.onClose(reason);
                } catch (Exception ignored) {
                }
            }
        }
    }

    @NonNull
    private String buildWebSocketUrl(@NonNull String baseUrl) {
        String wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://");
        if (!wsUrl.endsWith("/")) {
            wsUrl += "/";
        }
        wsUrl += "ws/skill/stream";
        return wsUrl;
    }

    public void shutdown() {
        disconnect();
        sessionListeners.clear();
        executor.shutdown();
    }
}