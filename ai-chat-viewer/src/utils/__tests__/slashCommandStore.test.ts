import {
  clearSlashCommandMemoryStore,
  getSlashCommandStorageKey,
  readSlashCommandStore,
  writeSlashCommandStore,
} from '../slashCommandStore';
import type { SlashCommandItem } from '../../types/slashCommand';

const commands: SlashCommandItem[] = [{ command: '/new', description: '新建会话' }];

describe('slashCommandStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-11T00:00:00Z'));
    delete (window as any).HWH5;
    clearSlashCommandMemoryStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses partnerAccount as the storage key', () => {
    expect(getSlashCommandStorageKey('partner-1')).toBe('slash_commands:partner-1');
  });

  it('reads valid mobile storage data through HWH5.getStorage', async () => {
    const getStorage = jest.fn().mockResolvedValue({
      data: JSON.stringify({
        partnerAccount: 'partner-1',
        expiresAt: Date.now() + 1_000,
        commands,
      }),
    });
    (window as any).HWH5 = {
      getStorage,
    };

    await expect(readSlashCommandStore({
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
    })).resolves.toEqual(commands);
    expect(getStorage).toHaveBeenCalledWith('slash_commands:partner-1');
  });

  it('treats expired storage as unavailable unless fallback ignores expiry', async () => {
    (window as any).HWH5 = {
      getStorage: jest.fn().mockResolvedValue({
        data: {
          partnerAccount: 'partner-1',
          expiresAt: Date.now() - 1_000,
          commands,
        },
      }),
    };

    await expect(readSlashCommandStore({
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
    })).resolves.toBeNull();

    await expect(readSlashCommandStore({
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
      ignoreExpiry: true,
    })).resolves.toEqual(commands);
  });

  it('writes mobile storage data through HWH5.setStorage', async () => {
    const setStorage = jest.fn().mockResolvedValue(undefined);
    (window as any).HWH5 = { setStorage };

    await writeSlashCommandStore({
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
      commands,
    });

    expect(setStorage).toHaveBeenCalledWith(expect.objectContaining({
      key: 'slash_commands:partner-1',
    }));
  });
});
