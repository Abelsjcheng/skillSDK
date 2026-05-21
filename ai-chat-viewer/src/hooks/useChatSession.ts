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
  controlSkillWeCode,
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

  const assemblerRef = useRef(new StreamAssembler());
  const replayAssemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const replayStreamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const replayMessagesRef = useRef(new Map<string, Message>());
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
    assemblerRef.current.reset();
    replayAssemblerRef.current.reset();
    streamingMsgIdRef.current = null;
    replayStreamingMsgIdRef.current = null;
    replayMessagesRef.current.clear();
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

  const flushReplayMessages = useCallback(() => {
    const replayMessages = Array.from(replayMessagesRef.current.values());
    replayMessagesRef.current.clear();
    replayAssemblerRef.current.reset();
    replayStreamingMsgIdRef.current = null;

    if (replayMessages.length === 0) {
      return;
    }

    replayMessages.sort((left, right) => left.timestamp - right.timestamp);

    setMessages((prev) => {
      const next = [...prev];
      replayMessages.forEach((message) => {
        const existingIndex = next.findIndex((item) => item.id === message.id);
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            ...message,
            isStreaming: false,
          };
        } else {
          next.push({
            ...message,
            isStreaming: false,
          });
        }
      });
      knownUserMessageIdsRef.current = collectUserMessageIds(next);
      return next;
    });
  }, []);

  const handleReplayMessage = useCallback((msg: StreamMessage) => {
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

        if (replayStreamingMsgIdRef.current && replayStreamingMsgIdRef.current !== messageId) {
          replayAssemblerRef.current.reset();
        }
        replayStreamingMsgIdRef.current = messageId;

        replayAssemblerRef.current.handleMessage(msg);
        const current = replayMessagesRef.current.get(messageId);
        replayMessagesRef.current.set(messageId, {
          id: messageId,
          role: current?.role ?? 'assistant',
          content: replayAssemblerRef.current.getText(),
          contentType: current?.contentType ?? 'markdown',
          timestamp: current?.timestamp ?? (msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now()),
          isStreaming: false,
          parts: replayAssemblerRef.current.getParts().map((part) => ({ ...part, isStreaming: false })),
          meta: current?.meta,
          isHistory: current?.isHistory,
        });
        break;
      }
      case 'message.user': {
        const nextMessage = buildUserMessage(msg);
        if (!nextMessage) {
          break;
        }
        if (
          replayMessagesRef.current.has(nextMessage.id)
          || knownUserMessageIdsRef.current.has(nextMessage.id)
        ) {
          break;
        }
        replayMessagesRef.current.set(nextMessage.id, nextMessage);
        break;
      }
      case 'permission.reply': {
        const permissionId = msg.permissionId;
        if (!permissionId) {
          break;
        }

        replayMessagesRef.current.forEach((message, messageId) => {
          if (!message.parts?.some((part) => part.type === 'permission' && part.permissionId === permissionId)) {
            return;
          }

          replayMessagesRef.current.set(messageId, {
            ...message,
            parts: message.parts.map((part) => (
              part.type === 'permission' && part.permissionId === permissionId
                ? {
                  ...part,
                  permResolved: true,
                  response: msg.response ?? part.response,
                  isStreaming: false,
                }
                : part
            )),
          });
        });
        break;
      }
      case 'step.done': {
        const currentReplayMessageId = replayStreamingMsgIdRef.current;
        if (!currentReplayMessageId || !msg.tokens) {
          break;
        }

        const current = replayMessagesRef.current.get(currentReplayMessageId);
        if (!current) {
          break;
        }

        replayMessagesRef.current.set(currentReplayMessageId, {
          ...current,
          meta: {
            ...current.meta,
            tokens: msg.tokens ?? undefined,
            cost: msg.cost ?? undefined,
          },
        });
        break;
      }
      case 'snapshot': {
        replayAssemblerRef.current.reset();
        replayStreamingMsgIdRef.current = null;
        replayMessagesRef.current.clear();
        (msg.messages ?? []).slice().reverse().forEach((snapshot) => {
          const mapped = snapshotMessageToMessage(snapshot);
          replayMessagesRef.current.set(mapped.id, mapped);
        });
        break;
      }
      case 'streaming': {
        const messageId = msg.messageId;
        if (!messageId || !msg.parts || msg.parts.length === 0) {
          break;
        }

        const nextRole = normalizeRole(msg.role);
        replayMessagesRef.current.set(messageId, {
          id: messageId,
          role: nextRole,
          content: '',
          contentType: contentTypeForRole(nextRole),
          timestamp: msg.emittedAt ? new Date(msg.emittedAt).getTime() : Date.now(),
          isStreaming: false,
          parts: mapRawParts(msg.parts, false),
        });
        break;
      }
      default:
        break;
    }

    if (msg.replayDone) {
      flushReplayMessages();
    }
  }, [flushReplayMessages]);

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
      ...(subagentSessionId ? { subagentSessionId } : {}),
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
  }, [welinkSessionId]);

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
      showToast(tRef.current('weAgent.submitAnswerFailed'));
      throw err;
    }
  }, [finalizeStreamingMessage, mode, sendUserMessage, welinkSessionId]);

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
        showToast(tRef.current('weAgent.loadHistoryFailed'));
      }
    };

    void loadMessages();
  }, [mode, resetTransientState, welinkSessionId]);

  useEffect(() => {
    if (!welinkSessionId) return;

    const onMessage = (msg: StreamMessage) => {
      const activeWelinkSessionId = activeWelinkSessionIdRef.current;
      if (!activeWelinkSessionId || msg.welinkSessionId !== activeWelinkSessionId) {
        return;
      }

      if (msg.deliveryMode === 'replay') {
        handleReplayMessage(msg);
        return;
      }

      if (replayMessagesRef.current.size > 0) {
        flushReplayMessages();
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
            finalizeStreamingMessage();
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
          assemblerRef.current.reset();
          streamingMsgIdRef.current = null;
          hidePendingAssistantPreview();
          setMessages((msg.messages ?? []).map((item) => snapshotMessageToMessage(item)).reverse());
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
    flushReplayMessages,
    handleReplayMessage,
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
