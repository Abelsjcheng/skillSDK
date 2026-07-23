import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAgentOnlineStatus } from '../useAgentOnlineStatus';
import type { WeAgentListItem } from '../../types/bridge/hwext';

const mockAssistantList: WeAgentListItem[] = [
  {
    name: 'Assistant 1',
    icon: 'icon1.png',
    description: 'Description 1',
    partnerAccount: 'partner-1',
    bizRobotName: 'Robot 1',
    bizRobotNameEn: 'Robot 1 EN',
    bizRobotTag: 'tag1',
    robotId: 'robot-1',
  },
  {
    name: 'Assistant 2',
    icon: 'icon2.png',
    description: 'Description 2',
    partnerAccount: 'partner-2',
    bizRobotName: 'Robot 2',
    bizRobotNameEn: 'Robot 2 EN',
    bizRobotTag: 'tag2',
    robotId: 'robot-2',
  },
];

jest.mock('../../utils/hwext', () => ({
  getOnlineStatus: jest.fn(),
  getWeAgentList: jest.fn(),
  registerSessionListener: jest.fn(),
  unregisterSessionListener: jest.fn(),
  isPcMiniApp: jest.fn(() => false),
}));

jest.mock('../../utils/agentOnlineStatusStore', () => ({
  readAgentOnlineStatusStore: jest.fn(),
  writeAgentOnlineStatusStore: jest.fn(),
}));

jest.mock('../../utils/assistantSelection', () => ({
  DEFAULT_ASSISTANT_LIST_QUERY: { pageSize: 20, pageNumber: 1 },
}));

import {
  getOnlineStatus,
  getWeAgentList,
  registerSessionListener,
  unregisterSessionListener,
} from '../../utils/hwext';
import {
  readAgentOnlineStatusStore,
  writeAgentOnlineStatusStore,
} from '../../utils/agentOnlineStatusStore';

const mockGetOnlineStatus = getOnlineStatus as jest.MockedFunction<typeof getOnlineStatus>;
const mockGetWeAgentList = getWeAgentList as jest.MockedFunction<typeof getWeAgentList>;
const mockRegisterSessionListener = registerSessionListener as jest.MockedFunction<typeof registerSessionListener>;
const mockUnregisterSessionListener = unregisterSessionListener as jest.MockedFunction<typeof unregisterSessionListener>;
const mockReadAgentOnlineStatusStore = readAgentOnlineStatusStore as jest.MockedFunction<typeof readAgentOnlineStatusStore>;
const mockWriteAgentOnlineStatusStore = writeAgentOnlineStatusStore as jest.MockedFunction<typeof writeAgentOnlineStatusStore>;

type ListenerParams = {
  welinkSessionId: string;
  onMessage: (msg: { type: string; partnerAccount?: string }) => void;
  onClose?: () => void;
};

let capturedListener: ListenerParams | null = null;

