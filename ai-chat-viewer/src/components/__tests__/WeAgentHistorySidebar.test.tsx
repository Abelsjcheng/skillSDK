import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WeAgentHistorySidebar from '../assistant/WeAgentHistorySidebar';
import type { SkillSession } from '../../types/bridge';
import type { HistorySessionsCache } from '../../types/components';
import * as constants from '../../constants';
import { getHistorySessionsList } from '../../utils/hwext';

jest.mock('../../utils/hwext', () => ({
  getHistorySessionsList: jest.fn(),
}));

jest.mock('../../utils/uemUtil', () => ({
  reportViewHistoryClick: jest.fn(),
}));

jest.mock('../../utils/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  WeLog: jest.fn(),
}));

const mockGetHistorySessionsList = getHistorySessionsList as jest.MockedFunction<typeof getHistorySessionsList>;

function createSession(overrides: Partial<SkillSession> = {}): SkillSession {
  return {
    welinkSessionId: 'session-1',
    userId: 'user-1',
    ak: 'ak-1',
    title: 'Today session',
    bussinessDomain: 'miniapp',
    bussinessType: 'direct',
    bussinessId: 'business-1',
    assistantAccount: 'assistant-1',
    status: 'active',
    toolSessionId: null,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    ...overrides,
  };
}

function createCache(content: SkillSession[], overrides: Partial<HistorySessionsCache> = {}): HistorySessionsCache {
  return {
    content,
    page: 0,
    size: 50,
    total: content.length,
    totalPages: 1,
    ...overrides,
  };
}

describe('WeAgentHistorySidebar', () => {
  let isPcMiniAppSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    isPcMiniAppSpy = jest.spyOn(constants, 'isPcMiniApp');
    isPcMiniAppSpy.mockReturnValue(true);
  });

  afterEach(() => {
    isPcMiniAppSpy.mockRestore();
  });

  it('opens by default on PC without fetching or showing empty state while history is loading', () => {
    render(
      <WeAgentHistorySidebar
        assistantAccount="assistant-1"
        defaultOpen
        historyLoaded={false}
      />,
    );

    expect(document.querySelector('.we-agent-history-sidebar.is-open')).toBeInTheDocument();
    expect(document.querySelector('.we-agent-history-sidebar__empty')).not.toBeInTheDocument();
    expect(mockGetHistorySessionsList).not.toHaveBeenCalled();
  });

  it('renders cached sessions when default-opened', () => {
    render(
      <WeAgentHistorySidebar
        assistantAccount="assistant-1"
        currentWelinkSessionId="session-1"
        cachedCache={createCache([createSession()])}
        defaultOpen
        historyLoaded
      />,
    );

    expect(screen.getByText('Today session')).toBeInTheDocument();
    expect(document.querySelector('.we-agent-history-sidebar__session-item.is-selected')).toHaveTextContent('Today session');
    expect(mockGetHistorySessionsList).not.toHaveBeenCalled();
  });

  it('appends loaded pages and emits the merged cache', async () => {
    const onHistoryLoaded = jest.fn();
    const firstSession = createSession({ welinkSessionId: 'session-1', title: 'First session' });
    const secondSession = createSession({
      welinkSessionId: 'session-2',
      title: 'Second session',
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T09:00:00.000Z',
    });
    mockGetHistorySessionsList.mockResolvedValue({
      content: [secondSession],
      page: 1,
      size: 50,
      total: 2,
      totalPages: 2,
    });

    render(
      <WeAgentHistorySidebar
        assistantAccount="assistant-1"
        cachedCache={createCache([firstSession], { total: 2, totalPages: 2 })}
        defaultOpen
        historyLoaded
        onHistoryLoaded={onHistoryLoaded}
      />,
    );

    fireEvent.click(screen.getByText('加载更多'));

    await waitFor(() => {
      expect(onHistoryLoaded).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        totalPages: 2,
        content: [firstSession, secondSession],
      }));
    });
    expect(mockGetHistorySessionsList).toHaveBeenCalledWith({
      assistantAccount: 'assistant-1',
      businessSessionDomain: 'miniapp',
      page: 1,
      size: 50,
    });
  });

  it('keeps the sidebar open after selecting a session on PC', () => {
    const onSessionSelect = jest.fn();

    render(
      <WeAgentHistorySidebar
        assistantAccount="assistant-1"
        cachedCache={createCache([createSession()])}
        defaultOpen
        historyLoaded
        onSessionSelect={onSessionSelect}
      />,
    );

    fireEvent.click(screen.getByText('Today session'));

    expect(onSessionSelect).toHaveBeenCalledWith('session-1');
    expect(document.querySelector('.we-agent-history-sidebar.is-open')).toBeInTheDocument();
  });
});
