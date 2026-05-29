import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isIosMobileDevice, isPcMiniApp } from './constants';
import { Content } from './components/Content';
import WeAgentCUIFooter from './components/assistant/WeAgentCUIFooter';
import WeAgentHistorySidebar from './components/assistant/WeAgentHistorySidebar';
import { resolveAssistantIconUrl } from './components/createAssistant/constants';
import { useChatSession } from './hooks/useChatSession';
import createSessionIcon from './imgs/createSession.svg';
import './styles/App.less';
import './styles/WeAgentCUI.less';
import type { SkillSession, WeAgentDetails } from './types/bridge';
import type { HWH5UserInfo } from './types/bridge/hwext';
import type { AppProps } from './types/components';
import { buildCorpUserAvatar } from './utils/avatar';
import { runButtonClickWithDebounce } from './utils/buttonDebounce';
import {
  createNewSession,
  getDeviceInfo,
  getHistorySessionsList,
  getUserInfo,
  getWeAgentDetails,
} from './utils/hwext';
import { WeLog } from './utils/logger';
import { ensureSessionTimestamps, getLatestAvailableSessionByUpdatedAt } from './utils/session';
import { installBrowserJsErrorTelemetry } from './utils/telemetry';
import { showToast } from './utils/toast';
import { reportCreateSessionClick } from './utils/uemUtil';

function updateSessionTitleInCache(
  sessions: SkillSession[] | null,
  sessionId: string,
  title: string,
): SkillSession[] | null {
  if (!sessions || !sessionId || !title) {
    return sessions;
  }

  let changed = false;
  const nextSessions = sessions.map((session) => {
    if (session.welinkSessionId !== sessionId || session.title === title) {
      return session;
    }
    changed = true;
    return { ...session, title };
  });

  return changed ? nextSessions : sessions;
}

