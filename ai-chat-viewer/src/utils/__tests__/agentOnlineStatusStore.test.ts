import {
  clearAgentOnlineStatusMemoryStore,
  readAgentOnlineStatusStore,
  writeAgentOnlineStatusStore,
} from '../agentOnlineStatusStore';

describe('agentOnlineStatusStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-11T00:00:00Z'));
    delete (window as any).HWH5;
    clearAgentOnlineStatusMemoryStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads valid mobile storage data through HWH5.getStorage', async () => {
    const getStorage = jest.fn().mockResolvedValue({
      data: JSON.stringify({
        statuses: {
          'partner-1': true,
          'partner-2': false,
        },
      }),
    });
    (window as any).HWH5 = {
      getStorage,
    };

    await expect(readAgentOnlineStatusStore()).resolves.toEqual({
      statuses: {
        'partner-1': true,
        'partner-2': false,
      },
    });
    expect(getStorage).toHaveBeenCalledWith('agent_online_status');
  });

  it('returns null when no storage data', async () => {
    const getStorage = jest.fn().mockResolvedValue(null);
    (window as any).HWH5 = {
      getStorage,
    };

    await expect(readAgentOnlineStatusStore()).resolves.toBeNull();
  });

  it('returns null when storage data is invalid', async () => {
    const getStorage = jest.fn().mockResolvedValue({
      data: JSON.stringify({}),
    });
    (window as any).HWH5 = {
      getStorage,
    };

    await expect(readAgentOnlineStatusStore()).resolves.toBeNull();
  });

  it('writes mobile storage data through HWH5.setStorage', async () => {
    const setStorage = jest.fn().mockResolvedValue(undefined);
    (window as any).HWH5 = { setStorage };

    await writeAgentOnlineStatusStore({
      statuses: { 'partner-1': true },
    });

    expect(setStorage).toHaveBeenCalledWith(expect.objectContaining({
      key: 'agent_online_status',
    }));
  });

  it('reads from memory store first before calling storage', async () => {
    const getStorage = jest.fn().mockResolvedValue({
      data: JSON.stringify({
        statuses: { 'partner-2': true },
      }),
    });
    (window as any).HWH5 = { getStorage };

    // First write to memory
    await writeAgentOnlineStatusStore({
      statuses: { 'partner-1': false },
    });

    // Clear storage reference to force memory read
    (window as any).HWH5 = { getStorage };

    const result = await readAgentOnlineStatusStore();

    // Should return memory store data, not storage data
    expect(result).toEqual({
      statuses: { 'partner-1': false },
    });
    // getStorage should not be called because memory store has data
    expect(getStorage).not.toHaveBeenCalled();
  });

  it('handles pc storage (localStorage)', async () => {
    const localStorageSet = jest.fn();
    const localStorageGet = jest.fn().mockReturnValue(JSON.stringify({
      statuses: { 'partner-pc': true },
    }));
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: localStorageSet,
        getItem: localStorageGet,
      },
      configurable: true,
    });

    // Simulate PC mode by not having HWH5
    delete (window as any).HWH5;

    const result = await readAgentOnlineStatusStore();

    expect(result).toEqual({
      statuses: { 'partner-pc': true },
    });
  });
});
