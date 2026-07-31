import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import ResponsiveConfirmModal from '../system/ResponsiveConfirmModal';
import { isPcMiniApp } from '../../constants';
import historySession from '../../imgs/historySession.svg';
import closeIcon from '../../imgs/slider_close_icon.png';
import iconWeAgentHistory from '../../imgs/no-history_icon.png';
import deleteIcon from '../../imgs/delete_icon.png';
import editIcon from '../../imgs/edit_icon.png';
import type { SkillSession } from '../../types/bridge';
import type {
  HistorySessionGroup,
  HistorySessionGroupKey,
  WeAgentHistorySidebarProps,
  HistorySessionsCache,
} from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { deleteHistorySession, getHistorySessionsList } from '../../utils/hwext';
import { WeLog } from '../../utils/logger';
import { removeSessionFromHistoryCache } from '../../utils/sessionDelete';
import { HISTORY_SESSIONS_PAGE_SIZE } from '../../utils/session';
import { showToast } from '../../utils/toast';
import { reportViewHistoryClick } from '../../utils/uemUtil';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const HISTORY_SIDEBAR_ANIMATION_DURATION = 360;
const HISTORY_SESSION_GROUP_ORDER: HistorySessionGroupKey[] = ['today', 'yesterday', 'threeDaysAgo'];
const SESSION_ACTION_POPUP_OFFSET = 4;
const SESSION_ACTION_POPUP_MIN_WIDTH = 100;
const SESSION_ACTION_POPUP_HEIGHT = 44;
const SESSION_ACTION_POPUP_VIEWPORT_PADDING = 8;
const SHOW_RENAME_SESSION_ACTION = false;

interface SessionActionPopupPosition {
  top: number;
  right: number;
  placement: 'above' | 'below';
}

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

function mergeHistorySessions(currentSessions: SkillSession[], nextSessions: SkillSession[]): SkillSession[] {
  const seenSessionIds = new Set<string>();
  const mergedSessions: SkillSession[] = [];

  // 加载更多时把新页追加到本地缓存，并按 welinkSessionId 去重。
  [...currentSessions, ...nextSessions].forEach((session) => {
    if (seenSessionIds.has(session.welinkSessionId)) {
      return;
    }
    seenSessionIds.add(session.welinkSessionId);
    mergedSessions.push(session);
  });

  return mergedSessions;
}

function resolveSessionActionPopupPosition(target: HTMLElement): SessionActionPopupPosition {
  const rect = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const shouldPlaceBelow = rect.bottom + SESSION_ACTION_POPUP_OFFSET + SESSION_ACTION_POPUP_HEIGHT
    <= viewportHeight - SESSION_ACTION_POPUP_VIEWPORT_PADDING;
  const maxRight = Math.max(viewportWidth - SESSION_ACTION_POPUP_MIN_WIDTH - SESSION_ACTION_POPUP_VIEWPORT_PADDING, 0);

  return {
    top: shouldPlaceBelow
      ? rect.bottom + SESSION_ACTION_POPUP_OFFSET
      : rect.top - SESSION_ACTION_POPUP_OFFSET,
    right: Math.max(SESSION_ACTION_POPUP_VIEWPORT_PADDING, Math.min(viewportWidth - rect.right, maxRight)),
    placement: shouldPlaceBelow ? 'below' : 'above',
  };
}

