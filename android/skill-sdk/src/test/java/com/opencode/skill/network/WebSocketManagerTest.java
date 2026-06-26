package com.opencode.skill.network;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class WebSocketManagerTest {
    @Test
    public void buildMessagePayloadSendsGenericWebSocketMessageStringUnchanged() {
        String message = "{\"action\":\"custom_action\",\"welinkSessionId\":\"session-123\"}";
        String payload = WebSocketManager.buildMessagePayload(message);

        assertEquals(
                "{\"action\":\"custom_action\",\"welinkSessionId\":\"session-123\"}",
                payload
        );
    }
}