describe('useAgentOnlineStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedListener = null;

    mockReadAgentOnlineStatusStore.mockResolvedValue(null);
    mockWriteAgentOnlineStatusStore.mockResolvedValue(undefined);
    mockRegisterSessionListener.mockImplementation((params: ListenerParams) => {
      capturedListener = params;
    });
    mockUnregisterSessionListener.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('reads from storage on init', async () => {
      const storedData = { statuses: { 'partner-1': true, 'partner-2': false } };
      mockReadAgentOnlineStatusStore.mockResolvedValueOnce(storedData);

      const { result } = renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(mockReadAgentOnlineStatusStore).toHaveBeenCalled();
      });

      expect(result.current.agentStatusMap).toEqual({ 'partner-1': true, 'partner-2': false });
    });

    it('does NOT fetch online status when fetchOnInit is false (default)', async () => {
      mockReadAgentOnlineStatusStore.mockResolvedValue(null);

      renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(mockGetOnlineStatus).not.toHaveBeenCalled();
        expect(mockGetWeAgentList).not.toHaveBeenCalled();
      });
    });

    it('fetches online status when fetchOnInit is true', async () => {
      mockReadAgentOnlineStatusStore.mockResolvedValue(null);
      mockGetWeAgentList.mockResolvedValueOnce({ content: mockAssistantList });
      mockGetOnlineStatus.mockResolvedValueOnce({
        agent: [
          { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
          { assistantAccount: 'partner-2', ak: 'ak2', online: false, toolType: 'type2', assistantType: 'personal' },
        ],
      });

      const { result } = renderHook(() => useAgentOnlineStatus({ fetchOnInit: true }));

      await waitFor(() => {
        expect(result.current.agentStatusMap).toEqual({ 'partner-1': true, 'partner-2': false });
      });

      expect(mockGetWeAgentList).toHaveBeenCalledWith({ pageSize: 20, pageNumber: 1 });
      expect(mockGetOnlineStatus).toHaveBeenCalledWith(['partner-1', 'partner-2']);
    });
  });

  describe('fetchAllAgentStatus', () => {
    it('uses provided assistantList instead of fetching', async () => {
      mockGetOnlineStatus.mockResolvedValueOnce({
        agent: [
          { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
        ],
      });

      const { result } = renderHook(() => useAgentOnlineStatus());

      await act(async () => {
        await result.current.fetchAllAgentStatus(mockAssistantList);
      });

      expect(mockGetWeAgentList).not.toHaveBeenCalled();
      expect(mockGetOnlineStatus).toHaveBeenCalledWith(['partner-1', 'partner-2']);
      expect(result.current.agentStatusMap).toEqual({ 'partner-1': true });
    });

    it('fetches assistant list when not provided', async () => {
      mockGetWeAgentList.mockResolvedValueOnce({ content: mockAssistantList });
      mockGetOnlineStatus.mockResolvedValueOnce({
        agent: [
          { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
          { assistantAccount: 'partner-2', ak: 'ak2', online: false, toolType: 'type2', assistantType: 'personal' },
        ],
      });

      const { result } = renderHook(() => useAgentOnlineStatus());

      await act(async () => {
        await result.current.fetchAllAgentStatus();
      });

      expect(mockGetWeAgentList).toHaveBeenCalledWith({ pageSize: 20, pageNumber: 1 });
      expect(mockGetOnlineStatus).toHaveBeenCalledWith(['partner-1', 'partner-2']);
    });

    it('writes to storage after fetching', async () => {
      mockGetOnlineStatus.mockResolvedValueOnce({
        agent: [
          { assistantAccount: 'partner-1', ak: 'ak1', online: true, toolType: 'type1', assistantType: 'business' },
        ],
      });

      const { result } = renderHook(() => useAgentOnlineStatus());

      await act(async () => {
        await result.current.fetchAllAgentStatus([mockAssistantList[0]]);
      });

      expect(mockWriteAgentOnlineStatusStore).toHaveBeenCalledWith({
        statuses: { 'partner-1': true },
      });
    });

    it('handles API error gracefully', async () => {
      mockGetOnlineStatus.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAgentOnlineStatus());

      await act(async () => {
        await result.current.fetchAllAgentStatus([mockAssistantList[0]]);
      });

      expect(consoleSpy).toHaveBeenCalledWith('fetchAllAgentStatus failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updateAgentStatus', () => {
    it('updates single assistant status', async () => {
      const { result } = renderHook(() => useAgentOnlineStatus());

      await act(async () => {
        await result.current.updateAgentStatus('partner-1', true);
      });

      expect(result.current.agentStatusMap).toEqual({ 'partner-1': true });
      expect(mockWriteAgentOnlineStatusStore).toHaveBeenCalledWith({
        statuses: { 'partner-1': true },
      });
    });

    it('merges with existing status map', async () => {
      mockReadAgentOnlineStatusStore.mockResolvedValueOnce({
        statuses: { 'partner-2': false },
      });

      const { result } = renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(result.current.agentStatusMap).toEqual({ 'partner-2': false });
      });

      await act(async () => {
        await result.current.updateAgentStatus('partner-1', true);
      });

      expect(result.current.agentStatusMap).toEqual({
        'partner-1': true,
        'partner-2': false,
      });
    });
  });

  describe('getAgentStatus', () => {
    it('returns status for given partnerAccount', async () => {
      mockReadAgentOnlineStatusStore.mockResolvedValueOnce({
        statuses: { 'partner-1': true, 'partner-2': false },
      });

      const { result } = renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(result.current.getAgentStatus('partner-1')).toBe(true);
        expect(result.current.getAgentStatus('partner-2')).toBe(false);
        expect(result.current.getAgentStatus('unknown')).toBeUndefined();
      });
    });
  });

  describe('registerSessionListener', () => {
    it('registers session listener on mount', () => {
      renderHook(() => useAgentOnlineStatus());

      expect(mockRegisterSessionListener).toHaveBeenCalledWith(
        expect.objectContaining({
          welinkSessionId: 'config_agent',
          onMessage: expect.any(Function),
          onClose: expect.any(Function),
        })
      );
    });

    it('unregisters session listener on unmount', () => {
      const { unmount } = renderHook(() => useAgentOnlineStatus());

      unmount();

      expect(mockUnregisterSessionListener).toHaveBeenCalledWith({
        welinkSessionId: 'config_agent',
      });
    });

    it('updates status on agent.online message', async () => {
      renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(capturedListener).not.toBeNull();
      });

      const storedData = { statuses: {} };
      mockReadAgentOnlineStatusStore.mockResolvedValueOnce(storedData);
      mockWriteAgentOnlineStatusStore.mockResolvedValue(undefined);

      await act(async () => {
        capturedListener!.onMessage({ type: 'agent.online', partnerAccount: 'partner-1' });
      });

      await waitFor(() => {
        expect(mockWriteAgentOnlineStatusStore).toHaveBeenCalled();
      });
    });

    it('updates status on agent.offline message', async () => {
      mockReadAgentOnlineStatusStore.mockResolvedValueOnce({
        statuses: { 'partner-1': true },
      });

      renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(capturedListener).not.toBeNull();
      });

      await act(async () => {
        capturedListener!.onMessage({ type: 'agent.offline', partnerAccount: 'partner-1' });
      });

      await waitFor(() => {
        expect(mockWriteAgentOnlineStatusStore).toHaveBeenCalled();
      });
    });

    it('resets isOpen on onClose', async () => {
      const { result } = renderHook(() => useAgentOnlineStatus());

      await waitFor(() => {
        expect(result.current.isOpen).toBe(false);
      });

      // Simulate onClose
      await act(async () => {
        capturedListener?.onClose?.();
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(false);
      });
    });
  });
});
