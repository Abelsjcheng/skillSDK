package com.opencode.skill.constant;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * WebSocket event types from service protocol.
 */
public final class MessageType {
    public static final String TEXT_DELTA = "text.delta";
    public static final String TEXT_DONE = "text.done";
    public static final String THINKING_DELTA = "thinking.delta";
    public static final String THINKING_DONE = "thinking.done";
    public static final String TOOL_UPDATE = "tool.update";
    public static final String QUESTION = "question";
    public static final String FILE = "file";
    public static final String STEP_START = "step.start";
    public static final String STEP_DONE = "step.done";
    public static final String SESSION_STATUS = "session.status";
    public static final String SESSION_TITLE = "session.title";
    public static final String SESSION_ERROR = "session.error";
    public static final String PERMISSION_ASK = "permission.ask";
    public static final String PERMISSION_REPLY = "permission.reply";
    public static final String AGENT_ONLINE = "agent.online";
    public static final String AGENT_OFFLINE = "agent.offline";
    public static final String ERROR = "error";
    public static final String SNAPSHOT = "snapshot";
    public static final String STREAMING = "streaming";

    private static final Set<String> ALL = new HashSet<>(Arrays.asList(
            TEXT_DELTA,
            TEXT_DONE,
            THINKING_DELTA,
            THINKING_DONE,
            TOOL_UPDATE,
            QUESTION,
            FILE,
            STEP_START,
            STEP_DONE,
            SESSION_STATUS,
            SESSION_TITLE,
            SESSION_ERROR,
            PERMISSION_ASK,
            PERMISSION_REPLY,
            AGENT_ONLINE,
            AGENT_OFFLINE,
            ERROR,
            SNAPSHOT,
            STREAMING
    ));

    private MessageType() {
    }

    public static boolean isKnownType(String type) {
        return type != null && ALL.contains(type);
    }
}
