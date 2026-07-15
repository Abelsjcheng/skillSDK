import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPcMiniApp } from './constants';
import { Content } from './components/Content';
import WeAgentCUIFooter from './components/assistant/WeAgentCUIFooter';
import WeAgentHistorySidebar from './components/assistant/WeAgentHistorySidebar';
import { resolveAssistantIconUrl } from './components/createAssistant/constants';
import { useChatSession } from './hooks/useChatSession';
import { useIosKeyboardLift } from './hooks/useIosKeyboardLift';
import createSessionIcon from './imgs/createSession.svg';
import './styles/App.less';
import './styles/WeAgentCUI.less';
import type {
  HistorySessionsListResult,
  SkillSession,
  WeAgentDetails,
  WeAgentUpdatedEventPayload,
} from './types/bridge';
import type { HWH5UserInfo } from './types/bridge/hwext';
import type { AppProps, HarmonySplitLayoutState, HistorySessionsCache } from './types/components';
import { buildCorpUserAvatar } from './utils/avatar';
import { runButtonClickWithDebounce } from './utils/buttonDebounce';
import {
  createNewSession,
  getDeviceInfo,
  getHistorySessionsList,
  getUserInfo,
  getWeAgentDetails,
  registerEventListener,
} from './utils/hwext';
import { WeLog } from './utils/logger';
import {
  ensureSessionTimestamps,
  getLatestAvailableSessionByUpdatedAt,
  getSessionUpdatedAtTimestamp,
  HISTORY_SESSIONS_PAGE_SIZE,
} from './utils/session';
import {
  removeSessionFromHistoryCache,
  resolveNextSessionAfterDelete,
} from './utils/sessionDelete';
import { installBrowserJsErrorTelemetry } from './utils/telemetry';
import { showToast } from './utils/toast';
import { reportCreateSessionClick } from './utils/uemUtil';
import { canIUse } from './utils/versionCheck';

function sortSessionsByUpdatedAt(sessions: SkillSession[]): SkillSession[] {
  return [...sessions].sort(
    (left, right) => getSessionUpdatedAtTimestamp(right) - getSessionUpdatedAtTimestamp(left),
  );
}

function createHistorySessionsCache(result: HistorySessionsListResult): HistorySessionsCache {
  // 接口 content 表示单页结果；进入 App 状态后表示当前已缓存、可渲染的历史列表。
  return {
    content: Array.isArray(result.content) ? result.content.map((session) => ensureSessionTimestamps(session)) : [],
    page: typeof result.page === 'number' ? result.page : 0,
    size: typeof result.size === 'number' ? result.size : HISTORY_SESSIONS_PAGE_SIZE,
    total: typeof result.total === 'number' ? result.total : 0,
    totalPages: typeof result.totalPages === 'number' ? result.totalPages : 0,
  };
}

function prependSessionToCache(
  cache: HistorySessionsCache | null,
  session: SkillSession,
): HistorySessionsCache | null {
  if (!cache) {
    return cache;
  }

  // 新建会话需要立即进入侧边栏缓存，并通过去重避免重复显示同一个会话。
  const nextSession = ensureSessionTimestamps(session);
  const hasExistingSession = cache.content.some((item) => item.welinkSessionId === nextSession.welinkSessionId);
  const nextContent = [
    nextSession,
    ...cache.content.filter((item) => item.welinkSessionId !== nextSession.welinkSessionId),
  ];
  const nextTotal = Math.max(cache.total + (hasExistingSession ? 0 : 1), nextContent.length);
  const nextTotalPages = Math.max(
    cache.totalPages,
    Math.ceil(nextTotal / Math.max(cache.size || HISTORY_SESSIONS_PAGE_SIZE, 1)),
  );

  return {
    ...cache,
    content: sortSessionsByUpdatedAt(nextContent),
    total: nextTotal,
    totalPages: nextTotalPages,
  };
}

