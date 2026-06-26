package com.opencode.skill.network;

import static org.junit.Assert.assertEquals;

import com.opencode.skill.model.SlashCommand;
import com.opencode.skill.model.StreamMessage;

import org.junit.Test;

import java.lang.reflect.Method;
import java.util.List;

public class WebSocketManagerTest {
    @Test
    public void buildMessagePayloadSendsGenericWebSocketMessageStringUnchanged() {
        String message = "{\"action\":\"query_slash_commands\",\"welinkSessionId\":\"session-123\"}";
        String payload = WebSocketManager.buildMessagePayload(message);

        assertEquals(
                "{\"action\":\"query_slash_commands\",\"welinkSessionId\":\"session-123\"}",
                payload
        );
    }

    @Test
    public void parseMessageReadsSlashCommandsResult() throws Exception {
        String payload = "{"
                + "\"type\":\"slash_commands_result\","
                + "\"seq\":135,"
                + "\"welinkSessionId\":\"session-123\","
                + "\"slashCommands\":["
                + "{\"command\":\"/new\",\"description\":\"New session\"},"
                + "{\"command\":\"/delete\",\"description\":\"Delete\"}"
                + "]"
                + "}";

        WebSocketManager manager = WebSocketManager.getInstance();
        Method parseMessage = WebSocketManager.class.getDeclaredMethod("parseMessage", String.class);
        parseMessage.setAccessible(true);
        StreamMessage message = (StreamMessage) parseMessage.invoke(manager, payload);

        assertEquals("slash_commands_result", message.getType());
        assertEquals("session-123", message.getWelinkSessionId());
        List<SlashCommand> commands = message.getSlashCommands();
        assertEquals(2, commands.size());
        assertEquals("/new", commands.get(0).getCommand());
        assertEquals("New session", commands.get(0).getDescription());
        assertEquals("/delete", commands.get(1).getCommand());
        assertEquals("Delete", commands.get(1).getDescription());
    }
}
