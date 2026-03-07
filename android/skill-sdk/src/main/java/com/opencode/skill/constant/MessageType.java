package com.opencode.skill.constant;

import androidx.annotation.NonNull;

/**
 * WebSocket 消息类型常量
 */
public final class MessageType {
    public static final String DELTA = "delta";
    public static final String DONE = "done";
    public static final String ERROR = "error";
    public static final String AGENT_OFFLINE = "agent_offline";
    public static final String AGENT_ONLINE = "agent_online";

    private MessageType() {
    }

    public static boolean isValid(@NonNull String type) {
        return DELTA.equals(type) ||
                DONE.equals(type) ||
                ERROR.equals(type) ||
                AGENT_OFFLINE.equals(type) ||
                AGENT_ONLINE.equals(type);
    }
}