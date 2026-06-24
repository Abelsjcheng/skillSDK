import { buildOpenWeAgentCUIParams, deleteHistorySession } from '../hwext';

describe('deleteHistorySession', () => {
  beforeEach(() => {
    (window as any).HWH5 = {
      fetch: jest.fn().mockResolvedValue({
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

  it('deletes a session through HWH5.fetch without a request body', async () => {
    await expect(deleteHistorySession({ welinkSessionId: 'session/1' })).resolves.toEqual({
      status: 'deleted',
      welinkSessionId: 'session/1',
    });

    expect(window.HWH5.fetch).toHaveBeenCalledWith(
      'https://www.example.com/mag/api/skill/sessions/session%2F1',
      {
        method: 'delete',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });
});

describe('buildOpenWeAgentCUIParams', () => {
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
