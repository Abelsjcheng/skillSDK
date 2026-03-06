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

/**
 * WebSocket连接管理器，负责管理与Skill服务端的WebSocket连接
 * 支持多会话连接、监听器管理、自动重连等功能
 * 
 * @author OpenCode Team
 * @version 1.0.0
 * @since 2026-03-06
 */
public class SkillWebSocketManager {
    // OkHttpClient实例，用于创建WebSocket连接
    private final OkHttpClient okHttpClient;
    // WebSocket基础URL
    private final String wsBaseUrl;
    // Gson实例，用于JSON序列化和反序列化
    private final Gson gson;
    // 主线程Handler，用于将回调切换到主线程
    private final Handler mainHandler;
    // WebSocket连接映射表，key为会话ID
    private final Map<String, WebSocketConnection> connections;
    // 待处理监听器映射表，用于连接建立前的监听器缓存
    private final Map<String, List<SessionListener>> pendingListeners;

    /**
     * 创建WebSocket管理器实例
     * 
     * @param wsBaseUrl WebSocket基础URL
     * @param okHttpClient OkHttpClient实例
     */
    public SkillWebSocketManager(String wsBaseUrl, OkHttpClient okHttpClient) {
        this.wsBaseUrl = wsBaseUrl;
        this.okHttpClient = okHttpClient;
        this.gson = new Gson();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.connections = new ConcurrentHashMap<>();
        this.pendingListeners = new ConcurrentHashMap<>();
    }

    /**
     * 连接到WebSocket服务端
     * 
     * @param sessionId 会话ID
     * @param listener 会话监听器，用于接收消息
     */
    public void connect(String sessionId, SessionListener listener) {
        // 将监听器添加到待处理列表
        List<SessionListener> listeners = pendingListeners.computeIfAbsent(sessionId, k -> new ArrayList<>());
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }

        // 检查是否已存在连接
        WebSocketConnection connection = connections.get(sessionId);
        if (connection == null || !connection.isConnected()) {
            // 创建新的WebSocket连接
            String wsUrl = wsBaseUrl + "/ws/skill/stream/" + sessionId;
            Request request = new Request.Builder().url(wsUrl).build();
            WebSocketConnection newConnection = new WebSocketConnection(sessionId);
            WebSocket webSocket = okHttpClient.newWebSocket(request, newConnection);
            newConnection.setWebSocket(webSocket);
            connections.put(sessionId, newConnection);
        } else {
            // 已存在连接，直接添加监听器
            connection.addListener(listener);
        }
    }

    /**
     * 断开WebSocket连接
     * 
     * @param sessionId 会话ID
     */
    public void disconnect(String sessionId) {
        WebSocketConnection connection = connections.remove(sessionId);
        if (connection != null) {
            connection.close();
        }
        // 移除待处理监听器
        pendingListeners.remove(sessionId);
    }

    /**
     * 断开指定监听器的WebSocket连接
     * 如果该连接没有其他监听器，则完全断开连接
     * 
     * @param sessionId 会话ID
     * @param listener 要移除的监听器
     */
    public void disconnect(String sessionId, SessionListener listener) {
        WebSocketConnection connection = connections.get(sessionId);
        if (connection != null) {
            connection.removeListener(listener);
            // 如果没有剩余监听器，关闭连接
            if (!connection.hasListeners()) {
                connections.remove(sessionId);
                connection.close();
            }
        }
        
        // 从待处理列表中移除监听器
        List<SessionListener> listeners = pendingListeners.get(sessionId);
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    /**
     * 检查WebSocket连接是否已建立
     * 
     * @param sessionId 会话ID
     * @return true如果连接已建立，false否则
     */
    public boolean isConnected(String sessionId) {
        WebSocketConnection connection = connections.get(sessionId);
        return connection != null && connection.isConnected();
    }

    /**
     * 通知所有监听器有新消息到达
     * 
     * @param sessionId 会话ID
     * @param message 流式消息对象
     */
    private void notifyListeners(String sessionId, StreamMessage message) {
        WebSocketConnection connection = connections.get(sessionId);
        if (connection != null) {
            // 通知已连接的监听器
            for (SessionListener listener : connection.getListeners()) {
                mainHandler.post(() -> listener.onMessage(message));
            }
        }
        
        // 通知待处理监听器
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