function updateSessionTitleInCache(
  cache: HistorySessionsCache | null,
  sessionId: string,
  title: string,
): HistorySessionsCache | null {
  if (!cache || !sessionId || !title) {
    return cache;
  }

  let changed = false;
  const nextContent = cache.content.map((session) => {
    if (session.welinkSessionId !== sessionId || session.title === title) {
      return session;
    }
    changed = true;
    return { ...session, title };
  });

  return changed ? { ...cache, content: nextContent } : cache;
}

function updateSessionActivityInCache(
  cache: HistorySessionsCache | null,
  sessionId: string,
  updatedAt: string,
): HistorySessionsCache | null {
  if (!cache || !sessionId || !updatedAt) {
    return cache;
  }

  // 用户在历史会话里发消息成功后，前端先更新 updatedAt，让侧边栏排序即时反馈。
  let changed = false;
  const nextContent = cache.content.map((session) => {
    if (session.welinkSessionId !== sessionId) {
      return session;
    }
    if (session.updatedAt === updatedAt) {
      return session;
    }
    changed = true;
    return { ...session, updatedAt };
  });

  return changed ? { ...cache, content: sortSessionsByUpdatedAt(nextContent) } : cache;
}

const DEFAULT_HARMONY_SPLIT_LAYOUT: HarmonySplitLayoutState = {
  enabled: false,
  statusBarHeight: 0,
  safeAreaInsetBottom: 0,
};

