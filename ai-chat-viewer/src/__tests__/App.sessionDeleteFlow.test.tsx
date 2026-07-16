import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import App from '../App';
import type { UseChatSessionOptions, UseChatSessionResult } from '../types/hooks/chatSession';
import type { SkillSession, WeAgentDetails } from '../types/bridge';
import type { WeAgentHistorySidebarProps } from '../types/components';
import {
  createNewSession,
  getHistorySessionsList,
  getUserInfo,
  getWeAgentDetails,
} from '../utils/hwext';
import { useChatSession } from '../hooks/useChatSession';

jest.mock('../constants', () => ({
  HOST: () => 'https://example.com',
  isPcMiniApp: jest.fn(() => true),
}));

jest.mock('../hooks/useIosKeyboardLift', () => ({
  useIosKeyboardLift: jest.fn(() => ({ keyboardContainerStyle: undefined })),
}));

jest.mock('../hooks/useChatSession', () => ({
  useChatSession: jest.fn(),
}));

jest.mock('../components/Content', () => ({
  Content: () => null,
}));

jest.mock('../components/assistant/WeAgentCUIFooter', () => () => null);

jest.mock('../components/assistant/WeAgentHistorySidebar', () => (props: WeAgentHistorySidebarProps) => {
  latestHistorySidebarProps = props;
  return null;
});

jest.mock('../utils/hwext', () => ({
  createNewSession: jest.fn(),
  getWeAgentUnreadMessage: jest.fn(),
  getHistorySessionsList: jest.fn(),
  getUserInfo: jest.fn(),
  getWeAgentDetails: jest.fn(),
  onSessionViewing: jest.fn(),
  onSessionViewingEnd: jest.fn(),
  registerEventListener: jest.fn(() => Promise.resolve()),
  registerOnVisibleListener: jest.fn(() => Promise.resolve()),
  reportWeAgentSessionRead: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  WeLog: jest.fn(),
}));

jest.mock('../utils/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../utils/telemetry', () => ({
  installBrowserJsErrorTelemetry: jest.fn(() => undefined),
}));

jest.mock('../utils/uemUtil', () => ({
  reportCreateSessionClick: jest.fn(),
}));

let latestChatSessionOptions: UseChatSessionOptions | null = null;
let latestHistorySidebarProps: WeAgentHistorySidebarProps | null = null;

const mockCreateNewSession = createNewSession as jest.MockedFunction<typeof createNewSession>;
const mockGetHistorySessionsList = getHistorySessionsList as jest.MockedFunction<typeof getHistorySessionsList>;
const mockGetUserInfo = getUserInfo as jest.MockedFunction<typeof getUserInfo>;
const mockGetWeAgentDetails = getWeAgentDetails as jest.MockedFunction<typeof getWeAgentDetails>;
const mockUseChatSession = useChatSession as jest.MockedFunction<typeof useChatSession>;

function createSession(id: string): SkillSession {
  return {
    welinkSessionId: id,
    userId: 'user-1',
    ak: 'ak-1',
    title: id,
    bussinessDomain: 'miniapp',
    bussinessType: 'direct',
    bussinessId: 'business-1',
    assistantAccount: 'assistant-1',
    status: 'active',
    toolSessionId: null,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  };
}

const assistantDetail: WeAgentDetails = {
  partnerAccount: 'assistant-1',
  moduleId: 'module-1',
  appKey: 'ak-1',
  appSecret: 'secret-1',
  name: 'Assistant',
  desc: 'Assistant description',
  icon: '',
  createdBy: 'creator-1',
  creatorName: 'Creator',
  creatorWorkId: 'creator-work-id',
  creatorW3Account: 'creator-w3',
  creatorNameEn: 'Creator',
  ownerWelinkId: 'owner-1',
  ownerW3Account: 'owner-w3',
  ownerName: 'Owner',
  ownerNameEn: 'Owner',
  ownerDeptName: 'Dept',
  ownerDeptNameEn: 'Dept',
  id: 'detail-1',
  bizRobotId: 'biz-robot-1',
  bizRobotTag: '',
  weCodeUrl: '',
};

