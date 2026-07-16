import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import type {
  RegisterEventListenerParams,
  WeAgentDetails,
} from '../../types/bridge';

jest.mock('../../components/Content', () => ({
  Content: ({
    weAgentAssistantName,
    weAgentAssistantDescription,
    weAgentAssistantAvatar,
  }: {
    weAgentAssistantName: string;
    weAgentAssistantDescription: string;
    weAgentAssistantAvatar: string;
  }) => (
    <div>
      <span data-testid="assistant-name">{weAgentAssistantName}</span>
      <span data-testid="assistant-description">{weAgentAssistantDescription}</span>
      <span data-testid="assistant-avatar">{weAgentAssistantAvatar}</span>
    </div>
  ),
}));

jest.mock('../../components/assistant/WeAgentCUIFooter', () => () => null);
jest.mock('../../components/assistant/WeAgentHistorySidebar', () => () => null);
jest.mock('../../hooks/useIosKeyboardLift', () => ({
  useIosKeyboardLift: () => ({ keyboardContainerStyle: {} }),
}));
jest.mock('../../hooks/useChatSession', () => ({
  useChatSession: () => ({
    messages: [],
    pendingAssistantPreview: {
      visible: false,
      welinkSessionId: '',
      startedAt: 0,
    },
    welinkSessionId: 'session_1',
    scrollToBottomSignal: 0,
    isLoadingHistory: false,
    hasMoreHistory: false,
    slashCommands: [],
    onLoadMoreHistory: jest.fn(),
    onRequestSlashCommands: jest.fn(),
    onQuestionAnswered: jest.fn(),
    isGenerating: false,
    onSend: jest.fn(),
    onStop: jest.fn(),
    onSendToIM: jest.fn(),
    onCopy: jest.fn(),
    resetTransientState: jest.fn(),
  }),
}));

const initialDetail: WeAgentDetails = {
  name: 'Original Assistant',
  icon: 'https://example.com/original.png',
  desc: 'Original description',
  moduleId: 'module_1',
  appKey: 'app_key_1',
  appSecret: 'app_secret_1',
  partnerAccount: 'assistant_1',
  createdBy: 'user_1',
  creatorWorkId: '10001',
  creatorW3Account: 'creator_1',
  creatorName: 'Creator',
  creatorNameEn: 'Creator',
  ownerWelinkId: 'owner_1',
  ownerW3Account: 'owner_1',
  ownerName: 'Owner',
  ownerNameEn: 'Owner',
  ownerDeptName: 'Department',
  ownerDeptNameEn: 'Department',
  id: 'robot_1',
  bizRobotId: '',
  bizRobotTag: '',
  bizRobotName: '',
  bizRobotNameEn: '',
  weCodeUrl: 'h5://123456/index.html#weAgentCUI',
};

describe('weAgentCUI assistant update event', () => {
  let registeredListeners: Map<string, RegisterEventListenerParams>;

  beforeEach(() => {
    registeredListeners = new Map();
    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        registerEventListener: jest.fn((params: RegisterEventListenerParams) => {
          registeredListeners.set(params.type, params);
        }),
        getWeAgentDetails: jest.fn(async () => ({
          weAgentDetailsArray: [initialDetail],
        })),
        getHistorySessionsList: jest.fn(async () => ({
          content: [{
            welinkSessionId: 'session_1',
            userId: 'user_1',
            ak: 'app_key_1',
            title: 'Session',
            bussinessDomain: 'miniapp',
            bussinessType: 'direct',
            bussinessId: 'user_1',
            assistantAccount: 'assistant_1',
            status: 'idle',
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
          }],
          page: 0,
          size: 20,
          total: 1,
          totalPages: 1,
        })),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'HWH5', {
      value: {
        addEventListener: jest.fn(),
        getUserInfo: jest.fn(async () => ({
          uid: 'user_1',
          userNameZH: '测试用户',
          userNameEN: 'Mock User',
          corpUserId: 'corp_1',
        })),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
  });

  it('registers the update listener, refreshes current assistant details, and ignores delete events', async () => {
    render(<App assistantAccount="assistant_1" />);

    await waitFor(() => {
      expect(screen.getByTestId('assistant-name')).toHaveTextContent('Original Assistant');
    });
    await waitFor(() => {
      expect(registeredListeners.get('agentskills_agentUpdated')).toBeDefined();
      expect(registeredListeners.get('agentskills_unreadChanged')).toBeDefined();
    });

    const updatedDetail: WeAgentDetails = {
      ...initialDetail,
      name: 'Updated Assistant',
      icon: 'https://example.com/updated.png',
      desc: 'Updated description',
    };

    act(() => {
      registeredListeners.get('agentskills_agentUpdated')?.func({
        type: 'update',
        data: updatedDetail,
        extraData: { source: 'server' },
      });
    });

    expect(screen.getByTestId('assistant-name')).toHaveTextContent('Updated Assistant');
    expect(screen.getByTestId('assistant-description')).toHaveTextContent('Updated description');
    expect(screen.getByTestId('assistant-avatar')).toHaveTextContent('https://example.com/updated.png');

    act(() => {
      registeredListeners.get('agentskills_agentUpdated')?.func({
        type: 'delete',
        data: { partnerAccount: 'assistant_1' },
        extraData: { source: 'server' },
      });
    });

    expect(screen.getByTestId('assistant-name')).toHaveTextContent('Updated Assistant');
    expect(screen.getByTestId('assistant-description')).toHaveTextContent('Updated description');
  });
});