function App({ assistantAccount = '' }: AppProps) {
  const isPc = isPcMiniApp();
  const { keyboardContainerStyle } = useIosKeyboardLift({ viewportOffset: 49 });
  const { t, i18n } = useTranslation();
  const shouldUseEnglishUserName = (i18n.resolvedLanguage ?? i18n.language) === 'en';

  // PC 端进入助手页即默认展示历史侧边栏，移动端仍保持点击后展示。
  const [isHistorySidebarVisible, setIsHistorySidebarVisible] = useState(isPc);
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [historySessionsCache, setHistorySessionsCache] = useState<HistorySessionsCache | null>(null);
  const [historySessionsLoaded, setHistorySessionsLoaded] = useState(false);
  const [weAgentUserName, setWeAgentUserName] = useState('');
  const [weAgentUserAvatar, setWeAgentUserAvatar] = useState('');
  const [weAgentAssistantName, setWeAgentAssistantName] = useState('');
  const [weAgentAssistantDescription, setWeAgentAssistantDescription] = useState('');
  const [weAgentAssistantAvatar, setWeAgentAssistantAvatar] = useState('');
  const [isSwitchingSessionAfterDelete, setIsSwitchingSessionAfterDelete] = useState(false);
  const [harmonySplitLayout, setHarmonySplitLayout] = useState<HarmonySplitLayoutState>(DEFAULT_HARMONY_SPLIT_LAYOUT);

  const assistantAccountRef = useRef(assistantAccount);
  const historySessionsCacheRef = useRef<HistorySessionsCache | null>(null);
  const welinkSessionIdRef = useRef<string | null>(null);
  const assistantDetailRef = useRef<WeAgentDetails | null>(null);
  const userInfoRef = useRef<HWH5UserInfo | null>(null);
  const initSessionFailedTextRef = useRef(t('weAgent.initSessionFailed'));
  const pendingActionDeleteSessionIdsRef = useRef<Set<string>>(new Set());

  initSessionFailedTextRef.current = t('weAgent.initSessionFailed');

  const session = useChatSession({
    mode: 'weAgentCUI',
    welinkSessionId: welinkSessionId ?? '',
    assistantDetail: assistantDetailRef.current,
    onSessionTitleChange: (sessionId, title) => {
      setHistorySessionsCache((prev) => updateSessionTitleInCache(prev, sessionId, title));
    },
    onSessionActivity: (sessionId, updatedAt) => {
      setHistorySessionsCache((prev) => updateSessionActivityInCache(prev, sessionId, updatedAt));
    },
    onSessionDeleted: (sessionId) => {
      void handleSessionDeletedFromPushRef.current?.(sessionId);
    },
  });

  const handleSessionDeletedFromPushRef = useRef<((sessionId: string) => Promise<void>) | null>(null);

  useEffect(() => installBrowserJsErrorTelemetry(() => ({
    page: 'weAgentCUI',
    assistantAccount: assistantAccountRef.current,
    welinkSessionId: welinkSessionId ?? undefined,
  })), [welinkSessionId]);

  useEffect(() => {
    historySessionsCacheRef.current = historySessionsCache;
  }, [historySessionsCache]);

  useEffect(() => {
    welinkSessionIdRef.current = welinkSessionId;
  }, [welinkSessionId]);

  useEffect(() => {
    if (isPc) {
      setHarmonySplitLayout(DEFAULT_HARMONY_SPLIT_LAYOUT);
      return;
    }

    let disposed = false;

    const resolveHarmonySplitLayout = async () => {
      try {
        const deviceInfo = await getDeviceInfo();
        if (disposed) {
          return;
        }

        const isHarmonySplit = deviceInfo.osType === 'Harmony' && deviceInfo.isFullScreen === 0;
        const isHarmonySplitLayoutSupported = isHarmonySplit && await canIUse.harmonySplitLayout();
        if (disposed) {
          return;
        }

        setHarmonySplitLayout(isHarmonySplit && isHarmonySplitLayoutSupported
          ? {
            enabled: true,
            statusBarHeight: deviceInfo.statusBarHeight,
            safeAreaInsetBottom: deviceInfo.safeAreaInsetBottom,
          }
          : DEFAULT_HARMONY_SPLIT_LAYOUT);
      } catch (err) {
        WeLog(`App getDeviceInfo failed | error=${JSON.stringify(err)}`);
        if (!disposed) {
          setHarmonySplitLayout(DEFAULT_HARMONY_SPLIT_LAYOUT);
        }
      }
    };

    void resolveHarmonySplitLayout();

    return () => {
      disposed = true;
    };
  }, [isPc]);

  const updateWeAgentUserName = useCallback((userInfo: HWH5UserInfo) => {
    setWeAgentUserName(shouldUseEnglishUserName ? userInfo.userNameEN : userInfo.userNameZH);
  }, [shouldUseEnglishUserName]);

  const resolveAssistantDetail = useCallback(async (currentAssistantAccount: string) => {
    const detailsResult = await getWeAgentDetails({ partnerAccount: currentAssistantAccount });
    const detail = detailsResult.weAgentDetailsArray?.[0];
    if (!detail) {
      throw new Error('missing assistant detail');
    }

    setWeAgentAssistantName(detail.name ?? '');
    setWeAgentAssistantDescription(detail.desc ?? '');
    setWeAgentAssistantAvatar(resolveAssistantIconUrl(detail.icon));
    assistantDetailRef.current = detail;
    return detail;
  }, []);

  const handleWeAgentUpdated = useCallback((payload: WeAgentUpdatedEventPayload) => {
    if (payload?.type !== 'update' && payload?.type !== 'offline_notify') {
      WeLog(`handleWeAgentUpdated type failed type=${payload?.type}`)
      return;
    }
    if (payload.type === 'offline_notify') {
      if (!payload.data || !Array.isArray(payload.data) || payload.data.length === 0) {
        return;
      }

      const currentAssistantAccount = assistantAccountRef.current.trim();
      const matchedEvent = payload.data.find((event) => 
        event.type === 'update' &&
      event.data?.partnerAccount?.trim() === currentAssistantAccount
      ) as Extract<WeAgentUpdatedEventPayload, { type: 'update'}> | undefined;
      if (!matchedEvent) {
        return;
      }

      WeLog(`handleWeAgentUpdated offline_notify matched assistant: ${matchedEvent.data.partnerAccount}`, 'info');

      // 复用现有更新逻辑
      const updatedDetail = matchedEvent.data;
      const currentDetail = assistantDetailRef.current;
          const nextDetail = {
      ...currentDetail,
      ...updatedDetail,
      desc: updatedDetail.desc ?? updatedDetail.description ?? currentDetail?.desc ?? '',
    } as WeAgentDetails;
        assistantDetailRef.current = nextDetail;
    setWeAgentAssistantName(updatedDetail.name ?? currentDetail?.name ?? '');
    setWeAgentAssistantDescription(
      updatedDetail.desc ?? updatedDetail.description ?? currentDetail?.desc ?? '',
    );
    setWeAgentAssistantAvatar(
      resolveAssistantIconUrl(updatedDetail.icon ?? currentDetail?.icon ?? ''),
    );
    return

    }
    const updatedDetail = payload.data;
    const currentAssistantAccount = assistantAccountRef.current.trim();
    const updatedPartnerAccount = updatedDetail?.partnerAccount?.trim();
    if (!updatedDetail || !currentAssistantAccount || updatedPartnerAccount !== currentAssistantAccount) {
      return;
    }

    const currentDetail = assistantDetailRef.current;
    const nextDetail = {
      ...currentDetail,
      ...updatedDetail,
      desc: updatedDetail.desc ?? updatedDetail.description ?? currentDetail?.desc ?? '',
    } as WeAgentDetails;

    assistantDetailRef.current = nextDetail;
    setWeAgentAssistantName(updatedDetail.name ?? currentDetail?.name ?? '');
    setWeAgentAssistantDescription(
      updatedDetail.desc ?? updatedDetail.description ?? currentDetail?.desc ?? '',
    );
    setWeAgentAssistantAvatar(
      resolveAssistantIconUrl(updatedDetail.icon ?? currentDetail?.icon ?? ''),
    );
  }, []);

  useEffect(() => {
    void registerEventListener({
      type: 'agentskills_agentUpdated',
      func: handleWeAgentUpdated,
    }).catch((error) => {
      WeLog(`App registerEventListener failed | extra=${JSON.stringify({
        type: 'agentskills_agentUpdated',
      })} | error=${JSON.stringify(error)}`);
    });
  }, [handleWeAgentUpdated]);

  const createSessionForAssistant = useCallback(async (
    currentAssistantAccount: string,
    appKey: string,
  ) => {
    const userInfo = await getUserInfo();
    return createNewSession({
      ak: appKey,
      businessSessionDomain: 'miniapp',
      businessSessionType: 'direct',
      assistantAccount: currentAssistantAccount,
      businessSessionId: userInfo.uid,
    });
  }, []);

  useEffect(() => {
    assistantAccountRef.current = assistantAccount;
    assistantDetailRef.current = null;
    userInfoRef.current = null;
    pendingActionDeleteSessionIdsRef.current.clear();
    setHistorySessionsCache(null);
    setHistorySessionsLoaded(false);
    setIsHistorySidebarVisible(isPc);
    setWelinkSessionId(null);
    setWeAgentAssistantName('');
    setWeAgentAssistantDescription('');
    setWeAgentAssistantAvatar('');
  }, [assistantAccount, isPc]);

  useEffect(() => {
    const userInfo = userInfoRef.current;
    if (!userInfo) {
      return;
    }
    updateWeAgentUserName(userInfo);
  }, [updateWeAgentUserName]);

  useEffect(() => {
    const currentAssistantAccount = assistantAccountRef.current;
    if (!currentAssistantAccount) {
      WeLog('App missing assistantAccount');
      return;
    }

    let disposed = false;

    const initializeWeAgentSession = async () => {
      try {
        const userInfo = await getUserInfo();
        userInfoRef.current = userInfo;
        if (!disposed) {
          updateWeAgentUserName(userInfo);
          setWeAgentUserAvatar(buildCorpUserAvatar(userInfo.corpUserId));
        }

        const detail = await resolveAssistantDetail(currentAssistantAccount);
        const historyResult = await getHistorySessionsList({
          assistantAccount: currentAssistantAccount,
          businessSessionDomain: 'miniapp',
          page: 0,
          size: HISTORY_SESSIONS_PAGE_SIZE,
        });
        let nextHistoryCache = createHistorySessionsCache(historyResult);
        const latestAvailableSession = getLatestAvailableSessionByUpdatedAt(nextHistoryCache.content);
        const nextSession = latestAvailableSession
          ?? ensureSessionTimestamps(await createSessionForAssistant(currentAssistantAccount, detail.appKey));
        if (!latestAvailableSession) {
          // 当前助手没有历史会话时，兜底创建的新会话也要同步进入默认展开的侧边栏。
          nextHistoryCache = prependSessionToCache(nextHistoryCache, nextSession) ?? nextHistoryCache;
        }

        if (disposed) {
          return;
        }

        setHistorySessionsCache(nextHistoryCache);
        setHistorySessionsLoaded(true);
        setWelinkSessionId(nextSession.welinkSessionId);
      } catch (err) {
        WeLog(`App initializeWeAgentSession failed | extra=${JSON.stringify({ assistantAccount: currentAssistantAccount })} | error=${JSON.stringify(err)}`);
        if (!disposed) {
          showToast(initSessionFailedTextRef.current);
        }
      }
    };

    void initializeWeAgentSession();

    return () => {
      disposed = true;
    };
  }, [assistantAccount, createSessionForAssistant, resolveAssistantDetail, updateWeAgentUserName]);

  const handleCreateSession = useCallback(async () => {
    const currentAssistantAccount = assistantAccountRef.current;
    if (!currentAssistantAccount) {
      return;
    }

    if (session.messages.length === 0) {
      showToast(t('weAgent.newestSession'));
      return;
    }

    let detail = assistantDetailRef.current;
    try {
      if (!detail || detail.partnerAccount !== currentAssistantAccount) {
        detail = await resolveAssistantDetail(currentAssistantAccount);
      }

      const newSession = ensureSessionTimestamps(
        await createSessionForAssistant(currentAssistantAccount, detail.appKey),
      );
      session.resetTransientState();
      setWelinkSessionId(newSession.welinkSessionId);
      // 主动新建会话成功后，侧边栏缓存同步插入并选中新会话。
      setHistorySessionsCache((prev) => prependSessionToCache(prev, newSession));
      reportCreateSessionClick(detail);
    } catch (err: any) {
      WeLog(`App createNewSession failed | extra=${JSON.stringify({ assistantAccount: currentAssistantAccount })} | error=${JSON.stringify(err)}`);
      showToast(t('weAgent.createSessionFailed'));
      reportCreateSessionClick(detail, err);
    }
  }, [createSessionForAssistant, resolveAssistantDetail, session.messages.length, t]);

  const handleSwitchWeAgentSession = useCallback((nextWelinkSessionId: string) => {
    const normalizedSessionId = nextWelinkSessionId.trim();
    if (!normalizedSessionId || normalizedSessionId === welinkSessionId) {
      return;
    }
    session.resetTransientState();
    setWelinkSessionId(normalizedSessionId);
  }, [session, welinkSessionId]);

  const harmonySplitStyle = harmonySplitLayout.enabled
    ? {
      '--we-agent-cui-title-bar-height': '44px',
      ...(harmonySplitLayout.statusBarHeight > 0
        ? { '--we-agent-cui-status-bar-height': `${harmonySplitLayout.statusBarHeight}px` }
        : {}),
      ...(harmonySplitLayout.safeAreaInsetBottom > 0
        ? { '--we-agent-cui-safe-area-bottom': `${harmonySplitLayout.safeAreaInsetBottom}px` }
        : {}),
    } as React.CSSProperties
    : {};

  const refreshHistorySessionsFirstPage = useCallback(async (): Promise<HistorySessionsCache | null> => {
    const currentAssistantAccount = assistantAccountRef.current;
    if (!currentAssistantAccount) {
      return null;
    }

    const historyResult = await getHistorySessionsList({
      assistantAccount: currentAssistantAccount,
      businessSessionDomain: 'miniapp',
      page: 0,
      size: HISTORY_SESSIONS_PAGE_SIZE,
    });
    const nextCache = createHistorySessionsCache(historyResult);
    setHistorySessionsCache(nextCache);
    setHistorySessionsLoaded(true);
    return nextCache;
  }, []);

  const createAndSelectFallbackSession = useCallback(async () => {
    const currentAssistantAccount = assistantAccountRef.current;
    if (!currentAssistantAccount) {
      return;
    }

    let detail = assistantDetailRef.current;
    if (!detail || detail.partnerAccount !== currentAssistantAccount) {
      detail = await resolveAssistantDetail(currentAssistantAccount);
    }

    const newSession = ensureSessionTimestamps(
      await createSessionForAssistant(currentAssistantAccount, detail.appKey),
    );
    setHistorySessionsCache((prev) => prependSessionToCache(prev, newSession));
    setWelinkSessionId(newSession.welinkSessionId);
  }, [createSessionForAssistant, resolveAssistantDetail]);

  const handleSessionDeleted = useCallback(async (
    deletedSessionId: string,
    refreshAfterDelete: boolean,
    shouldCreateFallback: boolean,
  ) => {
    const normalizedDeletedSessionId = deletedSessionId.trim();
    if (!normalizedDeletedSessionId) {
      return;
    }

    const previousCache = historySessionsCacheRef.current;
    const isDeletingCurrentSession = welinkSessionIdRef.current === normalizedDeletedSessionId;
    const nextSession = previousCache
      ? resolveNextSessionAfterDelete(previousCache.content, normalizedDeletedSessionId)
      : null;

    setHistorySessionsCache((prev) => removeSessionFromHistoryCache(prev, normalizedDeletedSessionId));

    if (isDeletingCurrentSession) {
      setIsSwitchingSessionAfterDelete(true);
      session.resetTransientState();
      if (nextSession) {
        setWelinkSessionId(nextSession.welinkSessionId);
        setIsSwitchingSessionAfterDelete(false);
      } else if (!shouldCreateFallback) {
        setWelinkSessionId(null);
        setIsSwitchingSessionAfterDelete(false);
      } else {
        try {
          await createAndSelectFallbackSession();
        } catch (error) {
          WeLog(`App create fallback session after delete failed | extra=${JSON.stringify({ welinkSessionId: normalizedDeletedSessionId })} | error=${JSON.stringify(error)}`);
          showToast(t('weAgent.createSessionFailed'));
        } finally {
          setIsSwitchingSessionAfterDelete(false);
        }
      }
    }

    if (refreshAfterDelete) {
      try {
        const refreshedCache = await refreshHistorySessionsFirstPage();
        const refreshedCacheWithoutDeletedSession = removeSessionFromHistoryCache(
          refreshedCache,
          normalizedDeletedSessionId,
        );
        setHistorySessionsCache(refreshedCacheWithoutDeletedSession);
        if (isDeletingCurrentSession && !shouldCreateFallback) {
          const refreshedNextSession = refreshedCacheWithoutDeletedSession
            ? getLatestAvailableSessionByUpdatedAt(refreshedCacheWithoutDeletedSession.content)
            : null;
          if (refreshedNextSession) {
            setWelinkSessionId(refreshedNextSession.welinkSessionId);
          }
        }
      } catch (error) {
        WeLog(`App refresh history after session.deleted failed | extra=${JSON.stringify({ welinkSessionId: normalizedDeletedSessionId })} | error=${JSON.stringify(error)}`);
      }
    }
  }, [createAndSelectFallbackSession, refreshHistorySessionsFirstPage, session, t]);

  const handleSessionDeleteStart = useCallback((deletedSessionId: string) => {
    const normalizedDeletedSessionId = deletedSessionId.trim();
    if (normalizedDeletedSessionId) {
      pendingActionDeleteSessionIdsRef.current.add(normalizedDeletedSessionId);
    }
  }, []);

  const handleSessionDeleteFailed = useCallback((deletedSessionId: string) => {
    const normalizedDeletedSessionId = deletedSessionId.trim();
    if (normalizedDeletedSessionId) {
      pendingActionDeleteSessionIdsRef.current.delete(normalizedDeletedSessionId);
    }
  }, []);

  const handleSessionDeletedFromAction = useCallback(async (deletedSessionId: string) => {
    const normalizedDeletedSessionId = deletedSessionId.trim();
    try {
      await handleSessionDeleted(deletedSessionId, false, true);
    } finally {
      if (normalizedDeletedSessionId) {
        pendingActionDeleteSessionIdsRef.current.delete(normalizedDeletedSessionId);
      }
    }
  }, [handleSessionDeleted]);

  const handleSessionDeletedFromPush = useCallback(async (deletedSessionId: string) => {
    const normalizedDeletedSessionId = deletedSessionId.trim();
    if (normalizedDeletedSessionId && pendingActionDeleteSessionIdsRef.current.has(normalizedDeletedSessionId)) {
      return;
    }
    await handleSessionDeleted(deletedSessionId, true, false);
  }, [handleSessionDeleted]);

  useEffect(() => {
    handleSessionDeletedFromPushRef.current = handleSessionDeletedFromPush;
  }, [handleSessionDeletedFromPush]);

  return (
    <div
      className={[
        'app-container',
        isPc ? 'pc-mode' : '',
        'app-container--we-agent-cui',
        harmonySplitLayout.enabled ? 'is-harmony-split' : '',
        isPc && isHistorySidebarVisible ? 'has-history-sidebar' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ...keyboardContainerStyle,
        ...harmonySplitStyle,
      }}
    >
      <div className="we-agent-cui-main">
        <div className="we-agent-cui-chat-panel">
          {harmonySplitLayout.enabled ? (
            <div className="we-agent-cui-titlebar" role="heading" aria-level={1}>
              <div className="we-agent-cui-titlebar__title">{weAgentAssistantName}</div>
            </div>
          ) : null}

          <div className="content-wrapper">
            <Content
              messages={session.messages}
              pendingAssistantPreview={session.pendingAssistantPreview}
              welinkSessionId={session.welinkSessionId}
              showMessageActions
              scrollToBottomSignal={session.scrollToBottomSignal}
              isLoadingHistory={session.isLoadingHistory}
              hasMoreHistory={session.hasMoreHistory}
              onLoadMoreHistory={session.onLoadMoreHistory}
              onQuestionAnswered={session.onQuestionAnswered}
              onCopy={session.onCopy}
              weAgentUserName={weAgentUserName}
              weAgentUserAvatar={weAgentUserAvatar}
              weAgentAssistantName={weAgentAssistantName}
              weAgentAssistantDescription={weAgentAssistantDescription}
              weAgentAssistantAvatar={weAgentAssistantAvatar}
            />
          </div>

          <div className="we-agent-cui-bottom">
            <div className="we-agent-cui-actions" aria-label={t('weAgent.multiActionArea')}>
              <button
                type="button"
                className="we-agent-cui-actions__button"
                data-tooltip={isPc ? t('weAgent.newSessionToolTip') : undefined}
                onClick={(event) => {
                  runButtonClickWithDebounce(event, () => {
                    void handleCreateSession();
                  });
                }}
                aria-label={t('weAgent.newSession')}
              >
                <img
                  className="we-agent-cui-actions__icon"
                  src={createSessionIcon}
                  alt=""
                  draggable="false"
                />
              </button>
              <WeAgentHistorySidebar
                assistantAccount={assistantAccount}
                currentWelinkSessionId={welinkSessionId ?? ''}
                cachedCache={historySessionsCache}
                defaultOpen={isPc}
                historyLoaded={historySessionsLoaded}
                onHistoryLoaded={(cache) => {
                  setHistorySessionsCache(cache);
                  setHistorySessionsLoaded(true);
                }}
                onSessionSelect={handleSwitchWeAgentSession}
                onSessionDeleteStart={handleSessionDeleteStart}
                onSessionDeleteFailed={handleSessionDeleteFailed}
                onSessionDeleted={handleSessionDeletedFromAction}
                onVisibilityChange={setIsHistorySidebarVisible}
              />
            </div>

            <div className="footer-wrapper">
              <WeAgentCUIFooter
                isPcMiniApp={isPc}
                mode={session.isGenerating ? 'generating' : 'generate'}
                partnerAccount={assistantAccount}
                slashCommands={session.slashCommands}
                onRequestSlashCommands={session.onRequestSlashCommands}
                onSend={(content) => {
                  if (isSwitchingSessionAfterDelete) {
                    return;
                  }
                  void session.onSend(content);
                }}
                onStop={() => {
                  if (isSwitchingSessionAfterDelete) {
                    return;
                  }
                  void session.onStop();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
