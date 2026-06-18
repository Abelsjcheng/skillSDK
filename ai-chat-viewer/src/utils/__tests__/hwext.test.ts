import { buildOpenWeAgentCUIParams, getDeviceInfo } from '../hwext';

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

describe('getDeviceInfo', () => {
  const originalHWH5 = window.HWH5;

  afterEach(() => {
    window.HWH5 = originalHWH5;
  });

  it('normalizes status bar and safe area heights from the host device info', async () => {
    window.HWH5 = {
      ...(originalHWH5 ?? {}),
      getDeviceInfo: jest.fn().mockResolvedValue({
        osType: 'Harmony',
        isFullScreen: 0,
        statusBarHeight: '24',
        safeAreaInsetBottom: '18',
      }),
    } as typeof window.HWH5;

    await expect(getDeviceInfo()).resolves.toEqual(expect.objectContaining({
      osType: 'Harmony',
      isFullScreen: 0,
      statusBarHeight: 24,
      safeAreaInsetBottom: 18,
    }));
  });
});
