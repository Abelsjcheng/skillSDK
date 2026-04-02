import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Content } from './components/Content';
import WeAgentCUIFooter from './components/assistant/WeAgentCUIFooter';
import WeAgentHistorySidebar from './components/assistant/WeAgentHistorySidebar';
import { resolveAssistantIconUrl } from './components/createAssistant/constants';
import { StreamAssembler } from './protocol/StreamAssembler';
import type {
  GetSessionMessageHistoryResponse,
  Message,
  MessagePart,
  SendMessageResponse,
  SessionStatus,
  StreamMessage,
} from './types';
import {
  createNewSession,
  getHistorySessionsList,
  getSessionMessageHistory,
  getUserInfo,
  getWeAgentDetails,
  isPcMiniApp,
  registerSessionListener,
  sendMessage as sendMessageApi,
  stopSkill,
  unregisterSessionListener,
  type SkillSession,
  type WeAgentDetails,
} from './utils/hwext';
import {
  genMessageId,
  getLatestUserContent,
  mapRawParts,
  messageOperationToMessage,
  normalizeRole,
  sessionMessageToMessage,
  snapshotMessageToMessage,
} from './utils/message';
import { runButtonClickWithDebounce } from './utils/buttonDebounce';
import { showToast } from './utils/toast';
import iconWeAgentNewSession from './imgs/icon-we-agent-new-session.svg';
import './styles/App.less';
import './styles/WeAgentCUI.less';

export interface AppProps {
  assistantAccount?: string;
}

export type AppVariant = 'weAgentCUI';

const HISTORY_PAGE_SIZE = 20;

function buildCorpUserAvatar(corpUserId: string): string {
  const normalizedCorpUserId = corpUserId.trim();
  return normalizedCorpUserId ? `https://${normalizedCorpUserId}` : '';
}

function hasMoreHistoryByCursor(result: GetSessionMessageHistoryResponse): boolean {
  return result.hasMore;
}

function isSessionClosed(status: string | null | undefined): boolean {
  const normalizedStatus = (status ?? '').trim().toLowerCase();
  return normalizedStatus === 'close' || normalizedStatus === 'closed';
}

