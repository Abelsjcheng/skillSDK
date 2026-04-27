import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isIosMobileDevice, isPcMiniApp } from './constants';
import { Content } from './components/Content';
import WeAgentCUIFooter from './components/assistant/WeAgentCUIFooter';
import WeAgentHistorySidebar from './components/assistant/WeAgentHistorySidebar';
import { resolveAssistantIconUrl } from './components/createAssistant/constants';
import { StreamAssembler } from './protocol/StreamAssembler';
import type { SkillSession, WeAgentDetails } from './types/bridge';
import type { AppProps } from './types/components';
import type {
  Message,
  MessagePart,
  PendingAssistantPreview,
  QuestionAnswerSubmission,
  SessionStatus,
  StreamMessage,
} from './types';
import { buildCorpUserAvatar } from './utils/avatar';
import {
  createNewSession,
  getDeviceInfo,
  getHistorySessionsList,
  getSessionMessageHistory,
  getUserInfo,
  getWeAgentDetails,
  registerSessionListener,
  reportUemEvent,
  sendMessage as sendMessageApi,
  stopSkill,
  unregisterSessionListener,
} from './utils/hwext';
import {
  collectUserMessageIds,
  contentTypeForRole,
  genMessageId,
  mapRawParts,
  messageOperationToMessage,
  normalizeRole,
  sessionMessageToMessage,
  snapshotMessageToMessage,
  updateLatestQuestionPart,
} from './utils/message';
import {
  ensureSessionTimestamps,
  getLatestAvailableSessionByUpdatedAt,
  hasMoreHistoryByCursor,
} from './utils/session';
import { runButtonClickWithDebounce } from './utils/buttonDebounce';
import { WeLog } from './utils/logger';
import { showToast } from './utils/toast';
import createSession from './imgs/createSession.svg';
import './styles/App.less';
import './styles/WeAgentCUI.less';

const HISTORY_PAGE_SIZE = 20;

