package com.opencode.skill.websocket;

import android.os.Handler;
import android.os.Looper;

import com.google.gson.Gson;
import com.opencode.skill.listener.SessionError;
import com.opencode.skill.listener.SessionListener;
import com.opencode.skill.model.StreamMessage;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class SkillWebSocketManager {
    private final OkHttpClient okHttpClient;
    private final String wsBaseUrl;
    private final Gson gson;
    private final Handler mainHandler;
    private final Map<String, WebSocketConnection> connections;
    private final Map<String, List<SessionListener>> pendingListeners;

    public SkillWebSocketManager(String wsBaseUrl, OkHttpClient okHttpClient) {
        this.wsBaseUrl = wsBaseUrl;
        this.okHttpClient = okHttpClient;
        this.gson = new Gson();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.connections = new ConcurrentHashMap<>();
        this.pendingListeners = new ConcurrentHashMap<>();
    }

    public void connect(String sessionId, SessionListener listener) {
        List<SessionListener> listeners = pendingListeners.computeIfAbsent(sessionId, k -> new ArrayList<>());
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }

        WebSocketConnection connection = connections.get(sessionId);
        if (connection == null || !connection.isConnected()) {
            String wsUrl = wsBaseUrl + "/ws/skill/stream/" + sessionId;
            Request request = new Request.Builder().url(wsUrl).build();
            WebSocketConnection newConnection = new WebSocketConnection(sessionId);
            WebSocket webSocket = okHttpClient.newWebSocket(request, newConnection);
            newConnection.setWebSocket(webSocket);
            connections.put(sessionId, newConnection);
        } else {
            connection.addListener(listener);
        }
    }

    public void disconnect(String sessionId) {
        WebSocketConnection connection = connections.remove(sessionId);
        if (connection != null) {
            connection.close();
        }
        pendingListeners.remove(sessionId);
    }

    public void disconnect(String sessionId, SessionListener listener) {
        WebSocketConnection connection = connections.get(sessionId);
        if (connection != null) {
            connection.removeListener(listener);
            if (!connection.hasListeners()) {
                connections.remove(sessionId);
                connection.close();
            }
        }
        
        List<SessionListener> listeners = pendingListeners.get(sessionId);
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    public boolean isConnected(String sessionId) {
        WebSocketConnection connection = connections.get(sessionId);
        return connection != null && connection.isConnected();
    }

    private void notifyListeners(String sessionId, StreamMessage message) {
        WebSocketConnection connection = connections.get(sessionId);
        if (connection != null) {
            for (SessionListener listener : connection.getListeners()) {
                mainHandler.post(() -> listener.onMessage(message));
            }
        }
        
        List<SessionListener> pending = pendingListeners.get(sessionId);
        if (pending != null) {
            for (SessionListener listener : pending) {
                mainHandler.post(() -> listener.onMessage(message));
            }
        }
    }

    private void notifyError(String sessionId, SessionError error) {
        WebSocketConnection connection = connections.get(sessionId);
        if (connection != null) {
            for (SessionListener listener : connection.getListeners()) {
                mainHandler.post(() -> listener.onError(error));
            }
        }
    }

    private void notifyClose(String sessionId, String reason) {
        WebSocketConnection connection = connections.get(sessionId);
        if (connection != null) {
            for (SessionListener listener : connection.getListeners()) {
                mainHandler.post(() -> listener.onClose(reason));
            }
        }
    }

    private class WebSocketConnection extends WebSocketListener {
        private final String sessionId;
        private WebSocket webSocket;
        private final List<SessionListener> listeners = new ArrayList<>();
        private volatile boolean connected = false;

        public WebSocketConnection(String sessionId) {
            this.sessionId = sessionId;
        }

        public void setWebSocket(WebSocket webSocket) {
            this.webSocket = webSocket;
        }

        public void addListener(SessionListener listener) {
            if (!listeners.contains(listener)) {
                listeners.add(listener);
            }
        }

        public void removeListener(SessionListener listener) {
            listeners.remove(listener);
        }

        public List<SessionListener> getListeners() {
            return new ArrayList<>(listeners);
        }

        public boolean hasListeners() {
            return !listeners.isEmpty();
        }

        public boolean isConnected() {
            return connected;
        }

        public void close() {
            connected = false;
            if (webSocket != null) {
                webSocket.close(1000, "Client closed");
            }
        }

        @Override
        public void onOpen(WebSocket webSocket, Response response) {
            connected = true;
            List<SessionListener> pending = pendingListeners.get(sessionId);
            if (pending != null) {
                listeners.addAll(pending);
            }
        }

        @Override
        public void onMessage(WebSocket webSocket, String text) {
            try {
                StreamMessage message = gson.fromJson(text, StreamMessage.class);
                notifyListeners(sessionId, message);
            } catch (Exception e) {
                SessionError error = new SessionError("PARSE_ERROR", e.getMessage());
                notifyError(sessionId, error);
            }
        }

        @Override
        public void onFailure(WebSocket webSocket, Throwable t, Response response) {
            connected = false;
            SessionError error = new SessionError("CONNECTION_ERROR", t.getMessage());
            notifyError(sessionId, error);
        }

        @Override
        public void onClosing(WebSocket webSocket, int code, String reason) {
            webSocket.close(code, reason);
        }

        @Override
        public void onClosed(WebSocket webSocket, int code, String reason) {
            connected = false;
            notifyClose(sessionId, reason);
        }
    }
}