const WeAgentHistorySidebar: React.FC<WeAgentHistorySidebarProps> = ({
  assistantAccount = '',
  currentWelinkSessionId = '',
  cachedCache = null,
  defaultOpen = false,
  historyLoaded = false,
  redDotVisible = false,
  sessionUnreadStateMap = {},
  onHistoryLoaded,
  onSessionDeleteFailed,
  onSessionDeleteStart,
  onSessionDeleted,
  onSessionSelect,
  onVisibilityChange,
}) => {
  const isPc = isPcMiniApp();
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(defaultOpen);
  const [shouldRenderSidebar, setShouldRenderSidebar] = useState(defaultOpen);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historySessions, setHistorySessions] = useState<SkillSession[]>([]);
  const [deleteTargetSession, setDeleteTargetSession] = useState<SkillSession | null>(null);
  const [sessionActionPopupPosition, setSessionActionPopupPosition] = useState<SessionActionPopupPosition | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<SkillSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const fetchRequestIdRef = useRef(0);
  const historySessionsRef = useRef<SkillSession[]>([]);
  const actionPopupRef = useRef<HTMLDivElement | null>(null);

  const groupedHistorySessions = useMemo(
    () => groupHistorySessionsByUpdatedAt(historySessions),
    [historySessions],
  );
  const hasUnreadSession = useMemo(
    () => Object.values(sessionUnreadStateMap).some((session) => (
      session.welinkSessionId !== currentWelinkSessionId && session.hasUnRead
    )),
    [currentWelinkSessionId, sessionUnreadStateMap],
  );
  const hasMoreHistorySessions = !isLoading && currentPage + 1 < totalPages;
  const activePopupSessionId = deleteTargetSession?.welinkSessionId ?? '';

  const historyGroupLabels = useMemo<Record<HistorySessionGroupKey, string>>(() => ({
    today: t('weAgent.today'),
    yesterday: t('weAgent.yesterday'),
    threeDaysAgo: t('weAgent.threeDaysAgo'),
  }), [t]);

  useEffect(() => {
    fetchRequestIdRef.current += 1;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsVisible(defaultOpen);
    setShouldRenderSidebar(defaultOpen);
    setIsLoading(false);
    setIsLoadingMore(false);
    setDeleteTargetSession(null);
    setSessionActionPopupPosition(null);
    setConfirmDeleteSession(null);
    setIsDeletingSession(false);
    historySessionsRef.current = [];
    setHistorySessions([]);
    setCurrentPage(0);
    setTotalPages(0);
  }, [assistantAccount, defaultOpen]);

  useEffect(() => {
    if (historyLoaded) {
      // 侧边栏以 App 维护的 HistorySessionsCache 为准，保证默认展开和手动打开看到同一份数据。
      const nextSessions = cachedCache?.content ?? [];
      historySessionsRef.current = nextSessions;
      setHistorySessions(nextSessions);
      setCurrentPage(cachedCache?.page ?? 0);
      setTotalPages(cachedCache?.totalPages ?? 0);
      return;
    }
    setHistorySessions([]);
    setCurrentPage(0);
    setTotalPages(0);
  }, [cachedCache, historyLoaded]);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  useEffect(() => {
    historySessionsRef.current = historySessions;
  }, [historySessions]);

  useEffect(() => {
    if (!deleteTargetSession) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && actionPopupRef.current?.contains(target)) {
        return;
      }
      setDeleteTargetSession(null);
      setSessionActionPopupPosition(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [deleteTargetSession]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
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

  const loadHistorySessionsPage = useCallback(async (page: number, showLoading: boolean, append: boolean) => {
    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;

    if (showLoading) {
      setIsLoading(true);
    } else if (append) {
      setIsLoadingMore(true);
    }

    try {
      const currentAssistantAccount = assistantAccount.trim();
      const params = currentAssistantAccount
        ? {
          assistantAccount: currentAssistantAccount,
          businessSessionDomain: 'miniapp' as const,
          page,
          size: HISTORY_SESSIONS_PAGE_SIZE,
        }
        : {
          businessSessionDomain: 'miniapp' as const,
          page,
          size: HISTORY_SESSIONS_PAGE_SIZE,
        };
      const result = await getHistorySessionsList(params);

      if (fetchRequestIdRef.current !== requestId) {
        return;
      }

      const sessions = Array.isArray(result.content) ? result.content : [];
      const nextPage = typeof result.page === 'number' ? result.page : page;
      const nextTotalPages = typeof result.totalPages === 'number' ? result.totalPages : 0;
      const nextSessions = append ? mergeHistorySessions(historySessionsRef.current, sessions) : sessions;
      // 回传合并后的缓存快照，让 App 继续作为历史列表的数据源。
      const nextCache: HistorySessionsCache = {
        content: nextSessions,
        page: nextPage,
        size: typeof result.size === 'number' ? result.size : HISTORY_SESSIONS_PAGE_SIZE,
        total: Math.max(typeof result.total === 'number' ? result.total : 0, nextSessions.length),
        totalPages: nextTotalPages,
      };

      setCurrentPage(nextPage);
      setTotalPages(nextTotalPages);
      historySessionsRef.current = nextSessions;
      setHistorySessions(nextSessions);
      onHistoryLoaded?.(nextCache);
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
        setCurrentPage(0);
        setTotalPages(0);
      }
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        if (showLoading) {
          setIsLoading(false);
        }
        if (append) {
          setIsLoadingMore(false);
        }
      }
    }
  }, [assistantAccount, onHistoryLoaded, t]);

  const refreshHistorySessions = useCallback((showLoading: boolean) => (
    loadHistorySessionsPage(0, showLoading, false)
  ), [loadHistorySessionsPage]);

  const closeSidebar = useCallback(() => {
    if (!shouldRenderSidebar) {
      return;
    }

    setIsVisible(false);
    setDeleteTargetSession(null);
    setSessionActionPopupPosition(null);
    setConfirmDeleteSession(null);
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
    reportViewHistoryClick(assistantAccount);
    if (cachedCache) {
      // 用户手动打开时先展示缓存，再静默刷新第一页，减少等待和闪烁。
      const nextSessions = cachedCache.content;
      historySessionsRef.current = nextSessions;
      setHistorySessions(nextSessions);
      setCurrentPage(cachedCache.page);
      setTotalPages(cachedCache.totalPages);
      setIsLoading(false);
      setIsLoadingMore(false);
      void refreshHistorySessions(false);
      return;
    }

    void refreshHistorySessions(true);
  }, [
    assistantAccount,
    cachedCache,
    closeSidebar,
    isVisible,
    openSidebar,
    refreshHistorySessions,
    shouldRenderSidebar,
  ]);

  const handleClose = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const handleSessionClick = useCallback((sessionId: string) => {
    setDeleteTargetSession(null);
    setSessionActionPopupPosition(null);
    onSessionSelect?.(sessionId);
    // PC 端侧边栏常驻展示；移动端仍沿用抽屉选择后关闭的交互。
    if (!isPc) {
      closeSidebar();
    }
  }, [closeSidebar, isPc, onSessionSelect]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const showDeleteAction = useCallback((session: SkillSession, target: HTMLElement) => {
    setDeleteTargetSession(session);
    setSessionActionPopupPosition(resolveSessionActionPopupPosition(target));
  }, []);

  const handleSessionContextMenu = useCallback((event: React.MouseEvent, session: SkillSession) => {
    event.preventDefault();
    event.stopPropagation();
    showDeleteAction(session, event.currentTarget as HTMLElement);
  }, [showDeleteAction]);

  const handleTouchStart = useCallback((event: React.TouchEvent, session: SkillSession) => {
    if (isPc) {
      return;
    }
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    const target = event.currentTarget as HTMLElement;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      showDeleteAction(session, target);
    }, 520);
  }, [clearLongPressTimer, isPc, showDeleteAction]);

  const handleDeleteActionClick = useCallback((session: SkillSession) => {
    setConfirmDeleteSession(session);
    setDeleteTargetSession(null);
    setSessionActionPopupPosition(null);
  }, []);

  const removeDeletedSessionLocally = useCallback((sessionId: string) => {
    const previousSessions = historySessionsRef.current;
    const nextSessions = previousSessions.filter((session) => session.welinkSessionId !== sessionId);
    historySessionsRef.current = nextSessions;
    setHistorySessions(nextSessions);

    const baseCache: HistorySessionsCache = cachedCache ?? {
      content: previousSessions,
      page: currentPage,
      size: HISTORY_SESSIONS_PAGE_SIZE,
      total: previousSessions.length,
      totalPages,
    };
    const nextCache = removeSessionFromHistoryCache(baseCache, sessionId);
    if (nextCache) {
      onHistoryLoaded?.(nextCache);
      setCurrentPage(nextCache.page);
      setTotalPages(nextCache.totalPages);
    }
  }, [cachedCache, currentPage, onHistoryLoaded, totalPages]);

  const handleCancelDelete = useCallback(() => {
    if (isDeletingSession) {
      return;
    }
    setConfirmDeleteSession(null);
  }, [isDeletingSession]);

  const handleConfirmDelete = useCallback(async () => {
    const target = confirmDeleteSession;
    if (!target || isDeletingSession) {
      return;
    }

    const sessionId = target.welinkSessionId;
    setIsDeletingSession(true);
    onSessionDeleteStart?.(sessionId);
    try {
      await deleteHistorySession({ welinkSessionId: sessionId });
      removeDeletedSessionLocally(sessionId);
      await onSessionDeleted?.(sessionId);
      setDeleteTargetSession(null);
      setSessionActionPopupPosition(null);
      setConfirmDeleteSession(null);
    } catch (error) {
      onSessionDeleteFailed?.(sessionId);
      WeLog(`WeAgentHistorySidebar deleteHistorySession failed | extra=${JSON.stringify({ welinkSessionId: sessionId })} | error=${JSON.stringify(error)}`);
      showToast(t('weAgent.deleteSessionFailed'));
    } finally {
      setIsDeletingSession(false);
    }
  }, [
    confirmDeleteSession,
    isDeletingSession,
    onSessionDeleteFailed,
    onSessionDeleteStart,
    onSessionDeleted,
    removeDeletedSessionLocally,
    t,
  ]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMoreHistorySessions) {
      return;
    }

    void loadHistorySessionsPage(currentPage + 1, false, true);
  }, [currentPage, hasMoreHistorySessions, isLoading, isLoadingMore, loadHistorySessionsPage]);

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
          {historyLoaded && !isLoading && groupedHistorySessions.length === 0 && (
            <div className="we-agent-history-sidebar__empty">
              <img
                className="we-agent-history-sidebar__empty-image"
                src={iconWeAgentHistory}
                alt={t('weAgent.noHistorySessions')}
                draggable="false"
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
                  const isActionTarget = activePopupSessionId === sessionId;
                  const showSessionUnreadRedDot = redDotVisible && Boolean(sessionUnreadStateMap[sessionId]?.hasUnRead);
                  return (
                    <div
                      key={sessionId}
                      className="we-agent-history-sidebar__session-row"
                    >
                      <button
                        type="button"
                        className={[
                          'we-agent-history-sidebar__session-item',
                          isSelected ? 'is-selected' : '',
                          isActionTarget ? 'is-action-target' : '',
                        ].filter(Boolean).join(' ')}
                        onContextMenu={(event) => handleSessionContextMenu(event, session)}
                        onTouchStart={(event) => handleTouchStart(event, session)}
                        onTouchEnd={clearLongPressTimer}
                        onTouchCancel={clearLongPressTimer}
                        onTouchMove={clearLongPressTimer}
                        onMouseLeave={() => {
                          if (!isPc) {
                            clearLongPressTimer();
                          }
                        }}
                        onClick={(event) => {
                          if (longPressTriggeredRef.current) {
                            event.preventDefault();
                            event.stopPropagation();
                            longPressTriggeredRef.current = false;
                            return;
                          }
                          runButtonClickWithDebounce(event, () => {
                            handleSessionClick(sessionId);
                          });
                        }}
                        title={sessionTitle}
                      >
                        <span className="we-agent-history-sidebar__session-item-text">{sessionTitle}</span>
                        {showSessionUnreadRedDot ? (
                          <span className="we-agent-history-sidebar__session-item-red-dot" aria-hidden="true" />
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {hasMoreHistorySessions && (
            <button
              type="button"
              className="we-agent-history-sidebar__load-more"
              disabled={isLoadingMore}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleLoadMore();
                });
              }}
            >
              {isLoadingMore
                ? t('weAgent.loadingMoreHistorySessions')
                : t('weAgent.loadMoreHistorySessions')}
            </button>
          )}
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
            draggable="false"
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
        data-tooltip={isPc ? t('weAgent.historyToolTip') : undefined}
        onClick={(event) => {
          runButtonClickWithDebounce(event, () => {
            void handleOpen();
          });
        }}
        aria-label={t('weAgent.openHistorySidebar')}
      >
        <img
          className="we-agent-cui-actions__icon"
          src={historySession}
          alt=""
          draggable="false"
        />
        {redDotVisible && hasUnreadSession ? (
          <span className="we-agent-cui-actions__red-dot" aria-hidden="true" />
        ) : null}
      </button>
      {typeof document !== 'undefined' && sidebarNode
        ? createPortal(sidebarNode, document.body)
        : sidebarNode}
      {deleteTargetSession && sessionActionPopupPosition && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={actionPopupRef}
            role="menu"
            aria-label={t('weAgent.sessionActions')}
            className={[
              'we-agent-history-sidebar__action-popup',
              isPc
                ? 'we-agent-history-sidebar__action-popup--pc'
                : 'we-agent-history-sidebar__action-popup--mobile',
              sessionActionPopupPosition.placement === 'above' ? 'is-above' : 'is-below',
            ].join(' ')}
            style={{
              top: `${sessionActionPopupPosition.top}px`,
              right: `${sessionActionPopupPosition.right}px`,
            }}
          >
            {SHOW_RENAME_SESSION_ACTION && (
              <button
                type="button"
                role="menuitem"
                className="we-agent-history-sidebar__action-item"
              >
                <span
                  className="we-agent-history-sidebar__action-icon"
                  style={{ WebkitMaskImage: `url(${editIcon})`, maskImage: `url(${editIcon})` }}
                  aria-hidden="true"
                />
                <span className="we-agent-history-sidebar__action-text">{t('weAgent.renameSession')}</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="we-agent-history-sidebar__action-item we-agent-history-sidebar__action-item--danger"
              onClick={(event) => {
                event.stopPropagation();
                runButtonClickWithDebounce(event, () => {
                  handleDeleteActionClick(deleteTargetSession);
                });
              }}
            >
              <span
                className="we-agent-history-sidebar__action-icon"
                style={{ WebkitMaskImage: `url(${deleteIcon})`, maskImage: `url(${deleteIcon})` }}
                aria-hidden="true"
              />
              <span className="we-agent-history-sidebar__action-text">{t('weAgent.deleteSession')}</span>
            </button>
          </div>,
          document.body,
        )
        : null}
      <ResponsiveConfirmModal
        open={!!confirmDeleteSession}
        title={t('weAgent.confirmDeleteSessionTitle')}
        description={t('weAgent.confirmDeleteSessionDescription')}
        cancelText={t('common.cancel')}
        confirmText={t('weAgent.deleteSession')}
        confirmBackgroundColor="#f36f64"
        mobileConfirmTextColor="#f36f64"
        confirmDisabled={isDeletingSession}
        onClose={handleCancelDelete}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </>
  );
};

export default WeAgentHistorySidebar;