function getSessionUpdatedAtTimestamp(session: SkillSession): number {
  const timestamp = new Date(session.updatedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLatestAvailableSessionByUpdatedAt(sessions: SkillSession[]): SkillSession | null {
  const availableSessions = sessions.filter((session) => !isSessionClosed(session.status));
  if (availableSessions.length === 0) {
    return null;
  }
  return [...availableSessions].sort(
    (left, right) => getSessionUpdatedAtTimestamp(right) - getSessionUpdatedAtTimestamp(left),
  )[0] ?? null;
}

function App({ assistantAccount = '' }: AppProps) {
  const isPc = isPcMiniApp();
  const [isHistorySidebarVisible, setIsHistorySidebarVisible] = useState(false);
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = useState<'generate' | 'generating' | 'regenerate'>('generate');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [weAgentUserName, setWeAgentUserName] = useState('');
  const [weAgentUserAvatar, setWeAgentUserAvatar] = useState('');
  const [weAgentAssistantName, setWeAgentAssistantName] = useState('');
  const [weAgentAssistantDescription, setWeAgentAssistantDescription] = useState('');
  const [weAgentAssistantAvatar, setWeAgentAssistantAvatar] = useState('');

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const assistantAccountRef = useRef(assistantAccount.trim());
  const assistantDetailRef = useRef<WeAgentDetails | null>(null);
  const shouldResetFooterOnCompletionRef = useRef(false);
  const suppressFooterAutoResetRef = useRef(false);
  const latestUserContentRef = useRef('');
  const nextBeforeSeqRef = useRef<number | null>(null);
  const hasMoreHistoryRef = useRef(false);
  const isLoadingHistoryRef = useRef(false);

  const onMessageRef = useRef<((msg: StreamMessage) => void) | null>(null);
  const onErrorRef = useRef<((err: {
    code?: string;
    message?: string;
    timestamp?: number;
    errorCode?: number;
    errorMessage?: string;
  }) => void) | null>(null);
  const onCloseRef = useRef<((reason: string) => void) | null>(null);

  const finalizeStreamingMessage = useCallback(() => {
    assemblerRef.current.complete();

    if (streamingMsgIdRef.current) {
      const finalId = streamingMsgIdRef.current;
      const finalParts = assemblerRef.current.getParts();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === finalId
            ? { ...m, isStreaming: false, parts: [...finalParts] }
            : m,
        ),
      );
    }

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
  }, []);

  const appendAssistantErrorBlock = useCallback((message: string, fallbackMessage: string) => {
    const normalizedMessage = message.trim() || fallbackMessage;
    const currentStreamingMessageId = streamingMsgIdRef.current;
    const assemblerText = assemblerRef.current.getText();
    const assemblerParts = assemblerRef.current
      .getParts()
      .map((part) => ({ ...part, isStreaming: false }));
    const errorPart: MessagePart = {
      partId: genMessageId('error_part'),
      type: 'error',
      content: normalizedMessage,
      isStreaming: false,
    };

    setMessages((prev) => {
      if (currentStreamingMessageId) {
        const streamingMessageIndex = prev.findIndex((messageItem) => messageItem.id === currentStreamingMessageId);
        if (streamingMessageIndex >= 0) {
          const nextMessages = [...prev];
          const currentMessage = nextMessages[streamingMessageIndex];
          const baseParts = currentMessage.parts && currentMessage.parts.length > 0
            ? currentMessage.parts.map((part) => ({ ...part, isStreaming: false }))
            : assemblerParts;

          nextMessages[streamingMessageIndex] = {
            ...currentMessage,
            content: currentMessage.content || assemblerText || normalizedMessage,
            isStreaming: false,
            parts: [...baseParts, errorPart],
          };
          return nextMessages;
        }
      }

      return [
        ...prev,
        {
          id: genMessageId('assistant_error'),
          role: 'assistant',
          content: normalizedMessage,
          timestamp: Date.now(),
          isStreaming: false,
          parts: [errorPart],
        },
      ];
    });

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
  }, []);

  const appendMessageFromOperation = useCallback(
    (messageOperation: SendMessageResponse) => {
      const mappedMessage = messageOperationToMessage(messageOperation);
      if (mappedMessage.role === 'user' && mappedMessage.content.trim()) {
        latestUserContentRef.current = mappedMessage.content.trim();
      }

      setMessages((prev) => {
        const existingIndex = prev.findIndex((msg) => msg.id === mappedMessage.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            ...mappedMessage,
          };
          return next;
        }

        if (mappedMessage.role === 'user' && streamingMsgIdRef.current) {
          const streamingIndex = prev.findIndex((msg) => msg.id === streamingMsgIdRef.current);
          if (streamingIndex >= 0) {
            return [
              ...prev.slice(0, streamingIndex),
              mappedMessage,
              ...prev.slice(streamingIndex),
            ];
          }
        }

        return [...prev, mappedMessage];
      });
    },
    [],
  );

  const loadMoreHistory = useCallback(async () => {
    if (!welinkSessionId) return;
    if (isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

    isLoadingHistoryRef.current = true;
    setIsLoadingHistory(true);

    try {
      const result = await getSessionMessageHistory({
        welinkSessionId,
        beforeSeq: nextBeforeSeqRef.current ?? undefined,
        size: HISTORY_PAGE_SIZE,
      });

      const olderMessages = result.content.map((message) => sessionMessageToMessage(message));

      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages.map((message) => ({ ...message, isHistory: true })), ...prev]);
      }

      nextBeforeSeqRef.current = result.nextBeforeSeq ?? null;
      const nextHasMoreHistory = hasMoreHistoryByCursor(result);
      hasMoreHistoryRef.current = nextHasMoreHistory;
      setHasMoreHistory(nextHasMoreHistory);
    } catch (err) {
      console.error('Failed to load more history messages:', err);
      showToast('获取历史消息失败');
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [welinkSessionId]);

  const resolveAssistantDetail = useCallback(async (currentAssistantAccount: string) => {
    const detailsResult = await getWeAgentDetails({ partnerAccount: currentAssistantAccount });
    const detail = detailsResult.WeAgentDetailsArray?.[0];
    if (!detail) {
      throw new Error('未获取到助理详情');
    }

    setWeAgentAssistantName(detail.name ?? '');
    setWeAgentAssistantDescription(detail.desc ?? '');
    setWeAgentAssistantAvatar(resolveAssistantIconUrl(detail.icon));
    assistantDetailRef.current = detail;
    return detail;
  }, []);

  const createSessionForAssistant = useCallback(
    async (currentAssistantAccount: string, appKey: string) => {
      const userInfo = await getUserInfo();
      return createNewSession({
        ak: appKey,
        bussinessDomain: 'miniapp',
        bussinessType: 'direct',
        assistantAccount: currentAssistantAccount,
        bussinessId: userInfo.uid,
      });
    },
    [],
  );

  useEffect(() => {
    assistantAccountRef.current = assistantAccount.trim();
    assistantDetailRef.current = null;
    setWeAgentAssistantName('');
    setWeAgentAssistantDescription('');
    setWeAgentAssistantAvatar('');
  }, [assistantAccount]);

  useEffect(() => {
    const currentAssistantAccount = assistantAccountRef.current.trim();
    if (!currentAssistantAccount) {
      console.error('缺少 assistantAccount 参数');
      setIsLoading(false);
      return;
    }

    let disposed = false;

    const initializeWeAgentSession = async () => {
      setIsLoading(true);
      try {
        const userInfo = await getUserInfo();
        if (!disposed) {
          setWeAgentUserName(userInfo.userNameZH);
          setWeAgentUserAvatar(buildCorpUserAvatar(userInfo.corpUserId));
        }

        const detail = await resolveAssistantDetail(currentAssistantAccount);
        const historyResult = await getHistorySessionsList({
          assistantAccount: currentAssistantAccount,
          businessSessionDomain: 'miniapp',
        });
        const latestAvailableSession = getLatestAvailableSessionByUpdatedAt(historyResult.content ?? []);
        const session = latestAvailableSession
          ?? await createSessionForAssistant(currentAssistantAccount, detail.appKey);

        if (disposed) {
          return;
        }

        setWelinkSessionId(session.welinkSessionId);
      } catch (err) {
        console.error('Failed to initialize weAgent session:', err);
        if (!disposed) {
          showToast('初始化会话失败');
          setIsLoading(false);
        }
      }
    };

    void initializeWeAgentSession();

    return () => {
      disposed = true;
    };
  }, [assistantAccount, resolveAssistantDetail, createSessionForAssistant]);

  useEffect(() => {
    if (!welinkSessionId) return;

    nextBeforeSeqRef.current = null;
    hasMoreHistoryRef.current = false;
    isLoadingHistoryRef.current = false;
    setHasMoreHistory(false);
    setIsLoadingHistory(false);

    const loadMessages = async () => {
      try {
        const result = await getSessionMessageHistory({
          welinkSessionId,
          size: HISTORY_PAGE_SIZE,
        });
        const mapped = result.content.map((message) => ({
          ...sessionMessageToMessage(message),
          isHistory: true,
        }));
        setMessages(mapped);
        latestUserContentRef.current = getLatestUserContent(mapped);

        nextBeforeSeqRef.current = result.nextBeforeSeq ?? null;
        const nextHasMoreHistory = hasMoreHistoryByCursor(result);
        hasMoreHistoryRef.current = nextHasMoreHistory;
        setHasMoreHistory(nextHasMoreHistory);
      } catch (err) {
        console.error('Failed to load messages:', err);
        showToast('获取历史消息失败');
      }
    };

    onMessageRef.current = (msg: StreamMessage) => {
      switch (msg.type) {
        case 'text.delta':
        case 'text.done':
        case 'thinking.delta':
        case 'thinking.done':
        case 'tool.update':
        case 'question':
        case 'permission.ask':
        case 'file': {
          setSessionStatus('busy');
          const assembler = assemblerRef.current;
          assembler.handleMessage(msg);

          const currentText = assembler.getText();
          const currentParts = assembler.getParts();

          setMessages((prev) => {
            if (streamingMsgIdRef.current) {
              return prev.map((m) =>
                m.id === streamingMsgIdRef.current
                  ? { ...m, content: currentText, parts: [...currentParts], isStreaming: true }
                  : m,
              );
            }
            const id = genMessageId();
            streamingMsgIdRef.current = id;
            return [
              ...prev,
              {
                id,
                role: 'assistant',
                content: currentText,
                timestamp: Date.now(),
                isStreaming: true,
                parts: [...currentParts],
              },
            ];
          });
          break;
        }

        case 'permission.reply': {
          const hasStreamingPermission = Boolean(
            msg.permissionId && assemblerRef.current.getParts().some(
              (part) => part.type === 'permission' && part.permissionId === msg.permissionId,
            ),
          );
          if (hasStreamingPermission) {
            assemblerRef.current.handleMessage(msg);
          }
          const currentParts = hasStreamingPermission ? assemblerRef.current.getParts() : null;
          const currentStreamingMessageId = streamingMsgIdRef.current;

          setMessages((prev) => prev.map((messageItem) => {
            if (currentStreamingMessageId && currentParts && messageItem.id === currentStreamingMessageId) {
              return {
                ...messageItem,
                parts: [...currentParts],
              };
            }

            if (!msg.permissionId || !messageItem.parts?.some(
              (part) => part.type === 'permission' && part.permissionId === msg.permissionId,
            )) {
              return messageItem;
            }

            return {
              ...messageItem,
              parts: messageItem.parts.map((part) => (
                part.type === 'permission' && part.permissionId === msg.permissionId
                  ? {
                    ...part,
                    permResolved: true,
                    response: msg.response ?? part.response,
                  }
                  : part
              )),
            };
          }));
          break;
        }

        case 'step.start':
          setSessionStatus('busy');
          break;

        case 'step.done':
          if (streamingMsgIdRef.current && msg.tokens) {
            const finalId = streamingMsgIdRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === finalId
                  ? {
                    ...m,
                    meta: {
                      ...m.meta,
                      tokens: msg.tokens ?? undefined,
                      cost: msg.cost ?? undefined,
                    },
                  }
                  : m,
              ),
            );
          }
          break;

        case 'session.status': {
          if (msg.sessionStatus === 'idle') {
            setSessionStatus('idle');
            finalizeStreamingMessage();

            if (shouldResetFooterOnCompletionRef.current && !suppressFooterAutoResetRef.current) {
              setFooterMode('generate');
            }
            shouldResetFooterOnCompletionRef.current = false;
          } else if (msg.sessionStatus === 'busy') {
            setSessionStatus('busy');
          } else if (msg.sessionStatus === 'retry') {
            setSessionStatus('retry');
          }
          break;
        }

        case 'session.error':
          setSessionStatus('error');
          console.error(msg.error ?? '会话错误');
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          appendAssistantErrorBlock(msg.error ?? '', 'AI回复失败');
          break;

        case 'error':
          setSessionStatus('error');
          console.error(msg.error ?? '未知错误');
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          appendAssistantErrorBlock(msg.error ?? '', 'AI回复失败');
          break;

        case 'snapshot':
          if (msg.messages && msg.messages.length > 0) {
            const snapshotMessages: Message[] = msg.messages
              .map((sm) => snapshotMessageToMessage(sm))
              .reverse();
            setMessages(snapshotMessages);
            latestUserContentRef.current = getLatestUserContent(snapshotMessages);
          }
          break;

        case 'streaming':
          if (msg.parts && msg.parts.length > 0) {
            setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
            const id = genMessageId();
            streamingMsgIdRef.current = id;
            const streamingMsg: Message = {
              id,
              role: normalizeRole(msg.role),
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
              parts: mapRawParts(msg.parts, true),
            };
            setMessages((prev) => [...prev, streamingMsg]);
          }
          break;

        default:
          break;
      }
    };

    onErrorRef.current = (err) => {
      const errorCode = err.code ?? (err.errorCode !== undefined ? String(err.errorCode) : 'unknown');
      const errorMessage = err.message ?? err.errorMessage ?? 'unknown error';
      console.error('Session listener error:', `${errorCode}: ${errorMessage}`);
      showToast('会话监听异常');
    };

    onCloseRef.current = (reason) => {
      console.log('Session listener closed:', reason);
    };

    const initSession = async () => {
      await loadMessages();
      setIsLoading(false);

      if (!listenerRegisteredRef.current && welinkSessionId && onMessageRef.current) {
        registerSessionListener({
          welinkSessionId,
          onMessage: onMessageRef.current,
          onError: onErrorRef.current ?? undefined,
          onClose: onCloseRef.current ?? undefined,
        });
        listenerRegisteredRef.current = true;
      }
    };

    void initSession();

    return () => {
      if (listenerRegisteredRef.current && welinkSessionId && onMessageRef.current) {
        unregisterSessionListener({
          welinkSessionId,
        });
        listenerRegisteredRef.current = false;
      }
    };
  }, [welinkSessionId, appendAssistantErrorBlock, finalizeStreamingMessage]);

  const handleGenerate = useCallback(async (content: string) => {
    if (!welinkSessionId || !content.trim()) return;

    const trimmedContent = content.trim();
    setSessionStatus('busy');
    setFooterMode('generating');
    shouldResetFooterOnCompletionRef.current = true;
    suppressFooterAutoResetRef.current = false;

    try {
      const result = await sendMessageApi({
        welinkSessionId,
        content: trimmedContent,
      });
      appendMessageFromOperation(result);
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      showToast('发送消息失败');
      console.error('发送消息失败:', err);
    }
  }, [welinkSessionId, appendMessageFromOperation]);

  const handleStop = useCallback(async () => {
    if (!welinkSessionId) return;
    suppressFooterAutoResetRef.current = true;

    try {
      await stopSkill({ welinkSessionId });
      shouldResetFooterOnCompletionRef.current = false;
      setFooterMode('generate');
      setSessionStatus('idle');
      finalizeStreamingMessage();
    } catch (err) {
      suppressFooterAutoResetRef.current = false;
      console.error('Failed to stop skill:', err);
      showToast('停止生成失败');
      setFooterMode('generating');
    }
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleCreateSession = useCallback(async () => {
    const currentAssistantAccount = assistantAccountRef.current.trim();
    if (!currentAssistantAccount) {
      return;
    }

    setIsLoading(true);

    try {
      let detail = assistantDetailRef.current;
      if (!detail || detail.partnerAccount !== currentAssistantAccount) {
        detail = await resolveAssistantDetail(currentAssistantAccount);
      }

      const newSession = await createSessionForAssistant(currentAssistantAccount, detail.appKey);
      setMessages([]);
      setWelinkSessionId(newSession.welinkSessionId);
    } catch (err) {
      console.error('Failed to create new session:', err);
      showToast('新建会话失败');
      setIsLoading(false);
    }
  }, [resolveAssistantDetail, createSessionForAssistant]);

  const handleSwitchWeAgentSession = useCallback((nextWelinkSessionId: string) => {
    const normalizedSessionId = nextWelinkSessionId.trim();
    if (!normalizedSessionId || normalizedSessionId === welinkSessionId) {
      return;
    }

    finalizeStreamingMessage();
    shouldResetFooterOnCompletionRef.current = false;
    suppressFooterAutoResetRef.current = false;
    latestUserContentRef.current = '';

    setFooterMode('generate');
    setSessionStatus('idle');
    setMessages([]);
    setIsLoading(true);
    setWelinkSessionId(normalizedSessionId);
  }, [finalizeStreamingMessage, welinkSessionId]);

  return (
    <div
      className={[
        'app-container',
        isPc ? 'pc-mode' : '',
        'app-container--we-agent-cui',
        isPc && isHistorySidebarVisible ? 'has-history-sidebar' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="we-agent-cui-main">
        <div className="we-agent-cui-chat-panel">
          <div className="content-wrapper">
            <Content
              messages={messages}
              welinkSessionId={welinkSessionId ?? ''}
              isLoading={isLoading}
              isLoadingHistory={isLoadingHistory}
              hasMoreHistory={hasMoreHistory}
              onLoadMoreHistory={loadMoreHistory}
              weAgentUserName={weAgentUserName}
              weAgentUserAvatar={weAgentUserAvatar}
              weAgentAssistantName={weAgentAssistantName}
              weAgentAssistantDescription={weAgentAssistantDescription}
              weAgentAssistantAvatar={weAgentAssistantAvatar}
            />
          </div>

          <div className="we-agent-cui-actions" aria-label="多功能按钮区">
            <button
              type="button"
              className="we-agent-cui-actions__button"
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  void handleCreateSession();
                });
              }}
              aria-label="新建会话"
            >
              <img
                className="we-agent-cui-actions__icon"
                src={iconWeAgentNewSession}
                alt=""
              />
            </button>
            <WeAgentHistorySidebar
              assistantAccount={assistantAccount}
              currentWelinkSessionId={welinkSessionId ?? ''}
              onSessionSelect={handleSwitchWeAgentSession}
              onVisibilityChange={setIsHistorySidebarVisible}
            />
          </div>

          <div className="footer-wrapper">
            <WeAgentCUIFooter
              isPcMiniApp={isPc}
              mode={footerMode}
              onSend={handleGenerate}
              onStop={handleStop}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