function App({ assistantAccount = '' }: AppProps) {
  const isPc = isPcMiniApp();
  const isIosKeyboardLiftEnabled = isIosMobileDevice();
  const { t, i18n } = useTranslation();
  const shouldUseEnglishUserName = (i18n.resolvedLanguage ?? i18n.language) === 'en';

  const [isHistorySidebarVisible, setIsHistorySidebarVisible] = useState(false);
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [historySessionsCache, setHistorySessionsCache] = useState<SkillSession[] | null>(null);
  const [historySessionsLoaded, setHistorySessionsLoaded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [weAgentUserName, setWeAgentUserName] = useState('');
  const [weAgentUserAvatar, setWeAgentUserAvatar] = useState('');
  const [weAgentAssistantName, setWeAgentAssistantName] = useState('');
  const [weAgentAssistantDescription, setWeAgentAssistantDescription] = useState('');
  const [weAgentAssistantAvatar, setWeAgentAssistantAvatar] = useState('');

  const assistantAccountRef = useRef(assistantAccount);
  const assistantDetailRef = useRef<WeAgentDetails | null>(null);
  const userInfoRef = useRef<HWH5UserInfo | null>(null);
  const initSessionFailedTextRef = useRef(t('weAgent.initSessionFailed'));

  initSessionFailedTextRef.current = t('weAgent.initSessionFailed');

  const session = useChatSession({
    mode: 'weAgentCUI',
    welinkSessionId: welinkSessionId ?? '',
    onSessionTitleChange: (sessionId, title) => {
      setHistorySessionsCache((prev) => updateSessionTitleInCache(prev, sessionId, title));
    },
  });

  useEffect(() => {
    if (!isIosKeyboardLiftEnabled) {
      setKeyboardHeight(0);
      window.HWH5?.offKeyboardHeightChange?.();
      return;
    }

    if (typeof window === 'undefined' || typeof window.HWH5?.onKeyboardHeightChange !== 'function') {
      return;
    }

    let safeAreaInsetBottom = 0;
    const handleKeyboardHeightChange = (res: { height: number }) => {
      let nextHeight = typeof res?.height === 'number' && Number.isFinite(res.height) ? res.height : 0;
      nextHeight = nextHeight - 49 - safeAreaInsetBottom / window.devicePixelRatio;
      setKeyboardHeight(nextHeight > 0 ? nextHeight : 0);
    };

    const setupKeyboardHeightListener = async () => {
      try {
        await window.HWH5?.disableAutoPushUpPage?.({ status: true });
        const deviceInfo = await getDeviceInfo();
        safeAreaInsetBottom = deviceInfo.safeAreaInsetBottom;
      } catch (error) {
        WeLog(`App setupKeyboardHeightListener failed | error=${JSON.stringify(error)}`);
      }

      window.HWH5.onKeyboardHeightChange?.(handleKeyboardHeightChange);
    };

    void setupKeyboardHeightListener();

    return () => {
      window.HWH5?.offKeyboardHeightChange?.();
      setKeyboardHeight(0);
    };
  }, [isIosKeyboardLiftEnabled]);

  useEffect(() => installBrowserJsErrorTelemetry(() => ({
    page: 'weAgentCUI',
    assistantAccount: assistantAccountRef.current,
    welinkSessionId: welinkSessionId ?? undefined,
  })), [welinkSessionId]);

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
    setHistorySessionsCache(null);
    setHistorySessionsLoaded(false);
    setWelinkSessionId(null);
    setWeAgentAssistantName('');
    setWeAgentAssistantDescription('');
    setWeAgentAssistantAvatar('');
  }, [assistantAccount]);

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
        });
        const latestAvailableSession = getLatestAvailableSessionByUpdatedAt(historyResult.content ?? []);
        const nextSession = latestAvailableSession
          ?? await createSessionForAssistant(currentAssistantAccount, detail.appKey);

        if (disposed) {
          return;
        }

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
      setHistorySessionsCache((prev) => {
        if (prev === null) {
          return prev;
        }
        const next = prev.filter((item) => item.welinkSessionId !== newSession.welinkSessionId);
        return [newSession, ...next];
      });
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

  return (
    <div
      className={[
        'app-container',
        isPc ? 'pc-mode' : '',
        'app-container--we-agent-cui',
        isPc && isHistorySidebarVisible ? 'has-history-sidebar' : '',
      ].filter(Boolean).join(' ')}
      style={isIosKeyboardLiftEnabled && keyboardHeight > 0
        ? { height: `calc(100vh - ${keyboardHeight}px)` }
        : undefined}
    >
      <div className="we-agent-cui-main">
        <div className="we-agent-cui-chat-panel">
          <div className="content-wrapper">
            <Content
              messages={session.messages}
              pendingAssistantPreview={session.pendingAssistantPreview}
              welinkSessionId={session.welinkSessionId}
              scrollToBottomSignal={session.scrollToBottomSignal}
              isLoadingHistory={session.isLoadingHistory}
              hasMoreHistory={session.hasMoreHistory}
              onLoadMoreHistory={session.onLoadMoreHistory}
              onQuestionAnswered={session.onQuestionAnswered}
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
              {session.isGenerating ? (
                <div className="we-agent-cui-actions__status" aria-live="polite">
                  {t('weAgent.outputting')}
                </div>
              ) : null}
              <WeAgentHistorySidebar
                assistantAccount={assistantAccount}
                currentWelinkSessionId={welinkSessionId ?? ''}
                cachedSessions={historySessionsCache ?? []}
                historyLoaded={historySessionsLoaded}
                onHistoryLoaded={(sessions) => {
                  setHistorySessionsCache(sessions);
                  setHistorySessionsLoaded(true);
                }}
                onSessionSelect={handleSwitchWeAgentSession}
                onVisibilityChange={setIsHistorySidebarVisible}
              />
            </div>

            <div className="footer-wrapper">
              <WeAgentCUIFooter
                isPcMiniApp={isPc}
                mode={session.isGenerating ? 'generating' : 'generate'}
                onSend={(content) => {
                  void session.onSend(content);
                }}
                onStop={() => {
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
