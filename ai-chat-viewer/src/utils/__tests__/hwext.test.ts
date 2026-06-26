import { buildOpenWeAgentCUIParams, sendWebSocketMessage } from '../hwext';

describe('buildOpenWeAgentCUIParams', () => {
  beforeEach(() => {
    delete (window as any).HWH5EXT;
  });

  it('uses from=weAgent instead of robotId for myAgent external uri', () => {
    const result = buildOpenWeAgentCUIParams('h5://external-app/index.html#weAgentCUI', 'x00_1', {
      robotId: 'robot_1',
      bizRobotTag: 'myAgent',
    });

    expect(result.weAgentUri).toContain('wecodePlace=weAgent');
    expect(result.weAgentUri).toContain('from=weAgent');
    expect(result.weAgentUri).not.toContain('robotId=');
  });

  it('keeps robotId for non-myAgent external uri', () => {
    const result = buildOpenWeAgentCUIParams('h5://external-app/index.html#weAgentCUI', 'x00_1', {
      robotId: 'robot_1',
      bizRobotTag: 'generalAgent',
    });

    expect(result.weAgentUri).toContain('wecodePlace=weAgent');
    expect(result.weAgentUri).toContain('robotId=robot_1');
    expect(result.weAgentUri).not.toContain('from=weAgent');
  });
});

describe('sendWebSocketMessage', () => {
  it('passes websocket message params to HWH5EXT', async () => {
    const bridgeResult = { status: 'success' as const };
    const bridgeSendWebSocketMessage = jest.fn().mockResolvedValue(bridgeResult);
    (window as any).HWH5EXT = {
      sendWebSocketMessage: bridgeSendWebSocketMessage,
    };

    await expect(sendWebSocketMessage({
      message: JSON.stringify({
        action: 'query_slash_commands',
        welinkSessionId: '42',
      }),
    })).resolves.toEqual(bridgeResult);

    expect(bridgeSendWebSocketMessage).toHaveBeenCalledWith({
      message: JSON.stringify({
        action: 'query_slash_commands',
        welinkSessionId: '42',
      }),
    });
  });
});
