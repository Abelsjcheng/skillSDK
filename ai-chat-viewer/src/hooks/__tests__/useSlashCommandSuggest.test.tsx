import { act, renderHook, waitFor } from '@testing-library/react';
import { clearSlashCommandSuggestStateForTest, useSlashCommandSuggest } from '../useSlashCommandSuggest';
import { clearSlashCommandMemoryStore } from '../../utils/slashCommandStore';
import type { SlashCommandItem } from '../../types/slashCommand';

const networkCommands: SlashCommandItem[] = [
  { command: '/new', description: '新建会话' },
  { command: '/node', description: 'Node 帮助' },
  { command: '/help', description: '帮助' },
];
const staleCommands: SlashCommandItem[] = [{ command: '/help', description: '帮助' }];

describe('useSlashCommandSuggest', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-11T00:00:00Z'));
    delete (window as any).HWH5;
    clearSlashCommandMemoryStore();
    clearSlashCommandSuggestStateForTest();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads all fetched commands and filters by command prefix', async () => {
    (window as any).HWH5 = {
      getStorage: jest.fn().mockResolvedValue(null),
      setStorage: jest.fn().mockResolvedValue(undefined),
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: networkCommands,
      }),
    };

    const { result } = renderHook(() => useSlashCommandSuggest({
      ak: 'appkey',
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
    }));

    act(() => {
      result.current.handleValueChange('/', 1);
    });

    await waitFor(() => expect(result.current.isOpen).toBe(true));
    expect(result.current.filteredCommands).toEqual(networkCommands);

    act(() => {
      result.current.handleValueChange('/n', 2);
    });

    expect(result.current.filteredCommands).toEqual([
      { command: '/new', description: '新建会话' },
      { command: '/node', description: 'Node 帮助' },
    ]);

    act(() => {
      result.current.handleValueChange('/h', 2);
    });

    expect(result.current.filteredCommands).toEqual([
      { command: '/help', description: '帮助' },
    ]);
  });

  it('falls back to stale storage only once after network failure', async () => {
    const getStorage = jest.fn().mockResolvedValue({
      data: {
        partnerAccount: 'partner-1',
        expiresAt: Date.now() - 1_000,
        commands: staleCommands,
      },
    });
    const fetch = jest.fn().mockRejectedValue(new Error('network failed'));
    (window as any).HWH5 = { getStorage, fetch };

    const { result } = renderHook(() => useSlashCommandSuggest({
      ak: 'appkey',
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
    }));

    act(() => {
      result.current.handleValueChange('/h', 2);
    });

    await waitFor(() => expect(result.current.filteredCommands).toEqual(staleCommands));
    expect(result.current.isOpen).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getStorage).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleValueChange('/he', 3);
    });

    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getStorage).toHaveBeenCalledTimes(1);
  });

  it('keeps all filtered commands available and cycles keyboard highlight', async () => {
    const manyCommands = Array.from({ length: 12 }, (_, index) => ({
      command: `/cmd${index}`,
      description: `命令 ${index}`,
    }));
    (window as any).HWH5 = {
      getStorage: jest.fn().mockResolvedValue(null),
      setStorage: jest.fn().mockResolvedValue(undefined),
      fetch: jest.fn().mockResolvedValue({
        code: 200,
        errormsg: '',
        data: manyCommands,
      }),
    };

    const { result } = renderHook(() => useSlashCommandSuggest({
      ak: 'appkey',
      partnerAccount: 'partner-1',
      isPcMiniApp: false,
    }));

    act(() => {
      result.current.handleValueChange('/cmd', 4);
    });

    await waitFor(() => expect(result.current.filteredCommands).toHaveLength(12));
    expect(result.current.highlightedIndex).toBe(0);

    act(() => {
      result.current.moveHighlight(-1);
    });
    expect(result.current.highlightedIndex).toBe(11);

    act(() => {
      result.current.moveHighlight(1);
    });
    expect(result.current.highlightedIndex).toBe(0);
  });
});
