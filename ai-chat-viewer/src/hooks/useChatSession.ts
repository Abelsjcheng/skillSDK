import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StreamAssembler } from '../protocol/StreamAssembler';
import type { Message, MessagePart, PendingAssistantPreview, QuestionAnswerSubmission, SessionStatus, StreamMessage } from '../types';
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
} from '../utils/message';
import {
  getSessionMessageHistory,
  registerSessionListener,
  sendMessage as sendMessageApi,
  stopSkill,
  unregisterSessionListener,
  sendMessageToIM,
  controlSkillWeCode,
} from '../utils/hwext';
import { hasMoreHistoryByCursor } from '../utils/session';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';
import { copyTextToClipboard } from '../utils/clipboard';
import type { UseChatSessionOptions, UseChatSessionResult } from '../types/hooks/chatSession';

const HISTORY_PAGE_SIZE = 20;

export function useChatSession({
  mode,
  welinkSessionId,
  onSessionTitleChange,
}: UseChatSessionOptions): UseChatSessionResult {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingAssistantPreview, setPendingAssistantPreview] = useState<PendingAssistantPreview>({
    visible: false,
    welinkSessionId: null,
    startedAt: 0,
  });
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [scrollToBottomSignal, setScrollToBottomSignal] = useState(0);

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const knownUserMessageIdsRef = useRef(new Set<string>());
  const nextBeforeSeqRef = useRef<number | null>(null);
  const hasMoreHistoryRef = useRef(false);
  const isLoadingHistoryRef = useRef(false);
  const activeWelinkSessionIdRef = useRef<string | null>(welinkSessionId || null);
  const historyEpochRef = useRef(0);
  const agentOfflineHandledRef = useRef(false);
  const onSessionTitleChangeRef = useRef(onSessionTitleChange);
  const aiReplyFailedTextRef = useRef(t('weAgent.aiReplyFailed'));

  onSessionTitleChangeRef.current = onSessionTitleChange;
  aiReplyFailedTextRef.current = t('weAgent.aiReplyFailed');

  const showPendingAssistantPreview = useCallback((sessionId: string | null) => {
    setPendingAssistantPreview((prev) => (
      prev.visible && prev.welinkSessionId === sessionId
        ? prev
        : { visible: true, welinkSessionId: sessionId, startedAt: Date.now() }
    ));
  }, []);

  const hidePendingAssistantPreview = useCallback(() => {
    setPendingAssistantPreview((prev) => (
      prev.visible
        ? { visible: false, welinkSessionId: null, startedAt: 0 }
        : prev
    ));
  }, []);

  const resetTransientState = useCallback(() => {
    historyEpochRef.current += 1;
    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    agentOfflineHandledRef.current = false;
    messagesRef.current = [];
    knownUserMessageIdsRef.current.clear();
    nextBeforeSeqRef.current = null;
    hasMoreHistoryRef.current = false;
    isLoadingHistoryRef.current = false;
    setMessages([]);
    setHasMoreHistory(false);
    setIsLoadingHistory(false);
    setSessionStatus('idle');
    hidePendingAssistantPreview();
  }, [hidePendingAssistantPreview]);

  const finalizeStreamingMessage = useCallback(() => {
    assemblerRef.current.complete();
    if (streamingMsgIdRef.current) {
      const finalId = streamingMsgIdRef.current;
      const finalText = assemblerRef.current.getText();
      const finalParts = assemblerRef.current.getParts();
      setMessages((prev) => prev.map((message) => (
        message.id === finalId
          ? {
            ...message,
            content: finalText || message.content,
            isStreaming: false,
            parts: finalParts.length > 0 ? [...finalParts] : message.parts,
          }
          : message
      )));
    }
    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    hidePendingAssistantPreview();
  }, [hidePendingAssistantPreview]);

  const appendAssistantErrorBlock = useCallback((message: string, fallbackMessage: string) => {
    const normalizedMessage = message || fallbackMessage;
    const currentStreamingMessageId = streamingMsgIdRef.current;
    const assemblerText = assemblerRef.current.getText();
    const assemblerParts = assemblerRef.current.getParts().map((part) => ({ ...part, isStreaming: false }));
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
  }, [finalizeStreamingMessage]);

  const loadMoreHistory = useCallback(async () => {
    if (!welinkSessionId) return;
    if (isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

    const requestSessionId = welinkSessionId;
    const requestEpoch = historyEpochRef.current;
    isLoadingHistoryRef.current = true;
    setIsLoadingHistory(true);
    try {
      const result = await getSessionMessageHistory({
        welinkSessionId: requestSessionId,
        beforeSeq: nextBeforeSeqRef.current ?? undefined,
        size: HISTORY_PAGE_SIZE,
      });
      if (
        historyEpochRef.current !== requestEpoch
        || activeWelinkSessionIdRef.current !== requestSessionId
      ) {
        return;
      }
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
      WeLog(`useChatSession getSessionMessageHistory failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
      showToast(t('weAgent.loadHistoryFailed'));
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [mode, t, welinkSessionId]);

  const sendUserMessage = useCallback(async (
    content: string,
    toolCallId?: string,
    subagentSessionId?: string,
  ) => {
    if (!welinkSessionId) {
      showToast(t('weAgent.sendMessageWithoutSessionFailed'));
      return null;
    }

    const result = await sendMessageApi({
      welinkSessionId,
      content: content.trim(),
      ...(toolCallId ? { toolCallId } : {}),
      ...(subagentSessionId ? { subagentSessionId } : {}),
    });
    const userMessage = messageOperationToMessage(result);
    setMessages((prev) => {
      if (prev.find((message) => message.id === userMessage.id)) {
        return prev;
      }
      const next = [...prev, userMessage];
      knownUserMessageIdsRef.current = collectUserMessageIds(next);
      return next;
    });
    setScrollToBottomSignal((prev) => prev + 1);
    return result;
  }, [t, welinkSessionId]);

  const handleQuestionAnswered = useCallback(async ({
    answer,
    toolCallId,
    subagentSessionId,
  }: QuestionAnswerSubmission) => {
    finalizeStreamingMessage();
    setSessionStatus('busy');

    try {
      await sendUserMessage(answer, toolCallId, subagentSessionId);
    } catch (err) {
      WeLog(`useChatSession sendMessage failed | extra=${JSON.stringify({ mode, welinkSessionId, toolCallId, subagentSessionId })} | error=${JSON.stringify(err)}`);
      setSessionStatus('idle');
      showToast(t('weAgent.submitAnswerFailed'));
      throw err;
    }
  }, [finalizeStreamingMessage, mode, sendUserMessage, t, welinkSessionId]);

  useEffect(() => {
    activeWelinkSessionIdRef.current = welinkSessionId || null;
  }, [welinkSessionId]);

  useEffect(() => {
    messagesRef.current = messages;
    if (!welinkSessionId) {
      knownUserMessageIdsRef.current.clear();
      return;
    }
    knownUserMessageIdsRef.current = collectUserMessageIds(messages);
  }, [messages, welinkSessionId]);

  useEffect(() => {
    activeWelinkSessionIdRef.current = welinkSessionId || null;
    resetTransientState();
    const requestEpoch = historyEpochRef.current;

    if (!welinkSessionId) return;

    const loadMessages = async () => {
      try {
        const result = await getSessionMessageHistory({
          welinkSessionId,
          size: HISTORY_PAGE_SIZE,
        });
        if (
          historyEpochRef.current !== requestEpoch
          || activeWelinkSessionIdRef.current !== welinkSessionId
        ) {
          return;
        }
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
        if (
          historyEpochRef.current !== requestEpoch
          || activeWelinkSessionIdRef.current !== welinkSessionId
        ) {
          return;
        }
        WeLog(`useChatSession getSessionMessageHistory failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
        showToast(t('weAgent.loadHistoryFailed'));
      }
    };

    void loadMessages();
  }, [mode, resetTransientState, t, welinkSessionId]);

  useEffect(() => {
    if (!welinkSessionId) return;

    const onMessage = (msg: StreamMessage) => {
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
          window.requestAnimationFrame(() => {
            hidePendingAssistantPreview();
          });
          break;
        }
        case 'message.user': {
          const messageId = msg.messageId;
          if (!messageId) {
            break;
          }

          finalizeStreamingMessage();
          setSessionStatus('busy');
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
        case 'session.title':
          if (msg.welinkSessionId && msg.title) {
            onSessionTitleChangeRef.current?.(msg.welinkSessionId, msg.title);
          }
          break;
        case 'agent.online':
          agentOfflineHandledRef.current = false;
          break;
        case 'agent.offline':
          if (agentOfflineHandledRef.current) {
            break;
          }
          agentOfflineHandledRef.current = true;
          setSessionStatus('idle');
          appendAssistantErrorBlock('agent已离线', 'agent已离线');
          break;
        case 'session.status':
          if (msg.sessionStatus === 'idle') {
            setSessionStatus('idle');
            finalizeStreamingMessage();
          } else if (msg.sessionStatus === 'busy') {
            setSessionStatus('busy');
          } else if (msg.sessionStatus === 'retry') {
            setSessionStatus('retry');
          }
          break;
        case 'session.error':
          setSessionStatus('error');
          appendAssistantErrorBlock(msg.error ?? '', aiReplyFailedTextRef.current);
          break;
        case 'error':
          setSessionStatus('error');
          appendAssistantErrorBlock(msg.error ?? '', aiReplyFailedTextRef.current);
          break;
        case 'snapshot':
          assemblerRef.current.reset();
          streamingMsgIdRef.current = null;
          hidePendingAssistantPreview();
          setMessages((msg.messages ?? []).map((sm) => snapshotMessageToMessage(sm)).reverse());
          break;
        case 'streaming': {
          const messageId = msg.messageId;
          if (!messageId || !msg.parts || msg.parts.length === 0) {
            break;
          }

          setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
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
          window.requestAnimationFrame(() => {
            hidePendingAssistantPreview();
          });
          break;
        }
        default:
          break;
      }
    };

    const onError = (err: { code?: string; message?: string; errorCode?: number; errorMessage?: string }) => {
      WeLog(`useChatSession session listener error | extra=${JSON.stringify({ mode, welinkSessionId, errorCode: err.code ?? err.errorCode, errorMessage: err.message ?? err.errorMessage })}`);
    };

    const onClose = (reason: string) => {
      WeLog(`useChatSession session listener closed | extra=${JSON.stringify({ mode, welinkSessionId, reason })}`);
    };

    if (!listenerRegisteredRef.current) {
      registerSessionListener({
        welinkSessionId,
        onMessage,
        onError,
        onClose,
      });
      listenerRegisteredRef.current = true;
    }

    return () => {
      if (listenerRegisteredRef.current) {
        unregisterSessionListener({
          welinkSessionId,
        });
        listenerRegisteredRef.current = false;
      }
    };
  }, [
    appendAssistantErrorBlock,
    ensureStreamingMessageContext,
    finalizeStreamingMessage,
    hidePendingAssistantPreview,
    mode,
    upsertAssistantMessage,
    welinkSessionId,
  ]);

  const onSend = useCallback(async (content: string) => {
    if (!welinkSessionId || !content) return;

    setSessionStatus('busy');
    try {
      await sendUserMessage(content);
    } catch (err) {
      setSessionStatus('idle');
      showToast(t('weAgent.sendMessageFailed'));
      WeLog(`useChatSession sendMessage failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    }
  }, [mode, sendUserMessage, t, welinkSessionId]);

  const onStop = useCallback(async () => {
    if (!welinkSessionId) return;

    try {
      await stopSkill({ welinkSessionId });
      setSessionStatus('idle');
      finalizeStreamingMessage();
    } catch (err) {
      WeLog(`useChatSession stopSkill failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
      showToast(t('weAgent.stopGenerateFailed'));
    }
  }, [finalizeStreamingMessage, mode, t, welinkSessionId]);

  const onSendToIM = useCallback(async () => {
    if (!welinkSessionId) return;

    try {
      await sendMessageToIM({ welinkSessionId });
      showToast('已发送到IM');
    } catch (err) {
      WeLog(`useChatSession sendMessageToIM failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    }
  }, [mode, welinkSessionId]);

  const onMinimize = useCallback(async () => {
    try {
      await controlSkillWeCode({ action: 'minimize' });
    } catch (err) {
      WeLog(`useChatSession minimize failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    } finally {
      window.HWH5?.close?.();
    }
  }, [mode, welinkSessionId]);

  const onClose = useCallback(async () => {
    try {
      await controlSkillWeCode({ action: 'close' });
    } catch (err) {
      WeLog(`useChatSession close failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    } finally {
      window.HWH5?.close?.();
    }
  }, [mode, welinkSessionId]);

  const onCopy = useCallback(async (content: string) => {
    try {
      await copyTextToClipboard(content);
      showToast('已复制到剪贴板');
    } catch (err) {
      WeLog(`useChatSession copy failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
      showToast('复制失败');
    }
  }, [mode, welinkSessionId]);

  const isGenerating = sessionStatus === 'busy' || sessionStatus === 'retry';

  return useMemo(() => ({
    messages,
    pendingAssistantPreview,
    welinkSessionId,
    sessionStatus,
    isGenerating,
    isLoadingHistory,
    hasMoreHistory,
    scrollToBottomSignal,
    onLoadMoreHistory: loadMoreHistory,
    onQuestionAnswered: handleQuestionAnswered,
    onSend,
    onStop,
    onSendToIM,
    onMinimize,
    onClose,
    onCopy,
    resetTransientState,
  }), [
    handleQuestionAnswered,
    hasMoreHistory,
    isGenerating,
    isLoadingHistory,
    loadMoreHistory,
    messages,
    onClose,
    onCopy,
    onMinimize,
    onSend,
    onSendToIM,
    onStop,
    pendingAssistantPreview,
    resetTransientState,
    scrollToBottomSignal,
    sessionStatus,
    welinkSessionId,
  ]);
}
