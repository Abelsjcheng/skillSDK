import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isIosMobileDevice, isPcMiniApp } from './constants';
import { Content } from './components/Content';
import WeAgentCUIFooter from './components/assistant/WeAgentCUIFooter';
import WeAgentHistorySidebar from './components/assistant/WeAgentHistorySidebar';
import { resolveAssistantIconUrl } from './components/createAssistant/constants';
import { t as translate, useI18n } from './i18n';
import { StreamAssembler } from './protocol/StreamAssembler';
import type {
  Message,
  MessagePart,
  QuestionAnswerSubmission,
  SessionStatus,
  StreamMessage,
} from './types';
import {
  buildCorpUserAvatar,
} from './utils/avatar';
import {
  createNewSession,
  getDeviceInfo,
  getHistorySessionsList,
  getSessionMessageHistory,
  getUserInfo,
  getWeAgentDetails,
  registerSessionListener,
  sendMessage as sendMessageApi,
  stopSkill,
  unregisterSessionListener,
  type SkillSession,
  type WeAgentDetails,
} from './utils/hwext';
import {
  collectUserMessageIds,
  contentTypeForRole,
  genMessageId,
  mapRawParts,
  messageOperationToMessage,
  normalizeRole,
  replaceOptimisticMessage,
  sessionMessageToMessage,
  snapshotMessageToMessage,
  updateLatestQuestionPart,
} from './utils/message';
import {
  ensureSessionTimestamps,
  getLatestAvailableSessionByUpdatedAt,
  hasMoreHistoryByCursor,
} from './utils/session';
import {
  createPendingAssistantMessage,
  shouldCreatePendingAssistantMessage,
} from './utils/streaming';
import { runButtonClickWithDebounce } from './utils/buttonDebounce';
import { showToast } from './utils/toast';
import createSession from './imgs/createSession.svg';
import './styles/App.less';
import './styles/WeAgentCUI.less';

export interface AppProps {
  assistantAccount?: string;
}

const HISTORY_PAGE_SIZE = 20;

