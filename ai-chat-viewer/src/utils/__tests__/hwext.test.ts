import { buildOpenWeAgentCUIParams, sendWebSocketMessage, deleteHistorySession, getOnlineStatus } from '../hwext';

describe('deleteHistorySession', () => {
  beforeEach(() => {
    (window as any).HWH5 = {
      fetchFull: jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          code: 0,
          data: {
            status: 'deleted',
            welinkSessionId: 'session/1',
          },
        }),
      }),
    };
  });

  it('deletes a session through HWH5.fetchFull without a request body', async () => {
    await expect(deleteHistorySession({ welinkSessionId: 'session/1' })).resolves.toEqual({
      status: 'deleted',
      welinkSessionId: 'session/1',
    });

    expect(window.HWH5.fetchFull).toHaveBeenCalledWith(
      'https://www.example.com/mag/api/skill/sessions/session%2F1',
      {
        method: 'delete',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('throws a clear error when welinkSessionId is undefined', async () => {
    await expect(deleteHistorySession({ welinkSessionId: undefined } as any)).rejects.toThrow(
      'welinkSessionId is required.',
    );
    expect(window.HWH5.fetchFull).not.toHaveBeenCalled();
  });

  it('throws a clear error when welinkSessionId is null', async () => {
    await expect(deleteHistorySession({ welinkSessionId: null } as any)).rejects.toThrow(
      'welinkSessionId is required.',
    );
    expect(window.HWH5.fetchFull).not.toHaveBeenCalled();
  });
});

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

describe('getOnlineStatus', () => {
  beforeEach(() => {
    (window as any).HWH5 = {
      fetchFull: jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          code: 0,
          data: {
            agent: [
              { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
              { assistantAccount: 'partner-2', ak: 'ak2', online: false, toolType: 'type2', assistantType: 'personal' },
            ],
          },
        }),
      }),
    };
  });

  it('gets online status through HWH5.fetchFull', async () => {
    const assistantAccountList = ['partner-1', 'partner-2'];
    await expect(getOnlineStatus(assistantAccountList)).resolves.toEqual({
      agent: [
        { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
        { assistantAccount: 'partner-2', ak: 'ak2', online: false, toolType: 'type2', assistantType: 'personal' },
      ],
    });

    expect(window.HWH5.fetchFull).toHaveBeenCalledWith(
      'https://www.example.com/mag/api/skill/agent/status',
      {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistantAccountList }),
      },
    );
  });

  it('throws error when HWH5.fetchFull is not available', async () => {
    delete (window as any).HWH5;

    await expect(getOnlineStatus(['partner-1'])).rejects.toThrow(
      'HWH5.fetchFull is not available.',
    );
  });

  it('throws error when response code is not 0', async () => {
    (window as any).HWH5 = {
      fetchFull: jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          code: 1,
          message: 'error',
        }),
      }),
    };

    await expect(getOnlineStatus(['partner-1'])).rejects.toEqual({
      code: 1,
      message: 'error',
    });
  });

  it('sends empty array when assistantAccountList is empty', async () => {
    await expect(getOnlineStatus([])).resolves.toEqual({
      agent: [
        { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
        { assistantAccount: 'partner-2', ak: 'ak2', online: false, toolType: 'type2', assistantType: 'personal' },
      ],
    });

    expect(window.HWH5.fetchFull).toHaveBeenCalledWith(
      'https://www.example.com/mag/api/skill/agent/status',
      {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistantAccountList: [] }),
      },
    );
  });

  it('throws error when response data is null', async () => {
    (window as any).HWH5 = {
      fetchFull: jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          code: 0,
          data: null,
        }),
      }),
    };

    await expect(getOnlineStatus(['partner-1'])).rejects.toEqual({
      code: 0,
      data: null,
    });
  });
});