function App({ assistantAccount = '' }: AppProps) {
  const isPc = isPcMiniApp();
  const isIosKeyboardLiftEnabled = isIosMobileDevice();
  const { t, i18n } = useTranslation();
  const [isHistorySidebarVisible, setIsHistorySidebarVisible] = useState(false);
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = useState<'generate' | 'generating' | 'regenerate'>('generate');
  const [outputtingSessionId, setOutputtingSessionId] = useState<string | null>(null);
  const isOutputting = outputtingSessionId === welinkSessionId
    && (footerMode === 'generating' || sessionStatus === 'busy');
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
  const [pendingAssistantPreview, setPendingAssistantPreview] = useState<PendingAssistantPreview>({
    visible: false,
    welinkSessionId: null,
    startedAt: 0,
  });

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const assistantAccountRef = useRef(assistantAccount);
  const assistantDetailRef = useRef<WeAgentDetails | null>(null);
  const shouldResetFooterOnCompletionRef = useRef(false);
  const suppressFooterAutoResetRef = useRef(false);
  const knownUserMessageIdsRef = useRef(new Set<string>());
  const messagesRef = useRef<Message[]>([]);
  const nextBeforeSeqRef = useRef<number | null>(null);
  const hasMoreHistoryRef = useRef(false);
  const isLoadingHistoryRef = useRef(false);
  const activeWelinkSessionIdRef = useRef<string | null>(null);

  const onMessageRef = useRef<((msg: StreamMessage) => void) | null>(null);
  const onErrorRef = useRef<((err: {
    code?: string;
    message?: string;
    timestamp?: number;
    errorCode?: number;
    errorMessage?: string;
  }) => void) | null>(null);
  const onCloseRef = useRef<((reason: string) => void) | null>(null);
  const shouldUseEnglishUserName = (i18n.resolvedLanguage ?? i18n.language) === 'en';

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

  const showPendingAssistantPreview = useCallback((sessionId: string | null) => {
    setPendingAssistantPreview((prev) => (
      prev.visible && prev.welinkSessionId === sessionId
        ? prev
        : {
          visible: true,
          welinkSessionId: sessionId,
          startedAt: Date.now(),
        }
    ));
  }, []);

  const hidePendingAssistantPreview = useCallback(() => {
    setPendingAssistantPreview((prev) => (
      prev.visible
        ? {
          visible: false,
          welinkSessionId: null,
          startedAt: 0,
        }
        : prev
    ));
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

        return prev.map((message) =>
          message.id === finalId
            ? {
              ...message,
              content: finalText || message.content,
              isStreaming: false,
              parts: finalParts.length > 0 ? [...finalParts] : message.parts,
            }
            : message,
        );
      });
    }

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    hidePendingAssistantPreview();
  }, [hidePendingAssistantPreview]);

  const appendAssistantErrorBlock = useCallback((message: string, fallbackMessage: string) => {
    const normalizedMessage = message || fallbackMessage;
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
          const nextContent = currentMessage.content || assemblerText || normalizedMessage;

          nextMessages[streamingMessageIndex] = {
            ...currentMessage,
            content: nextContent,
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
          contentType: 'plain',
          timestamp: Date.now(),
          isStreaming: false,
          parts: [errorPart],
        },
      ];
    });

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    hidePendingAssistantPreview();
  }, [hidePendingAssistantPreview]);

  const upsertAssistantMessage = useCallback((messageId: string, updater: (current?: Message) => Message) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((message) => message.id === messageId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = updater(next[existingIndex]);
        return next;
      }

      return [...prev, updater(undefined)];
    });
  }, []);

  const ensureStreamingMessageContext = useCallback((messageId: string) => {
    if (streamingMsgIdRef.current && streamingMsgIdRef.current !== messageId) {
      finalizeStreamingMessage();
    }

    if (streamingMsgIdRef.current !== messageId) {
      assemblerRef.current.reset();
      streamingMsgIdRef.current = messageId;
    }

    hidePendingAssistantPreview();
  }, [finalizeStreamingMessage, hidePendingAssistantPreview]);

  const sendUserMessage = useCallback(async (content: string, toolCallId?: string) => {
    if (!welinkSessionId) {
      showToast(t('weAgent.sendMessageWithoutSessionFailed'));
      return null;
    }

    const result = await sendMessageApi({
      welinkSessionId,
      content: content?.trim(),
      ...(toolCallId ? { toolCallId } : {}),
    });
    const userMessage = messageOperationToMessage(result);

    setMessages((prev) => {
      const currentUserMessage = prev.find((message) => message.id === userMessage.id)
      if (currentUserMessage) {
        return prev;
      }
      const next = [...prev, userMessage];
      knownUserMessageIdsRef.current = collectUserMessageIds(next);
      return next;
    });
    setScrollToBottomSignal((prev) => prev + 1);

    return result;
  }, [t, welinkSessionId]);

  const updateHistorySessionTitle = useCallback((sessionId: string, title: string) => {
    const normalizedSessionId = sessionId;
    const nextTitle = title;
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
      WeLog(`App sendMessage failed | extra=${JSON.stringify({ welinkSessionId, toolCallId })} | error=${JSON.stringify(err)}`);
      setSessionStatus('idle');
      showToast(t('weAgent.submitAnswerFailed'));
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
      WeLog(`App getSessionMessageHistory failed | extra=${JSON.stringify({
        welinkSessionId,
        beforeSeq: nextBeforeSeqRef.current ?? undefined,
      })} | error=${JSON.stringify(err)}`);
      showToast(t('weAgent.loadHistoryFailed'));
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [welinkSessionId]);

  const resolveAssistantDetail = useCallback(async (currentAssistantAccount: string) => {
    const detailsResult = await getWeAgentDetails({ partnerAccount: currentAssistantAccount });
    const detail = detailsResult.weAgentDetailsArray?.[0];
    if (!detail) {
      throw new Error(t('weAgent.missingAssistantDetail'));
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
    assistantAccountRef.current = assistantAccount;
    assistantDetailRef.current = null;
    knownUserMessageIdsRef.current.clear();
    setOutputtingSessionId(null);
    hidePendingAssistantPreview();
    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    setWeAgentAssistantName('');
    setWeAgentAssistantDescription('');
    setWeAgentAssistantAvatar('');
    setHistorySessionsCache(null);
    setHistorySessionsLoaded(false);
  }, [assistantAccount, hidePendingAssistantPreview]);

  useEffect(() => {
    activeWelinkSessionIdRef.current = welinkSessionId;
  }, [welinkSessionId]);

  useEffect(() => {
    const currentAssistantAccount = assistantAccountRef.current;
    if (!currentAssistantAccount) {
      WeLog('App 缺少 assistantAccount 参数');
      return;
    }

    let disposed = false;

    const initializeWeAgentSession = async () => {
      try {
        const userInfo = await getUserInfo();
        if (!disposed) {
          setWeAgentUserName(shouldUseEnglishUserName ? userInfo.userNameEN : userInfo.userNameZH);
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
        WeLog(`App initializeWeAgentSession failed | extra=${JSON.stringify({
          assistantAccount: currentAssistantAccount,
        })} | error=${JSON.stringify(err)}`);
        if (!disposed) {
          showToast(t('weAgent.initSessionFailed'));
        }
      }
    };

    void initializeWeAgentSession();

    return () => {
      disposed = true;
    };
  }, [assistantAccount, resolveAssistantDetail, createSessionForAssistant, shouldUseEnglishUserName]);

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
        WeLog(`App getSessionMessageHistory failed | extra=${JSON.stringify({ welinkSessionId })} | error=${JSON.stringify(err)}`);
        showToast(t('weAgent.loadHistoryFailed'));
      }
    };

    onMessageRef.current = (msg: StreamMessage) => {
      const activeWelinkSessionId = activeWelinkSessionIdRef.current;
      if (!activeWelinkSessionId || msg.welinkSessionId !== activeWelinkSessionId) {
        return;
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
          const messageId = msg.messageId;
          if (!messageId) {
            break;
          }

          setSessionStatus('busy');
          setOutputtingSessionId(activeWelinkSessionId);
          ensureStreamingMessageContext(messageId);

          const assembler = assemblerRef.current;
          assembler.handleMessage(msg);
          const currentText = assembler.getText();
          const currentParts = assembler.getParts();

          upsertAssistantMessage(messageId, (current) => ({
            id: messageId,
            role: current?.role ?? 'assistant',
            content: currentText,
            contentType: current?.contentType ?? 'markdown',
            timestamp: current?.timestamp ?? (msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now()),
            isStreaming: true,
            parts: [...currentParts],
            meta: current?.meta,
            isHistory: current?.isHistory,
          }));
          break;
        }

        case 'message.user': {
          const messageId = msg.messageId;
          if (!messageId) {
            break;
          }

          finalizeStreamingMessage();
          setSessionStatus('busy');
          setOutputtingSessionId(activeWelinkSessionId);

          const content = msg.content ?? '';
          setMessages((prev) => {
            const hasUserMessage = knownUserMessageIdsRef.current.has(messageId);
            if (hasUserMessage) {
              return prev;
            }

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
          showPendingAssistantPreview(activeWelinkSessionId);
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
          setOutputtingSessionId(activeWelinkSessionId);
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
          const sessionId = String(msg.welinkSessionId ?? welinkSessionId ?? '');
          const nextTitle = typeof msg.title === 'string' ? msg.title : '';
          updateHistorySessionTitle(sessionId, nextTitle);
          break;
        }

        case 'session.status': {
          if (msg.sessionStatus === 'idle') {
            setSessionStatus('idle');
            setOutputtingSessionId(null);
            finalizeStreamingMessage();

            if (shouldResetFooterOnCompletionRef.current && !suppressFooterAutoResetRef.current) {
              setFooterMode('generate');
            }
            shouldResetFooterOnCompletionRef.current = false;
          } else if (msg.sessionStatus === 'busy') {
            setSessionStatus('busy');
            setOutputtingSessionId(activeWelinkSessionId);
          } else if (msg.sessionStatus === 'retry') {
            setSessionStatus('retry');
          }
          break;
        }

        case 'session.error':
          setSessionStatus('error');
          setOutputtingSessionId(null);
          WeLog(`App ${msg.error ?? '会话错误'} | extra=${JSON.stringify({
            type: 'session.error',
            welinkSessionId: activeWelinkSessionId,
          })}`);
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          appendAssistantErrorBlock(msg.error ?? '', t('weAgent.aiReplyFailed'));
          break;

        case 'error':
          setSessionStatus('error');
          setOutputtingSessionId(null);
          WeLog(`App ${msg.error ?? '未知错误'} | extra=${JSON.stringify({
            type: 'error',
            welinkSessionId: activeWelinkSessionId,
          })}`);
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          appendAssistantErrorBlock(msg.error ?? '', t('weAgent.aiReplyFailed'));
          break;

        case 'snapshot':
          assemblerRef.current.reset();
          streamingMsgIdRef.current = null;
          hidePendingAssistantPreview();
          {
            const snapshotMessages: Message[] = (msg.messages ?? [])
              .map((sm) => snapshotMessageToMessage(sm))
              .reverse();
            setMessages(snapshotMessages);
            knownUserMessageIdsRef.current = collectUserMessageIds(snapshotMessages);
          }
          break;

        case 'streaming': {
          const messageId = msg.messageId;
          if (!messageId || !msg.parts || msg.parts.length === 0) {
            break;
          }

          setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
          setOutputtingSessionId(msg.sessionStatus === 'busy' ? activeWelinkSessionId : null);
          ensureStreamingMessageContext(messageId);

          const nextRole = normalizeRole(msg.role);
          const nextParts = mapRawParts(msg.parts, true);
          upsertAssistantMessage(messageId, (current) => ({
            id: messageId,
            role: nextRole,
            content: current?.content ?? '',
            contentType: contentTypeForRole(nextRole),
            timestamp: current?.timestamp ?? (msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now()),
            isStreaming: true,
            parts: nextParts,
            meta: current?.meta,
            isHistory: current?.isHistory,
          }));
          break;
        }

        default:
          break;
      }
    };

    onErrorRef.current = (err) => {
      const errorCode = err.code ?? (err.errorCode !== undefined ? String(err.errorCode) : 'unknown');
      const errorMessage = err.message ?? err.errorMessage ?? 'unknown error';
      WeLog(`App Session listener error | extra=${JSON.stringify({
        errorCode,
        errorMessage,
        welinkSessionId,
      })}`);
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
  }, [
    welinkSessionId,
    appendAssistantErrorBlock,
    ensureStreamingMessageContext,
    finalizeStreamingMessage,
    hidePendingAssistantPreview,
    showPendingAssistantPreview,
    upsertAssistantMessage,
    updateHistorySessionTitle,
    sendUserMessage,
  ]);

  const handleGenerate = useCallback(async (content: string) => {
    if (!welinkSessionId || !content) return;

    setSessionStatus('busy');
    setFooterMode('generating');
    setOutputtingSessionId(welinkSessionId);
    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    shouldResetFooterOnCompletionRef.current = true;
    suppressFooterAutoResetRef.current = false;

    try {
      await sendUserMessage(content);
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      setOutputtingSessionId(null);
      showToast(t('weAgent.sendMessageFailed'));
      WeLog(`App sendMessage failed | extra=${JSON.stringify({ welinkSessionId })} | error=${JSON.stringify(err)}`);
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
      setOutputtingSessionId(null);
      finalizeStreamingMessage();
    } catch (err) {
      suppressFooterAutoResetRef.current = false;
      WeLog(`App stopSkill failed | extra=${JSON.stringify({ welinkSessionId })} | error=${JSON.stringify(err)}`);
      showToast(t('weAgent.stopGenerateFailed'));
      setFooterMode('generating');
    }
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleCreateSession = useCallback(async () => {
    const currentAssistantAccount = assistantAccountRef.current;
    void reportUemEvent('weagent_create_session_click', '创建会话', {
      clientType: '',
      entry: 'WeAgent',
      operationTime: new Date().getTime(),
    }).catch((error) => {
      WeLog(`App reportUemEvent failed | extra=${JSON.stringify({
        eventId: 'weagent_create_session_click',
      })} | error=${JSON.stringify(error)}`);
    });

    if (!currentAssistantAccount) {
      return;
    }

    if (messages.length === 0) {
      showToast(t('weAgent.newestSession'));
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
      hidePendingAssistantPreview();
      assemblerRef.current.reset();
      streamingMsgIdRef.current = null;
      setOutputtingSessionId(null);
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
      WeLog(`App createNewSession failed | extra=${JSON.stringify({ assistantAccount: currentAssistantAccount })} | error=${JSON.stringify(err)}`);
      showToast(t('weAgent.createSessionFailed'));
    }
  }, [messages.length, resolveAssistantDetail, createSessionForAssistant, hidePendingAssistantPreview, welinkSessionId]);

  const handleSwitchWeAgentSession = useCallback((nextWelinkSessionId: string) => {
    const normalizedSessionId = nextWelinkSessionId;
    if (!normalizedSessionId || normalizedSessionId === welinkSessionId) {
      return;
    }
    finalizeStreamingMessage();
    shouldResetFooterOnCompletionRef.current = false;
    suppressFooterAutoResetRef.current = false;
    knownUserMessageIdsRef.current.clear();
    
    setFooterMode('generate');
    setSessionStatus('idle');
    setOutputtingSessionId(null);
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
              pendingAssistantPreview={pendingAssistantPreview}
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
                  draggable="false"
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
                mode={isOutputting ? 'generating' : footerMode}
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