describe('App session delete flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestChatSessionOptions = null;
    latestHistorySidebarProps = null;

    mockGetUserInfo.mockResolvedValue({
      uid: 'user-1',
      userNameZH: '用户',
      userNameEN: 'User',
      corpUserId: 'corp-user-1',
    });
    mockGetWeAgentDetails.mockResolvedValue({
      weAgentDetailsArray: [assistantDetail],
    });
    mockGetHistorySessionsList.mockResolvedValue({
      content: [createSession('session-1')],
      page: 0,
      size: 50,
      total: 1,
      totalPages: 1,
    });
    mockCreateNewSession.mockImplementation(async () => createSession(`fallback-${mockCreateNewSession.mock.calls.length}`));
    mockUseChatSession.mockImplementation((options): UseChatSessionResult => {
      latestChatSessionOptions = options;
      return {
        messages: [],
        pendingAssistantPreview: {
          visible: false,
          welinkSessionId: null,
          startedAt: 0,
        },
        welinkSessionId: options.welinkSessionId,
        sessionStatus: 'idle',
        isGenerating: false,
        isLoadingHistory: false,
        hasMoreHistory: false,
        scrollToBottomSignal: 0,
        slashCommands: [],
        onLoadMoreHistory: jest.fn(),
        onRequestSlashCommands: jest.fn(async () => undefined),
        onQuestionAnswered: jest.fn(async () => undefined),
        onSend: jest.fn(async () => undefined),
        onStop: jest.fn(async () => undefined),
        onSendToIM: jest.fn(async () => undefined),
        onCopy: jest.fn(async () => undefined),
        resetTransientState: jest.fn(),
      };
    });
  });

  it('creates a fallback session when local action delete removes the last current session', async () => {
    render(<App assistantAccount="assistant-1" />);

    await waitFor(() => {
      expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('session-1');
    });

    await act(async () => {
      await latestHistorySidebarProps?.onSessionDeleted?.('session-1');
    });

    expect(mockCreateNewSession).toHaveBeenCalledTimes(1);
  });

  it('does not create a fallback session when push sync removes the last current session', async () => {
    render(<App assistantAccount="assistant-1" />);

    await waitFor(() => {
      expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('session-1');
    });

    await act(async () => {
      latestChatSessionOptions?.onSessionDeleted?.('session-1');
      await Promise.resolve();
    });

    expect(mockCreateNewSession).not.toHaveBeenCalled();
  });

  it('selects the refreshed remote fallback session when push sync deletes the current last session', async () => {
    render(<App assistantAccount="assistant-1" />);

    await waitFor(() => {
      expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('session-1');
    });

    mockGetHistorySessionsList.mockResolvedValue({
      content: [createSession('remote-fallback-1')],
      page: 0,
      size: 50,
      total: 1,
      totalPages: 1,
    });

    await act(async () => {
      latestChatSessionOptions?.onSessionDeleted?.('session-1');
      await Promise.resolve();
    });

    expect(mockCreateNewSession).not.toHaveBeenCalled();
    expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('remote-fallback-1');
  });

  it('keeps local action delete responsible for fallback when its push echo arrives first', async () => {
    render(<App assistantAccount="assistant-1" />);

    await waitFor(() => {
      expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('session-1');
    });

    expect(latestHistorySidebarProps?.onSessionDeleteStart).toEqual(expect.any(Function));

    await act(async () => {
      latestHistorySidebarProps?.onSessionDeleteStart?.('session-1');
      latestChatSessionOptions?.onSessionDeleted?.('session-1');
      await Promise.resolve();
    });

    expect(mockCreateNewSession).not.toHaveBeenCalled();
    expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('session-1');

    await act(async () => {
      await latestHistorySidebarProps?.onSessionDeleted?.('session-1');
    });

    expect(mockCreateNewSession).toHaveBeenCalledTimes(1);
    expect(latestHistorySidebarProps?.currentWelinkSessionId).toBe('fallback-1');
  });
});