function App({ assistantAccount = '' }: AppProps) {
  const isPc = isPcMiniApp();
  const isIosKeyboardLiftEnabled = isIosMobileDevice();
  const { t } = useI18n();
  const [isHistorySidebarVisible, setIsHistorySidebarVisible] = useState(false);
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = useState<'generate' | 'generating' | 'regenerate'>('generate');
  const isOutputting = footerMode === 'generating' || sessionStatus === 'busy';
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [weAgentUserName, setWeAgentUserName] = useState('');
  const [weAgentUserAvatar, setWeAgentUserAvatar] = useState('');
  const [weAgentAssistantName, setWeAgentAssistantName] = useState('');
  const [weAgentAssistantDescription, setWeAgentAssistantDescription] = useState('');
  const [weAgentAssistantAvatar, setWeAgentAssistantAvatar] = useState('');
  const [historySessionsCache, setHistorySessionsCache] = useState<SkillSession[] | null>(null);
  const [historySessionsLoaded, setHistorySessionsLoaded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollToBottomSignal, setScrollToBottomSignal] = useState(0);

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const assistantAccountRef = useRef(assistantAccount.trim());
  const assistantDetailRef = useRef<WeAgentDetails | null>(null);
  const shouldResetFooterOnCompletionRef = useRef(false);
  const suppressFooterAutoResetRef = useRef(false);
  const knownUserMessageIdsRef = useRef(new Set<string>());
  const messagesRef = useRef<Message[]>([]);
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
        const deviceInfo = await getDeviceInfo()
        safeAreaInsetBottom = deviceInfo.safeAreaInsetBottom;
      } catch (error) {
        console.error('disableAutoPushUpPage failed:', error);
      }

      window.HWH5.onKeyboardHeightChange?.(handleKeyboardHeightChange);
    };

    void setupKeyboardHeightListener();

    return () => {
      window.HWH5?.offKeyboardHeightChange?.();
      setKeyboardHeight(0);
    };
  }, [isIosKeyboardLiftEnabled]);

  const ensurePendingAssistantMessage = useCallback(() => {
    if (streamingMsgIdRef.current) {
      return;
    }

    const pendingMessage = createPendingAssistantMessage();
    streamingMsgIdRef.current = pendingMessage.id;
    setMessages((prev) => [...prev, pendingMessage]);
  }, []);

  const finalizeStreamingMessage = useCallback(() => {
    assemblerRef.current.complete();

    if (streamingMsgIdRef.current) {
      const finalId = streamingMsgIdRef.current;
      const finalText = assemblerRef.current.getText();
      const finalParts = assemblerRef.current.getParts();
      setMessages((prev) => {
        const currentMessage = prev.find((message) => message.id === finalId);
        if (!currentMessage) {
          return prev;
        }

        if (currentMessage.meta?.pending && finalParts.length === 0 && !finalText.trim()) {
          return prev.filter((message) => message.id !== finalId);
        }

        return prev.map((message) =>
          message.id === finalId
            ? {
              ...message,
              content: currentMessage.meta?.pending ? finalText : message.content,
              isStreaming: false,
              parts: [...finalParts],
              meta: currentMessage.meta?.pending
                ? {
                  ...message.meta,
                  pending: false,
                }
                : message.meta,
            }
            : message,
        );
      });
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
          const nextContent = currentMessage.meta?.pending
            ? assemblerText || normalizedMessage
            : currentMessage.content || assemblerText || normalizedMessage;

          nextMessages[streamingMessageIndex] = {
            ...currentMessage,
            content: nextContent,
            isStreaming: false,
            parts: [...baseParts, errorPart],
            meta: currentMessage.meta?.pending
              ? {
                ...currentMessage.meta,
                pending: false,
              }
              : currentMessage.meta,
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
          contentType: 'plain',
          timestamp: Date.now(),
          isStreaming: false,
          parts: [errorPart],
        },
      ];
    });

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
  }, []);

  const sendUserMessage = useCallback(async (content: string, toolCallId?: string) => {
    if (!welinkSessionId || !content.trim()) {
      return null;
    }

    const trimmedContent = content.trim();
    const tempId = genMessageId('user');
    const optimisticMessage: Message = {
      id: tempId,
      role: 'user',
      content: trimmedContent,
      contentType: 'plain',
      timestamp: Date.now(),
      isStreaming: false,
    };

    setMessages((prev) => {
      const next = [
        ...prev,
        optimisticMessage,
      ];
      knownUserMessageIdsRef.current = collectUserMessageIds(next);
      return next;
    });

    const result = await sendMessageApi({
      welinkSessionId,
      content: trimmedContent,
      ...(toolCallId ? { toolCallId } : {}),
    });
    const mappedMessage = messageOperationToMessage(result);

    setMessages((prev) => {
      const next = replaceOptimisticMessage(prev, tempId, mappedMessage);
      knownUserMessageIdsRef.current = collectUserMessageIds(next);
      return next;
    });
    setScrollToBottomSignal((prev) => prev + 1);

    return result;
  }, [welinkSessionId]);

  const updateHistorySessionTitle = useCallback((sessionId: string, title: string) => {
    const normalizedSessionId = sessionId.trim();
    const nextTitle = title.trim();
    if (!normalizedSessionId || !nextTitle) {
      return;
    }

    setHistorySessionsCache((prev) => {
      if (prev === null) {
        return prev;
      }

      return prev.map((session) => (
        session.welinkSessionId === normalizedSessionId && session.title !== nextTitle
          ? { ...session, title: nextTitle }
          : session
      ));
    });
  }, []);

  const handleQuestionAnswered = useCallback(async ({
    answer,
    toolCallId,
  }: QuestionAnswerSubmission) => {
    finalizeStreamingMessage();
    setSessionStatus('busy');

    try {
      await sendUserMessage(answer, toolCallId);
    } catch (err) {
      console.error('Failed to submit question answer:', err);
      setSessionStatus('idle');
      showToast(translate('weAgent.submitAnswerFailed'));
      throw err;
    }
  }, [finalizeStreamingMessage, sendUserMessage]);

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
        setMessages((prev) => {
          const next = [...olderMessages.map((message) => ({ ...message, isHistory: true })), ...prev];
          knownUserMessageIdsRef.current = collectUserMessageIds(next);
          return next;
        });
      }

      nextBeforeSeqRef.current = result.nextBeforeSeq ?? null;
      const nextHasMoreHistory = hasMoreHistoryByCursor(result);
      hasMoreHistoryRef.current = nextHasMoreHistory;
      setHasMoreHistory(nextHasMoreHistory);
    } catch (err) {
      console.error('Failed to load more history messages:', err);
      showToast(translate('weAgent.loadHistoryFailed'));
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [welinkSessionId]);

  const resolveAssistantDetail = useCallback(async (currentAssistantAccount: string) => {
    const detailsResult = await getWeAgentDetails({ partnerAccount: currentAssistantAccount });
    const detail = detailsResult.weAgentDetailsArray?.[0];
    if (!detail) {
      throw new Error(translate('weAgent.missingAssistantDetail'));
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
    knownUserMessageIdsRef.current.clear();
    setWeAgentAssistantName('');
    setWeAgentAssistantDescription('');
    setWeAgentAssistantAvatar('');
    setHistorySessionsCache(null);
    setHistorySessionsLoaded(false);
  }, [assistantAccount]);

  useEffect(() => {
    const currentAssistantAccount = assistantAccountRef.current.trim();
    if (!currentAssistantAccount) {
      console.error('缺少 assistantAccount 参数');
      return;
    }

    let disposed = false;

    const initializeWeAgentSession = async () => {
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
          showToast(translate('weAgent.initSessionFailed'));
        }
      }
    };

    void initializeWeAgentSession();

    return () => {
      disposed = true;
    };
  }, [assistantAccount, resolveAssistantDetail, createSessionForAssistant]);

  useEffect(() => {
    messagesRef.current = messages;
    knownUserMessageIdsRef.current = collectUserMessageIds(messages);
  }, [messages]);

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
        knownUserMessageIdsRef.current = collectUserMessageIds(mapped);
        nextBeforeSeqRef.current = result.nextBeforeSeq ?? null;
        const nextHasMoreHistory = hasMoreHistoryByCursor(result);
        hasMoreHistoryRef.current = nextHasMoreHistory;
        setHasMoreHistory(nextHasMoreHistory);
      } catch (err) {
        console.error('Failed to load messages:', err);
        showToast(translate('weAgent.loadHistoryFailed'));
      }
    };

    onMessageRef.current = (msg: StreamMessage) => {
      if (shouldCreatePendingAssistantMessage(msg)) {
        ensurePendingAssistantMessage();
      }

      if (
        msg.type === 'question'
        && (msg.status === 'completed' || msg.status === 'error')
        && !streamingMsgIdRef.current
      ) {
        const hasMatchingQuestion = messagesRef.current.some((message) =>
          message.parts?.some((part) => (
            part.type === 'question'
            && (!msg.partId || part.partId === msg.partId)
            && (!msg.toolCallId || part.toolCallId === msg.toolCallId)
          )),
        );

        if (hasMatchingQuestion) {
          setMessages((prev) => updateLatestQuestionPart(
            prev,
            (part) => (
              (!msg.partId || part.partId === msg.partId)
              && (!msg.toolCallId || part.toolCallId === msg.toolCallId)
            ),
            (part) => ({
              ...part,
              answered: true,
              output: msg.output ?? part.output,
              status: msg.status === 'completed' || msg.status === 'error' ? msg.status : part.status,
              isStreaming: false,
            }),
          ));
          return;
        }
      }

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
                  ? {
                    ...m,
                    content: currentText,
                    parts: [...currentParts],
                    isStreaming: true,
                    meta: m.meta?.pending
                      ? {
                        ...m.meta,
                        pending: false,
                      }
                      : m.meta,
                  }
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

        case 'message.user': {
          const messageId = msg.messageId?.trim();
          if (!messageId || knownUserMessageIdsRef.current.has(messageId)) {
            break;
          }

          const content = msg.content ?? '';
          setMessages((prev) => {
            const nextMessage: Message = {
              id: messageId,
              role: 'user',
              content,
              contentType: 'plain',
              timestamp: msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now(),
              isStreaming: false,
            };

            const next = [...prev, nextMessage];
            knownUserMessageIdsRef.current.add(messageId);
            return next;
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
          if (hasStreamingPermission && currentStreamingMessageId) {
            finalizeStreamingMessage();
          }
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

        case 'session.title': {
          const sessionId = String(msg.welinkSessionId ?? welinkSessionId ?? '').trim();
          const nextTitle = typeof msg.title === 'string' ? msg.title : '';
          updateHistorySessionTitle(sessionId, nextTitle);
          break;
        }

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
          appendAssistantErrorBlock(msg.error ?? '', translate('weAgent.aiReplyFailed'));
          break;

        case 'error':
          setSessionStatus('error');
          console.error(msg.error ?? '未知错误');
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          appendAssistantErrorBlock(msg.error ?? '', translate('weAgent.aiReplyFailed'));
          break;

        case 'snapshot':
          if (msg.messages && msg.messages.length > 0) {
            const snapshotMessages: Message[] = msg.messages
              .map((sm) => snapshotMessageToMessage(sm))
              .reverse();
            setMessages(snapshotMessages);
            knownUserMessageIdsRef.current = collectUserMessageIds(snapshotMessages);
          }
          break;

        case 'streaming':
          if (msg.parts && msg.parts.length > 0) {
            setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
            const nextRole = normalizeRole(msg.role);
            const nextParts = mapRawParts(msg.parts, true);
            setMessages((prev) => {
              if (streamingMsgIdRef.current) {
                return prev.map((message) =>
                  message.id === streamingMsgIdRef.current
                    ? {
                      ...message,
                      role: nextRole,
                      content: '',
                      contentType: contentTypeForRole(nextRole),
                      isStreaming: true,
                      parts: nextParts,
                      meta: message.meta?.pending
                        ? {
                          ...message.meta,
                          pending: false,
                        }
                        : message.meta,
                    }
                    : message,
                );
              }

              const id = genMessageId();
              streamingMsgIdRef.current = id;
              const streamingMsg: Message = {
                id,
                role: nextRole,
                content: '',
                contentType: contentTypeForRole(nextRole),
                timestamp: Date.now(),
                isStreaming: true,
                parts: nextParts,
              };
              return [...prev, streamingMsg];
            });
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
    };

    onCloseRef.current = (reason) => {
      console.log('Session listener closed:', reason);
    };

    const initSession = async () => {
      await loadMessages();

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
  }, [welinkSessionId, appendAssistantErrorBlock, finalizeStreamingMessage, ensurePendingAssistantMessage, updateHistorySessionTitle, sendUserMessage]);

  const handleGenerate = useCallback(async (content: string) => {
    if (!welinkSessionId || !content.trim()) return;

    setSessionStatus('busy');
    setFooterMode('generating');
    shouldResetFooterOnCompletionRef.current = true;
    suppressFooterAutoResetRef.current = false;

    try {
      await sendUserMessage(content);
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      showToast(translate('weAgent.sendMessageFailed'));
      console.error(translate('weAgent.sendMessageFailed'), err);
    }
  }, [welinkSessionId, sendUserMessage]);

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
      showToast(translate('weAgent.stopGenerateFailed'));
      setFooterMode('generating');
    }
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleCreateSession = useCallback(async () => {
    const currentAssistantAccount = assistantAccountRef.current.trim();
    if (!currentAssistantAccount) {
      return;
    }

    if (messages.length === 0) {
      showToast(translate('weAgent.newestSession'));
      return;
    }

    try {
      let detail = assistantDetailRef.current;
      if (!detail || detail.partnerAccount !== currentAssistantAccount) {
        detail = await resolveAssistantDetail(currentAssistantAccount);
      }

      const newSession = ensureSessionTimestamps(
        await createSessionForAssistant(currentAssistantAccount, detail.appKey),
      );
      setMessages([]);
      setWelinkSessionId(newSession.welinkSessionId);
      setHistorySessionsCache((prev) => {
        if (prev === null) {
          return prev;
        }
        const next = prev.filter((session) => session.welinkSessionId !== newSession.welinkSessionId);
        return [newSession, ...next];
      });
    } catch (err) {
      console.error('Failed to create new session:', err);
      showToast(translate('weAgent.createSessionFailed'));
    }
  }, [messages.length, resolveAssistantDetail, createSessionForAssistant]);

  const handleSwitchWeAgentSession = useCallback((nextWelinkSessionId: string) => {
    const normalizedSessionId = nextWelinkSessionId.trim();
    if (!normalizedSessionId || normalizedSessionId === welinkSessionId) {
      return;
    }

    finalizeStreamingMessage();
    shouldResetFooterOnCompletionRef.current = false;
    suppressFooterAutoResetRef.current = false;
    knownUserMessageIdsRef.current.clear();

    setFooterMode('generate');
    setSessionStatus('idle');
    setMessages([]);
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
      style={isIosKeyboardLiftEnabled && keyboardHeight > 0
        ? { height: `calc(100vh - ${keyboardHeight}px)` }
        : undefined}
    >
      <div className="we-agent-cui-main">
        <div className="we-agent-cui-chat-panel">
          <div className="content-wrapper">
            <Content
              messages={messages}
              welinkSessionId={welinkSessionId ?? ''}
              scrollToBottomSignal={scrollToBottomSignal}
              isLoadingHistory={isLoadingHistory}
              hasMoreHistory={hasMoreHistory}
              onLoadMoreHistory={loadMoreHistory}
              onQuestionAnswered={handleQuestionAnswered}
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
                onClick={(event) => {
                  runButtonClickWithDebounce(event, () => {
                    void handleCreateSession();
                  });
                }}
                aria-label={t('weAgent.newSession')}
              >
                <img
                  className="we-agent-cui-actions__icon"
                  src={createSession}
                  alt=""
                />
              </button>
              {isOutputting ? (
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
                mode={footerMode}
                onSend={handleGenerate}
                onStop={handleStop}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
