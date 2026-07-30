import { canIUse } from '../versionCheck';
import { getAppInfo } from '../hwext';

jest.mock('../../constants', () => ({
  isAndroidMobileDevice: jest.fn(() => false),
  isHarmonyMobileDevice: jest.fn(() => true),
  isIosMobileDevice: jest.fn(() => false),
  isPcMiniApp: jest.fn(() => false),
}));

jest.mock('../hwext', () => ({
  getAppInfo: jest.fn(),
}));

const mockGetAppInfo = getAppInfo as jest.MockedFunction<typeof getAppInfo>;

describe('canIUse', () => {
  beforeEach(() => {
    mockGetAppInfo.mockReset();
  });

  it('enables harmony split layout only from Harmony 1.30.0', async () => {
    mockGetAppInfo.mockResolvedValueOnce({ language: 'zh', versionName: '1.29.9' });
    await expect(canIUse.harmonySplitLayout()).resolves.toBe(false);

    mockGetAppInfo.mockResolvedValueOnce({ language: 'zh', versionName: '1.30.0' });
    await expect(canIUse.harmonySplitLayout()).resolves.toBe(true);
  });

  it('enables WeAgent unread APIs only from Harmony 1.32.0', async () => {
    mockGetAppInfo.mockResolvedValueOnce({ language: 'zh', versionName: '1.31.9' });
    await expect(canIUse.weAgentUnread()).resolves.toBe(false);

    mockGetAppInfo.mockResolvedValueOnce({ language: 'zh', versionName: '1.32.0' });
    await expect(canIUse.weAgentUnread()).resolves.toBe(true);
  });
});
