import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import closeIcon from '../../imgs/close_icon.svg';
import iconWeAgentHistory from '../../imgs/icon-we-agent-history.svg';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { getHistorySessionsList, isPcMiniApp, type SkillSession } from '../../utils/hwext';
import { showToast } from '../../utils/toast';

type HistorySessionGroupKey = 'today' | 'yesterday' | 'sevenDaysAgo';

interface HistorySessionGroup {
  key: HistorySessionGroupKey;
  label: string;
  sessions: SkillSession[];
}

interface WeAgentHistorySidebarProps {
  assistantAccount?: string;
  currentWelinkSessionId?: string;
  cachedSessions?: SkillSession[];
  historyLoaded?: boolean;
  onHistoryLoaded?: (sessions: SkillSession[]) => void;
  onSessionSelect?: (welinkSessionId: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const HISTORY_SIDEBAR_ANIMATION_DURATION = 500;
const HISTORY_SESSION_GROUP_ORDER: Array<{ key: HistorySessionGroupKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'sevenDaysAgo', label: '7天前' },
];

function getStartOfDayTimestamp(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function resolveHistorySessionGroupKey(updatedAt: string): HistorySessionGroupKey {
  const updatedTimestamp = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTimestamp)) {
    return 'sevenDaysAgo';
  }

  const todayStart = getStartOfDayTimestamp(new Date());
  const updatedStart = getStartOfDayTimestamp(new Date(updatedTimestamp));
  const dayDiff = Math.floor((todayStart - updatedStart) / DAY_MILLISECONDS);

  if (dayDiff <= 0) {
    return 'today';
  }
  if (dayDiff === 1) {
    return 'yesterday';
  }
  return 'sevenDaysAgo';
}

function groupHistorySessionsByUpdatedAt(sessions: SkillSession[]): HistorySessionGroup[] {
  const grouped = new Map<HistorySessionGroupKey, SkillSession[]>([
    ['today', []],
    ['yesterday', []],
    ['sevenDaysAgo', []],
  ]);

  const sortedSessions = [...sessions].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  sortedSessions.forEach((session) => {
    const key = resolveHistorySessionGroupKey(session.updatedAt);
    const list = grouped.get(key);
    if (list) {
      list.push(session);
    }
  });

  return HISTORY_SESSION_GROUP_ORDER
    .map(({ key, label }) => ({
      key,
      label,
      sessions: grouped.get(key) ?? [],
    }))
    .filter((group) => group.sessions.length > 0);
}

