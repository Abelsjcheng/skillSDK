import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { isPcMiniApp } from '../../constants';
import closeIcon from '../../imgs/close_icon.svg';
import iconWeAgentHistory from '../../imgs/icon-we-agent-history.svg';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { getHistorySessionsList, type SkillSession } from '../../utils/hwext';
import { WeLog } from '../../utils/logger';
import { showToast } from '../../utils/toast';

type HistorySessionGroupKey = 'today' | 'yesterday' | 'threeDaysAgo';

interface HistorySessionGroup {
  key: HistorySessionGroupKey;
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
const HISTORY_SIDEBAR_ANIMATION_DURATION = 360;
const HISTORY_SESSION_GROUP_ORDER: HistorySessionGroupKey[] = ['today', 'yesterday', 'threeDaysAgo'];

function getStartOfDayTimestamp(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function resolveHistorySessionGroupKey(updatedAt: string): HistorySessionGroupKey {
  const updatedTimestamp = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTimestamp)) {
    return 'threeDaysAgo';
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
  return 'threeDaysAgo';
}

function groupHistorySessionsByUpdatedAt(sessions: SkillSession[]): HistorySessionGroup[] {
  const grouped = new Map<HistorySessionGroupKey, SkillSession[]>([
    ['today', []],
    ['yesterday', []],
    ['threeDaysAgo', []],
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
    .map((key) => ({
      key,
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
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRenderSidebar, setShouldRenderSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<SkillSession[]>([]);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRequestIdRef = useRef(0);

  const groupedHistorySessions = useMemo(
    () => groupHistorySessionsByUpdatedAt(historySessions),
    [historySessions],
  );

  const historyGroupLabels = useMemo<Record<HistorySessionGroupKey, string>>(() => ({
    today: t('weAgent.today'),
    yesterday: t('weAgent.yesterday'),
    threeDaysAgo: t('weAgent.threeDaysAgo'),
  }), [t]);

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
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

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

  const refreshHistorySessions = useCallback(async (showLoading: boolean) => {
    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const currentAssistantAccount = assistantAccount.trim();
      const params = currentAssistantAccount
        ? { assistantAccount: currentAssistantAccount, businessSessionDomain: 'miniapp' as const }
        : { businessSessionDomain: 'miniapp' as const };
      const result = await getHistorySessionsList(params);

      if (fetchRequestIdRef.current !== requestId) {
        return;
      }

      const sessions = Array.isArray(result.content) ? result.content : [];
      setHistorySessions(sessions);
      onHistoryLoaded?.(sessions);
    } catch (error) {
      if (fetchRequestIdRef.current !== requestId) {
        return;
      }

      WeLog(`WeAgentHistorySidebar getHistorySessionsList failed | extra=${JSON.stringify({
        assistantAccount: assistantAccount.trim() || undefined,
      })} | error=${JSON.stringify(error)}`);
      showToast(t('weAgent.loadHistoryFailed'));

      if (showLoading) {
        setHistorySessions([]);
      }
    } finally {
      if (fetchRequestIdRef.current === requestId && showLoading) {
        setIsLoading(false);
      }
    }
  }, [assistantAccount, onHistoryLoaded, t]);

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

    if (cachedSessions.length > 0) {
      setHistorySessions(cachedSessions);
      setIsLoading(false);
      void refreshHistorySessions(false);
      return;
    }

    void refreshHistorySessions(true);
  }, [cachedSessions, closeSidebar, isVisible, openSidebar, refreshHistorySessions, shouldRenderSidebar]);

  const handleClose = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const handleSessionClick = useCallback((sessionId: string) => {
    onSessionSelect?.(sessionId);
    closeSidebar();
  }, [closeSidebar, onSessionSelect]);

  const sidebarNode = shouldRenderSidebar ? (
    <div
      className={[
        'we-agent-history-sidebar',
        isPc ? 'we-agent-history-sidebar--pc' : 'we-agent-history-sidebar--mobile',
        isVisible ? 'is-open' : 'is-closing',
      ].join(' ')}
      aria-label={t('weAgent.historySidebar')}
    >
      {!isPc && (
        <button
          type="button"
          className="we-agent-history-sidebar__mask"
          aria-label={t('weAgent.closeHistorySidebar')}
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
          <h3 className="we-agent-history-sidebar__header-title">{t('weAgent.history')}</h3>
        </header>
        <div className="we-agent-history-sidebar__body">
          {!isLoading && groupedHistorySessions.length === 0 && (
            <div className="we-agent-history-sidebar__empty">
              <img
                className="we-agent-history-sidebar__empty-image"
                src={iconWeAgentHistory}
                alt={t('weAgent.noHistorySessions')}
              />
            </div>
          )}
          {!isLoading && groupedHistorySessions.map((group) => (
            <section key={group.key} className="we-agent-history-sidebar__group">
              <div className="we-agent-history-sidebar__group-title">{historyGroupLabels[group.key]}</div>
              <div className="we-agent-history-sidebar__group-items">
                {group.sessions.map((session) => {
                  const sessionId = session.welinkSessionId;
                  const sessionTitle = session.title?.trim() || t('weAgent.untitledSession');
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
          aria-label={t('weAgent.closeHistorySidebar')}
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
  ) : null;

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
        aria-label={t('weAgent.openHistorySidebar')}
      >
        <img
          className="we-agent-cui-actions__icon"
          src={iconWeAgentHistory}
          alt=""
        />
      </button>
      {typeof document !== 'undefined' && sidebarNode
        ? createPortal(sidebarNode, document.body)
        : sidebarNode}
    </>
  );
};

export default WeAgentHistorySidebar;
