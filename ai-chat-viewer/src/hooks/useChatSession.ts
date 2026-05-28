import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StreamAssembler } from '../protocol/StreamAssembler';
import type {
  Message,
  MessagePart,
  PendingAssistantPreview,
  QuestionAnswerSubmission,
  SessionStatus,
  StreamMessage,
} from '../types';
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
  sendMessageToIM,
  stopSkill,
  unregisterSessionListener,
} from '../utils/hwext';
import { copyTextToClipboard } from '../utils/clipboard';
import { WeLog } from '../utils/logger';
import { hasMoreHistoryByCursor } from '../utils/session';
import { showToast } from '../utils/toast';
import type { UseChatSessionOptions, UseChatSessionResult } from '../types/hooks/chatSession';

const HISTORY_PAGE_SIZE = 20;

function buildUserMessage(msg: StreamMessage): Message | null {
  const messageId = msg.messageId;
  if (!messageId) {
    return null;
  }

  return {
    id: messageId,
    role: 'user',
    content: msg.content ?? '',
    contentType: 'plain',
    timestamp: msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now(),
    isStreaming: false,
  };
}

export function useChatSession({
  mode,
  welinkSessionId,
  onSessionTitleChange,
}: UseChatSessionOptions): UseChatSessionResult {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

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

  const streamingAssemblersRef = useRef(new Map<string, StreamAssembler>());
  const latestStreamingMsgIdRef = useRef<string | null>(null);
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
  const aiReplyFailedTextRef = useRef(tRef.current('weAgent.aiReplyFailed'));
  const agentOfflineTextRef = useRef('agent已离线');

  onSessionTitleChangeRef.current = onSessionTitleChange;
  aiReplyFailedTextRef.current = tRef.current('weAgent.aiReplyFailed');

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
    streamingAssemblersRef.current.clear();
    latestStreamingMsgIdRef.current = null;
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

  const getLatestStreamingMessageId = useCallback(() => {
    const latestMessageId = latestStreamingMsgIdRef.current;
    if (latestMessageId && streamingAssemblersRef.current.has(latestMessageId)) {
      return latestMessageId;
    }

    const activeMessageIds = Array.from(streamingAssemblersRef.current.keys());
    return activeMessageIds.length > 0 ? activeMessageIds[activeMessageIds.length - 1] : null;
  }, []);

  const getOrCreateStreamingAssembler = useCallback((messageId: string) => {
    const current = streamingAssemblersRef.current.get(messageId);
    if (current) {
      latestStreamingMsgIdRef.current = messageId;
      return current;
    }

    const next = new StreamAssembler();
    streamingAssemblersRef.current.set(messageId, next);
    latestStreamingMsgIdRef.current = messageId;
    return next;
  }, []);

  const finalizeStreamingMessageById = useCallback((messageId: string | null | undefined) => {
    if (!messageId) {
      return;
    }

    const assembler = streamingAssemblersRef.current.get(messageId);
    if (!assembler) {
      if (latestStreamingMsgIdRef.current === messageId) {
        latestStreamingMsgIdRef.current = getLatestStreamingMessageId();
      }
      return;
    }

    assembler.complete();
    const finalText = assembler.getText();
    const finalParts = assembler.getParts();
    setMessages((prev) => prev.map((message) => (
      message.id === messageId
        ? {
          ...message,
          content: finalText || message.content,
          isStreaming: false,
          parts: finalParts.length > 0 ? [...finalParts] : message.parts,
        }
        : message
    )));
    streamingAssemblersRef.current.delete(messageId);
    if (latestStreamingMsgIdRef.current === messageId) {
      latestStreamingMsgIdRef.current = getLatestStreamingMessageId();
    }
  }, [getLatestStreamingMessageId]);

  const finalizeStreamingMessage = useCallback(() => {
    const activeMessageIds = Array.from(streamingAssemblersRef.current.keys());
    activeMessageIds.forEach((messageId) => {
      finalizeStreamingMessageById(messageId);
    });
    latestStreamingMsgIdRef.current = null;
    hidePendingAssistantPreview();
  }, [finalizeStreamingMessageById, hidePendingAssistantPreview]);

  const appendAssistantErrorBlock = useCallback((message: string, fallbackMessage: string) => {
    const normalizedMessage = message || fallbackMessage;
    const currentStreamingMessageId = latestStreamingMsgIdRef.current;
    const currentAssembler = currentStreamingMessageId
      ? streamingAssemblersRef.current.get(currentStreamingMessageId)
      : undefined;
    const assemblerText = currentAssembler?.getText() ?? '';
    const assemblerParts = currentAssembler?.getParts().map((part) => ({ ...part, isStreaming: false })) ?? [];
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

    if (currentStreamingMessageId) {
      streamingAssemblersRef.current.delete(currentStreamingMessageId);
      if (latestStreamingMsgIdRef.current === currentStreamingMessageId) {
        latestStreamingMsgIdRef.current = getLatestStreamingMessageId();
      }
    }
    hidePendingAssistantPreview();
  }, [getLatestStreamingMessageId, hidePendingAssistantPreview]);

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
      showToast(tRef.current('weAgent.loadHistoryFailed'));
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [mode, welinkSessionId]);

  const sendUserMessage = useCallback(async (
    content: string,
    toolCallId?: string,
    questionId?: string,
    subagentSessionId?: string,
  ) => {
    if (!welinkSessionId) {
      showToast(tRef.current('weAgent.sendMessageWithoutSessionFailed'));
      return null;
    }

    const result = await sendMessageApi({
      welinkSessionId,
      content: content.trim(),
      ...(toolCallId ? { toolCallId } : {}),
      ...(questionId ? { questionId } : {}),
      ...(subagentSessionId ? { subagentSessionId } : {}),
      ...(mode === 'skillCUI' ? { businessExtParam: { isSkillChat: false } } : {}),
    });

    const userMessage = messageOperationToMessage(result);
    setMessages((prev) => {
      if (prev.some((message) => message.id === userMessage.id)) {
        return prev;
      }
      const next = [...prev, userMessage];
      knownUserMessageIdsRef.current = collectUserMessageIds(next);
      return next;
    });
    setScrollToBottomSignal((prev) => prev + 1);
    return result;
  }, [mode, welinkSessionId]);

  const handleQuestionAnswered = useCallback(async ({
    answer,
    messageId,
    toolCallId,
    questionId,
    subagentSessionId,
  }: QuestionAnswerSubmission) => {
    finalizeStreamingMessageById(messageId ?? getLatestStreamingMessageId());
    setSessionStatus('busy');

    try {
      await sendUserMessage(answer, toolCallId, questionId, subagentSessionId);
    } catch (err) {
      WeLog(`useChatSession sendMessage failed | extra=${JSON.stringify({ mode, welinkSessionId, messageId, toolCallId, questionId, subagentSessionId })} | error=${JSON.stringify(err)}`);
      setSessionStatus('idle');
      showToast(tRef.current('weAgent.submitAnswerFailed'));
      throw err;
    }
  }, [finalizeStreamingMessageById, getLatestStreamingMessageId, mode, sendUserMessage, welinkSessionId]);

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
    if (!welinkSessionId) return;

    activeWelinkSessionIdRef.current = welinkSessionId || null;
    resetTransientState();
    const requestSessionId = welinkSessionId;
    const requestEpoch = historyEpochRef.current;
    let cancelled = false;

    const onMessage = (msg: StreamMessage) => {
      const activeWelinkSessionId = activeWelinkSessionIdRef.current;
      if (!activeWelinkSessionId || msg.welinkSessionId !== activeWelinkSessionId) {
        return;
      }

      if (
        msg.type === 'question'
        && (msg.status === 'completed' || msg.status === 'error')
        && !latestStreamingMsgIdRef.current
        && streamingAssemblersRef.current.size === 0
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
          const assembler = getOrCreateStreamingAssembler(messageId);
          assembler.handleMessage(msg);
          const currentText = assembler.getText();
          const currentParts = assembler.getParts();
          const isMessageStreaming = assembler.hasActiveStreaming();

          upsertAssistantMessage(messageId, (current) => ({
            id: messageId,
            role: current?.role ?? 'assistant',
            content: currentText,
            contentType: current?.contentType ?? 'markdown',
            timestamp: current?.timestamp ?? (msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now()),
            isStreaming: isMessageStreaming,
            parts: [...currentParts],
            meta: current?.meta,
            isHistory: current?.isHistory,
          }));
          if (!isMessageStreaming) {
            finalizeStreamingMessageById(messageId);
          }
          window.requestAnimationFrame(() => {
            hidePendingAssistantPreview();
          });
          break;
        }
        case 'message.user': {
          const nextMessage = buildUserMessage(msg);
          if (!nextMessage) {
            break;
          }

          finalizeStreamingMessage();
          setSessionStatus('busy');
          setMessages((prev) => {
            if (knownUserMessageIdsRef.current.has(nextMessage.id)) {
              return prev;
            }

            const next = [...prev, nextMessage];
            knownUserMessageIdsRef.current.add(nextMessage.id);
            return next;
          });
          showPendingAssistantPreview(activeWelinkSessionIdRef.current);
          break;
        }
        case 'permission.reply': {
          let currentStreamingMessageId: string | null = null;
          let currentParts: MessagePart[] | null = null;

          if (msg.permissionId) {
            Array.from(streamingAssemblersRef.current.entries()).some(([messageId, assembler]) => {
              if (!assembler.getParts().some(
                (part) => part.type === 'permission' && part.permissionId === msg.permissionId,
              )) {
                return false;
              }

              assembler.handleMessage(msg);
              currentStreamingMessageId = messageId;
              currentParts = assembler.getParts();
              latestStreamingMsgIdRef.current = messageId;
              return true;
            });
          }

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
          if (latestStreamingMsgIdRef.current && msg.tokens) {
            const finalId = latestStreamingMsgIdRef.current;
            setMessages((prev) => prev.map((message) => (
              message.id === finalId
                ? {
                  ...message,
                  meta: {
                    ...message.meta,
                    tokens: msg.tokens ?? undefined,
                    cost: msg.cost ?? undefined,
                  },
                }
                : message
            )));
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
          appendAssistantErrorBlock(agentOfflineTextRef.current, agentOfflineTextRef.current);
          break;
        case 'session.status':
          if (msg.sessionStatus === 'idle') {
            setSessionStatus('idle');
            finalizeStreamingMessageById(msg.messageId);
          } else if (msg.sessionStatus === 'busy') {
            setSessionStatus('busy');
          } else if (msg.sessionStatus === 'retry') {
            setSessionStatus('retry');
          }
          break;
        case 'session.error':
        case 'error':
          setSessionStatus('error');
          appendAssistantErrorBlock(msg.error ?? '', aiReplyFailedTextRef.current);
          break;
        case 'snapshot':
          streamingAssemblersRef.current.clear();
          latestStreamingMsgIdRef.current = null;
          hidePendingAssistantPreview();
          setMessages((msg.messages ?? []).map((item) => snapshotMessageToMessage(item)).reverse());
          break;
        case 'streaming': {
          const messageId = msg.messageId;
          if (!messageId || !msg.parts || msg.parts.length === 0) {
            break;
          }

          setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
          latestStreamingMsgIdRef.current = messageId;

          const assembler = getOrCreateStreamingAssembler(messageId);
          assembler.initializeFromSnapshot(msg.parts);

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
            isHistory: false,
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

    const registerCurrentSessionListener = () => {
      if (cancelled || listenerRegisteredRef.current) {
        return;
      }
      registerSessionListener({
        welinkSessionId: requestSessionId,
        onMessage,
        onError,
        onClose,
      });
      listenerRegisteredRef.current = true;
    };

    const loadMessages = async () => {
      try {
        const result = await getSessionMessageHistory({
          welinkSessionId: requestSessionId,
          size: HISTORY_PAGE_SIZE,
        });

        if (
          cancelled
          || historyEpochRef.current !== requestEpoch
          || activeWelinkSessionIdRef.current !== requestSessionId
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
          cancelled
          || historyEpochRef.current !== requestEpoch
          || activeWelinkSessionIdRef.current !== requestSessionId
        ) {
          return;
        }
        WeLog(`useChatSession getSessionMessageHistory failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
        showToast(tRef.current('weAgent.loadHistoryFailed'));
      }
    };

    void (async () => {
      await loadMessages();
      if (
        cancelled
        || historyEpochRef.current !== requestEpoch
        || activeWelinkSessionIdRef.current !== requestSessionId
      ) {
        return;
      }
      registerCurrentSessionListener();
    })();

    return () => {
      cancelled = true;
      if (listenerRegisteredRef.current) {
        unregisterSessionListener({
          welinkSessionId: requestSessionId,
        });
        listenerRegisteredRef.current = false;
      }
    };
  }, [
    appendAssistantErrorBlock,
    finalizeStreamingMessage,
    finalizeStreamingMessageById,
    getLatestStreamingMessageId,
    getOrCreateStreamingAssembler,
    hidePendingAssistantPreview,
    mode,
    resetTransientState,
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
      showToast(tRef.current('weAgent.sendMessageFailed'));
      WeLog(`useChatSession sendMessage failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    }
  }, [mode, sendUserMessage, welinkSessionId]);

  const onStop = useCallback(async () => {
    if (!welinkSessionId) return;

    try {
      await stopSkill({ welinkSessionId });
      setSessionStatus('idle');
      finalizeStreamingMessage();
    } catch (err) {
      WeLog(`useChatSession stopSkill failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
      showToast(tRef.current('weAgent.stopGenerateFailed'));
    }
  }, [finalizeStreamingMessage, mode, welinkSessionId]);

  const onSendToIM = useCallback(async (content: string) => {
    if (!welinkSessionId) return;

    try {
      await sendMessageToIM({ welinkSessionId, content });
      showToast('已发送到IM');
    } catch (err) {
      WeLog(`useChatSession sendMessageToIM failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    }
  }, [mode, welinkSessionId]);

  const onCopy = useCallback(async (content: string) => {
    try {
      await copyTextToClipboard(content);
      showToast(tRef.current('common.copySuccess'));
    } catch (err) {
      WeLog(`useChatSession copy failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
      showToast(tRef.current('assistantDetail.copyFailed'));
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
    onCopy,
    resetTransientState,
  }), [
    handleQuestionAnswered,
    hasMoreHistory,
    isGenerating,
    isLoadingHistory,
    loadMoreHistory,
    messages,
    onCopy,
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