const WeAgentHistorySidebar: React.FC<WeAgentHistorySidebarProps> = ({
  assistantAccount = '',
  currentWelinkSessionId = '',
  cachedSessions = [],
  historyLoaded = false,
  onHistoryLoaded,
  onSessionSelect,
  onVisibilityChange,
}) => {
  const isPc = isPcMiniApp();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRenderSidebar, setShouldRenderSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<SkillSession[]>([]);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupedHistorySessions = useMemo(
    () => groupHistorySessionsByUpdatedAt(historySessions),
    [historySessions],
  );

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsVisible(false);
    setShouldRenderSidebar(false);
    setIsLoading(false);
    setHistorySessions([]);
  }, [assistantAccount]);

  useEffect(() => {
    if (historyLoaded) {
      setHistorySessions(cachedSessions);
      return;
    }
    setHistorySessions([]);
  }, [cachedSessions, historyLoaded]);

  useEffect(() => {
    onVisibilityChange?.(shouldRenderSidebar);
  }, [onVisibilityChange, shouldRenderSidebar]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, []);

  const openSidebar = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setShouldRenderSidebar(true);
    window.requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const closeSidebar = useCallback(() => {
    if (!shouldRenderSidebar) {
      return;
    }

    setIsVisible(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setShouldRenderSidebar(false);
      closeTimerRef.current = null;
    }, HISTORY_SIDEBAR_ANIMATION_DURATION);
  }, [shouldRenderSidebar]);

  const handleOpen = useCallback(async () => {
    if (shouldRenderSidebar && isVisible) {
      closeSidebar();
      return;
    }

    openSidebar();
    if (historyLoaded) {
      setHistorySessions(cachedSessions);
      return;
    }
    setIsLoading(true);

    try {
      const currentAssistantAccount = assistantAccount.trim();
      const params = currentAssistantAccount
        ? { assistantAccount: currentAssistantAccount, businessSessionDomain: 'miniapp' as const }
        : { businessSessionDomain: 'miniapp' as const };
      const result = await getHistorySessionsList(params);
      const sessions = Array.isArray(result.content) ? result.content : [];
      setHistorySessions(sessions);
      onHistoryLoaded?.(sessions);
    } catch (error) {
      console.error('Failed to load history sessions:', error);
      showToast('获取历史会话失败');
      setHistorySessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [assistantAccount, cachedSessions, closeSidebar, historyLoaded, isVisible, onHistoryLoaded, openSidebar, shouldRenderSidebar]);

  const handleClose = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const handleSessionClick = useCallback((sessionId: string) => {
    onSessionSelect?.(sessionId);
    closeSidebar();
  }, [closeSidebar, onSessionSelect]);

  return (
    <>
      <button
        type="button"
        className="we-agent-cui-actions__button"
        onClick={(event) => {
          runButtonClickWithDebounce(event, () => {
            void handleOpen();
          });
        }}
        aria-label="历史会话"
      >
        <img
          className="we-agent-cui-actions__icon"
          src={iconWeAgentHistory}
          alt=""
        />
      </button>
      {shouldRenderSidebar && (
        <div
          className={[
            'we-agent-history-sidebar',
            isPc ? 'we-agent-history-sidebar--pc' : 'we-agent-history-sidebar--mobile',
            isVisible ? 'is-open' : 'is-closing',
          ].join(' ')}
          aria-label="历史会话侧边栏"
        >
          {!isPc && (
            <button
              type="button"
              className="we-agent-history-sidebar__mask"
              aria-label="关闭历史会话侧边栏"
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleClose();
                });
              }}
            />
          )}
          <aside
            className="we-agent-history-sidebar__panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="we-agent-history-sidebar__header">
              <h3 className="we-agent-history-sidebar__header-title">历史对话</h3>
            </header>
            <div className="we-agent-history-sidebar__body">
              {!isLoading && groupedHistorySessions.length === 0 && (
                <div className="we-agent-history-sidebar__empty">
                  <img
                    className="we-agent-history-sidebar__empty-image"
                    src={iconWeAgentHistory}
                    alt="暂无历史会话"
                  />
                </div>
              )}
              {!isLoading && groupedHistorySessions.map((group) => (
                <section key={group.key} className="we-agent-history-sidebar__group">
                  <div className="we-agent-history-sidebar__group-title">{group.label}</div>
                  <div className="we-agent-history-sidebar__group-items">
                    {group.sessions.map((session) => {
                      const sessionId = session.welinkSessionId;
                      const sessionTitle = session.title?.trim() || '未命名会话';
                      const isSelected = currentWelinkSessionId === sessionId;

                      return (
                        <button
                          key={sessionId}
                          type="button"
                          className={[
                            'we-agent-history-sidebar__session-item',
                            isSelected ? 'is-selected' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={(event) => {
                            runButtonClickWithDebounce(event, () => {
                              handleSessionClick(sessionId);
                            });
                          }}
                          title={sessionTitle}
                        >
                          <span className="we-agent-history-sidebar__session-item-text">{sessionTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </aside>
          {isPc && (
            <button
              type="button"
              className="we-agent-history-sidebar__close-button"
              aria-label="关闭历史会话"
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleClose();
                });
              }}
            >
              <img
                className="we-agent-history-sidebar__close-icon"
                src={closeIcon}
                alt=""
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default WeAgentHistorySidebar;
