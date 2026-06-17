import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WeAgentHistorySidebar from '../assistant/WeAgentHistorySidebar';
import type { SkillSession } from '../../types/bridge';
import type { HistorySessionsCache } from '../../types/components';
import * as constants from '../../constants';
import { deleteHistorySession, getHistorySessionsList } from '../../utils/hwext';

jest.mock('../../utils/hwext', () => ({
  deleteHistorySession: jest.fn(),
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
const mockDeleteHistorySession = deleteHistorySession as jest.MockedFunction<typeof deleteHistorySession>;

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
    mockDeleteHistorySession.mockResolvedValue({
      status: 'deleted',
      welinkSessionId: 'session-1',
    });
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

  it('deletes a session from the PC context menu after confirmation', async () => {
    const onSessionDeleted = jest.fn();
    const firstSession = createSession({ welinkSessionId: 'session-1', title: 'First session' });
    const secondSession = createSession({ welinkSessionId: 'session-2', title: 'Second session' });

    render(
      <WeAgentHistorySidebar
        assistantAccount="assistant-1"
        cachedCache={createCache([firstSession, secondSession])}
        defaultOpen
        historyLoaded
        onSessionDeleted={onSessionDeleted}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'First session' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(mockDeleteHistorySession).toHaveBeenCalledWith({
        welinkSessionId: 'session-1',
      });
    });
    expect(onSessionDeleted).toHaveBeenCalledWith('session-1');
  });

  it('opens an action popup at the lower right of a session item when space allows', () => {
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

    const sessionItem = screen.getByRole('button', { name: 'Today session' });
    jest.spyOn(sessionItem, 'getBoundingClientRect').mockReturnValue({
      top: 80,
      right: 220,
      bottom: 112,
      left: 20,
      width: 200,
      height: 32,
      x: 20,
      y: 80,
      toJSON: () => ({}),
    });

    fireEvent.contextMenu(sessionItem);

    expect(onSessionSelect).not.toHaveBeenCalled();
    const menu = screen.getByRole('menu', { name: '会话操作' });
    expect(menu).toHaveStyle({ right: `${window.innerWidth - 220}px`, top: '116px' });
    expect(menu).not.toHaveClass('is-above');
    expect(screen.queryByRole('menuitem', { name: '重命名' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '删除' })).toBeInTheDocument();
  });

  it('opens the action popup at the upper right when lower space is insufficient', () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 140,
    });

    render(
      <WeAgentHistorySidebar
        assistantAccount="assistant-1"
        cachedCache={createCache([createSession()])}
        defaultOpen
        historyLoaded
      />,
    );

    const sessionItem = screen.getByRole('button', { name: 'Today session' });
    jest.spyOn(sessionItem, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      right: 220,
      bottom: 132,
      left: 20,
      width: 200,
      height: 32,
      x: 20,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.contextMenu(sessionItem);

    const menu = screen.getByRole('menu', { name: '会话操作' });
    expect(menu).toHaveStyle({ right: `${window.innerWidth - 220}px`, top: '96px' });
    expect(menu).toHaveClass('is-above');
  });

  it('opens the delete action popup on mobile long press without selecting the session', () => {
    jest.useFakeTimers();
    isPcMiniAppSpy.mockReturnValue(false);
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

    const sessionItem = screen.getByRole('button', { name: 'Today session' });
    jest.spyOn(sessionItem, 'getBoundingClientRect').mockReturnValue({
      top: 80,
      right: 220,
      bottom: 112,
      left: 20,
      width: 200,
      height: 32,
      x: 20,
      y: 80,
      toJSON: () => ({}),
    });

    fireEvent.touchStart(sessionItem);
    act(() => {
      jest.advanceTimersByTime(520);
    });

    expect(screen.getByRole('menu', { name: '会话操作' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '删除' })).toBeInTheDocument();

    fireEvent.touchEnd(sessionItem);
    fireEvent.click(sessionItem);

    expect(onSessionSelect).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
