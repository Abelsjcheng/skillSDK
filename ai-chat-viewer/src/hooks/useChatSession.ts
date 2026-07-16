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
  serializeQuestionAnswerContent,
  snapshotMessageToMessage,
  updateLatestPart,
} from '../utils/message';
import {
  getSessionMessageHistory,
  registerSessionListener,
  sendMessage as sendMessageApi,
  sendMessageToIM,
  sendWebSocketMessage,
  stopSkill,
  unregisterSessionListener,
} from '../utils/hwext';
import { copyTextToClipboard } from '../utils/clipboard';
import { WeLog } from '../utils/logger';
import { hasMoreHistoryByCursor } from '../utils/session';
import { reportFlowTelemetry } from '../utils/telemetry';
import { showToast } from '../utils/toast';
import type {
  HiddenQuestionAnswerUserMessage,
  SendUserMessageOptions,
} from '../types/components';
import type { UseChatSessionOptions, UseChatSessionResult } from '../types/hooks/chatSession';
import { reportSendMessageClick } from '../utils/uemUtil';
import { normalizeSlashCommands } from '../utils/slashCommand';
import type { SlashCommandItem } from '../types/slashCommand';

const HISTORY_PAGE_SIZE = 20;
const MESSAGE_COPY_TOAST_OPTIONS = { toastClassName: 'toast toast--message-copy' } as const;

function resolveTelemetryPage(mode: UseChatSessionOptions['mode']): 'weAgentCUI' | 'skillCUI' {
  return mode === 'skillCUI' ? 'skillCUI' : 'weAgentCUI';
}

function collectKnownUserMessageIds(messages: Message[], suppressedMessageIds: Set<string>): Set<string> {
  const ids = collectUserMessageIds(messages);
  suppressedMessageIds.forEach((id) => ids.add(id));
  return ids;
}

function collectQuestionAnswerOutputs(message: Message): Set<string> {
  const outputs = new Set<string>();
  if (normalizeRole(message.role) !== 'assistant') {
    return outputs;
  }

  message.parts?.forEach((part) => {
    if (part.type !== 'question') {
      return;
    }

    const output = part.output?.trim();
    if (output) {
      outputs.add(output);
    }
  });

  return outputs;
}

function filterQuestionAnswerUserMessages(messages: Message[]): {
  messages: Message[];
  hiddenUserMessageIds: Set<string>;
} {
  const hiddenUserMessageIds = new Set<string>();
  const visibleMessages: Message[] = [];
  let pendingQuestionAnswerOutputs = new Set<string>();

  messages.forEach((message) => {
    const role = normalizeRole(message.role);
    const content = message.content.trim();

    if (role === 'user' && content && pendingQuestionAnswerOutputs.has(content)) {
      hiddenUserMessageIds.add(message.id);
      pendingQuestionAnswerOutputs.delete(content);
      return;
    }

    visibleMessages.push(message);

    if (role === 'assistant') {
      pendingQuestionAnswerOutputs = collectQuestionAnswerOutputs(message);
      return;
    }

    pendingQuestionAnswerOutputs = new Set<string>();
  });

  return {
    messages: visibleMessages,
    hiddenUserMessageIds,
  };
}

function optionalIdMatches(expected: string | undefined, actual: string | null | undefined): boolean {
  return !expected || !actual || expected === actual;
}

function findHiddenQuestionAnswerUserMessageIndex(
  messages: HiddenQuestionAnswerUserMessage[],
  msg: StreamMessage,
): number {
  const content = (msg.content ?? '').trim();
  if (!content) {
    return -1;
  }

  return messages.findIndex((message) => (
    message.content === content
    && optionalIdMatches(message.toolCallId, msg.toolCallId)
    && optionalIdMatches(message.questionId, msg.questionId)
    && optionalIdMatches(message.subagentSessionId, msg.subagentSessionId)
  ));
}

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
  assistantDetail,
  onSessionTitleChange,
  onSessionActivity,
  onSessionDeleted,
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
  const [slashCommands, setSlashCommands] = useState<SlashCommandItem[]>([]);

  const streamingAssemblersRef = useRef(new Map<string, StreamAssembler>());
  const latestStreamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const knownUserMessageIdsRef = useRef(new Set<string>());
  const suppressedUserMessageIdsRef = useRef(new Set<string>());
  const pendingHiddenQuestionAnswerUserMessagesRef = useRef<HiddenQuestionAnswerUserMessage[]>([]);
  const nextBeforeSeqRef = useRef<number | null>(null);
  const hasMoreHistoryRef = useRef(false);
  const isLoadingHistoryRef = useRef(false);
  const activeWelinkSessionIdRef = useRef<string | null>(welinkSessionId || null);
  const historyEpochRef = useRef(0);
  const agentOfflineHandledRef = useRef(false);
  const onSessionTitleChangeRef = useRef(onSessionTitleChange);
  const onSessionActivityRef = useRef(onSessionActivity);
  const onSessionDeletedRef = useRef(onSessionDeleted);
  const aiReplyFailedTextRef = useRef(tRef.current('weAgent.aiReplyFailed'));

  onSessionTitleChangeRef.current = onSessionTitleChange;
  onSessionActivityRef.current = onSessionActivity;
  onSessionDeletedRef.current = onSessionDeleted;
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
    suppressedUserMessageIdsRef.current.clear();
    pendingHiddenQuestionAnswerUserMessagesRef.current = [];
    nextBeforeSeqRef.current = null;
    hasMoreHistoryRef.current = false;
    isLoadingHistoryRef.current = false;
    setMessages([]);
    setHasMoreHistory(false);
    setIsLoadingHistory(false);
    setSessionStatus('idle');
    setSlashCommands([]);
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
          const combined = [...olderMessages.map((message) => ({ ...message, isHistory: true })), ...prev];
          const { messages: next, hiddenUserMessageIds } = filterQuestionAnswerUserMessages(combined);
          hiddenUserMessageIds.forEach((id) => suppressedUserMessageIdsRef.current.add(id));
          knownUserMessageIdsRef.current = collectKnownUserMessageIds(next, suppressedUserMessageIdsRef.current);
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
    displayContent?: string,
    options: SendUserMessageOptions = {},
  ) => {
    if (!welinkSessionId) {
      showToast(tRef.current('weAgent.sendMessageWithoutSessionFailed'));
      return null;
    }

    const trimmedContent = content.trim();
    const hiddenQuestionAnswerUserMessage = options.suppressUserBubble
      ? {
        content: trimmedContent,
        toolCallId,
        questionId,
        subagentSessionId,
      }
      : null;

    if (hiddenQuestionAnswerUserMessage) {
      pendingHiddenQuestionAnswerUserMessagesRef.current.push(hiddenQuestionAnswerUserMessage);
    }

    try {
      const result = await sendMessageApi({
        welinkSessionId,
        content: trimmedContent,
        ...(toolCallId ? { toolCallId } : {}),
        ...(subagentSessionId ? { subagentSessionId } : {}),
        ...(mode === 'skillCUI' ? { businessExtParam: { isSkillChat: false } } : {}),
      });

      // 发送成功后通知外层刷新会话活跃时间，驱动历史侧边栏即时重排。
      onSessionActivityRef.current?.(welinkSessionId, result.createdAt || new Date().toISOString());

      const userMessage = {
        ...messageOperationToMessage(result),
        ...(displayContent ? { content: displayContent } : {}),
      };

      if (options.suppressUserBubble) {
        suppressedUserMessageIdsRef.current.add(userMessage.id);
        knownUserMessageIdsRef.current.add(userMessage.id);
        showPendingAssistantPreview(welinkSessionId);
        setScrollToBottomSignal((prev) => prev + 1);
        return result;
      }

      setMessages((prev) => {
        if (prev.some((message) => message.id === userMessage.id)) {
          return prev;
        }
        const next = [...prev, userMessage];
        knownUserMessageIdsRef.current = collectKnownUserMessageIds(next, suppressedUserMessageIdsRef.current);
        return next;
      });
      setScrollToBottomSignal((prev) => prev + 1);
      return result;
    } finally {
      if (hiddenQuestionAnswerUserMessage) {
        const index = pendingHiddenQuestionAnswerUserMessagesRef.current.indexOf(hiddenQuestionAnswerUserMessage);
        if (index >= 0) {
          pendingHiddenQuestionAnswerUserMessagesRef.current.splice(index, 1);
        }
      }
    }
  }, [mode, showPendingAssistantPreview, welinkSessionId]);

  const handleQuestionAnswered = useCallback(async ({
    answer,
    displayContent,
    messageId,
    toolCallId,
    questionId,
    subagentSessionId,
  }: QuestionAnswerSubmission) => {
    setSessionStatus('busy');

    try {
      await sendUserMessage(
        serializeQuestionAnswerContent(answer),
        toolCallId,
        questionId,
        subagentSessionId,
        displayContent,
        { suppressUserBubble: true },
      );
    } catch (err) {
      WeLog(`useChatSession sendMessage failed | extra=${JSON.stringify({ mode, welinkSessionId, messageId, toolCallId, questionId, subagentSessionId })} | error=${JSON.stringify(err)}`);
      setSessionStatus('idle');
      showToast(tRef.current('weAgent.submitAnswerFailed'));
      throw err;
    }
  }, [mode, sendUserMessage, welinkSessionId]);

  useEffect(() => {
    activeWelinkSessionIdRef.current = welinkSessionId || null;
  }, [welinkSessionId]);

  useEffect(() => {
    messagesRef.current = messages;
    if (!welinkSessionId) {
      knownUserMessageIdsRef.current.clear();
      return;
    }
    knownUserMessageIdsRef.current = collectKnownUserMessageIds(messages, suppressedUserMessageIdsRef.current);
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
      const telemetryPage = resolveTelemetryPage(mode);

      // question / tool.update 完成或错误，可能是对历史消息的 part 的更新
      if (
        (msg.type === 'question' || msg.type === 'tool.update')
        && (msg.status === 'completed' || msg.status === 'error')
        && latestStreamingMsgIdRef.current != msg?.messageId
      ) {
        const partType = msg.type === 'question' ? 'question' : 'tool';
        const hasMatchingPart = messagesRef.current.some((message) =>
          message.parts?.some((part) => (
            part.type === partType
            && (
              (msg.partId != null && part.partId === msg.partId)
              && ((msg.toolCallId != null && part.toolCallId === msg.toolCallId) || (msg.questionId != null && part.questionId === msg.questionId))
            )
          )),
        );

        if (hasMatchingPart) {
          setMessages((prev) => updateLatestPart(
            prev,
            partType,
            (part) => (
              (msg.partId != null && part.partId === msg.partId)
              && ((msg.toolCallId != null && part.toolCallId === msg.toolCallId) || (msg.questionId != null && part.questionId === msg.questionId))
            ),
            (part) => ({
              ...part,
              // 对 question 标记为已回答
              ...(partType === 'question' ? { answered: true } : {}),
              output: msg.output ?? part.output,
              status: (msg.status === 'completed' || msg.status === 'error') ? msg.status : part.status,
              isStreaming: false,
            }),
          ));
          return;
        }
      }

      switch (msg.type) {
        case 'slash_commands_result':
          setSlashCommands(normalizeSlashCommands(msg.slashCommands ?? []));
          break;
        case 'session.deleted':
          onSessionDeletedRef.current?.(activeWelinkSessionId);
          break;
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
          window.requestAnimationFrame(() => {
            hidePendingAssistantPreview();
          });
          if (msg.type === 'text.done') {
            WeLog(`useChatSession onMessage text.done | extra=${JSON.stringify({
              welinkSessionId: activeWelinkSessionId,
              messageId,
              content: (currentText || msg.content || '')?.slice(-50),
            })}`, 'info');
          }
          break;
        }
        case 'message.user': {
          const nextMessage = buildUserMessage(msg);
          if (!nextMessage) {
            break;
          }

          const hiddenQuestionAnswerIndex = findHiddenQuestionAnswerUserMessageIndex(
            pendingHiddenQuestionAnswerUserMessagesRef.current,
            msg,
          );
          const shouldSuppressUserMessage = hiddenQuestionAnswerIndex >= 0
            || suppressedUserMessageIdsRef.current.has(nextMessage.id);

          finalizeStreamingMessage();
          setSessionStatus('busy');

          if (shouldSuppressUserMessage) {
            if (hiddenQuestionAnswerIndex >= 0) {
              pendingHiddenQuestionAnswerUserMessagesRef.current.splice(hiddenQuestionAnswerIndex, 1);
            }
            suppressedUserMessageIdsRef.current.add(nextMessage.id);
            knownUserMessageIdsRef.current.add(nextMessage.id);
            showPendingAssistantPreview(activeWelinkSessionIdRef.current);
            break;
          }

          setMessages((prev) => {
            if (
              knownUserMessageIdsRef.current.has(nextMessage.id)
              || suppressedUserMessageIdsRef.current.has(nextMessage.id)
            ) {
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
          break;
        case 'session.status':
          if (msg.sessionStatus === 'idle') {
            finalizeStreamingMessageById(latestStreamingMsgIdRef.current);
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
          void reportFlowTelemetry('flow_onmessage_error', 'onMessage 错误', {
            type: 'error',
            page: telemetryPage,
            welinkSessionId: activeWelinkSessionId,
            messageId: msg.messageId ?? undefined,
            subagentSessionId: msg.subagentSessionId ?? undefined,
            messageType: msg.type,
            errorMessage: msg.error ?? undefined,
          });
          appendAssistantErrorBlock(msg.error ?? '', aiReplyFailedTextRef.current);
          break;
        case 'snapshot':
          streamingAssemblersRef.current.clear();
          latestStreamingMsgIdRef.current = null;
          hidePendingAssistantPreview();
          setMessages((msg.messages ?? []).map((item) => snapshotMessageToMessage(item)).reverse());
          break;
        case 'streaming': {
          setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
          const messageId = msg.messageId;
          if (!messageId || !msg.parts || msg.parts.length === 0) {
            break;
          }

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
      void reportFlowTelemetry('flow_onmessage_error', 'onMessage 错误', {
        type: 'error',
        page: resolveTelemetryPage(mode),
        welinkSessionId,
        errorCode: String(err.code ?? err.errorCode ?? ''),
        errorMessage: err.message ?? err.errorMessage ?? '',
      });
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
        const { messages: visibleMessages, hiddenUserMessageIds } = filterQuestionAnswerUserMessages(mapped);
        hiddenUserMessageIds.forEach((id) => suppressedUserMessageIdsRef.current.add(id));
        setMessages(visibleMessages);
        knownUserMessageIdsRef.current = collectKnownUserMessageIds(visibleMessages, suppressedUserMessageIdsRef.current);
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
    finalizeStreamingMessageById,
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
    reportSendMessageClick(resolveTelemetryPage(mode), welinkSessionId, content, assistantDetail);
    try {
      await sendUserMessage(content);
    } catch (err) {
      setSessionStatus('idle');
      showToast(tRef.current('weAgent.sendMessageFailed'));
      WeLog(`useChatSession sendMessage failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    }
  }, [assistantDetail, mode, sendUserMessage, welinkSessionId]);

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
    } catch (err) {
      WeLog(`useChatSession sendMessageToIM failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
    }
  }, [mode, welinkSessionId]);

  const onRequestSlashCommands = useCallback(async () => {
    if (!welinkSessionId) return;

    try {
      await sendWebSocketMessage({
        message: JSON.stringify({
          action: 'query_slash_commands',
          welinkSessionId,
        }),
      });
    } catch (err) {
      WeLog(`useChatSession sendWebSocketMessage failed | extra=${JSON.stringify({ mode, welinkSessionId, action: 'query_slash_commands' })} | error=${JSON.stringify(err)}`);
      throw err;
    }
  }, [mode, welinkSessionId]);

  const onCopy = useCallback(async (content: string) => {
    try {
      await copyTextToClipboard(content);
      if (mode !== 'skillCUI') {
        showToast(tRef.current('common.copySuccess'), MESSAGE_COPY_TOAST_OPTIONS);
      }
    } catch (err) {
      WeLog(`useChatSession copy failed | extra=${JSON.stringify({ mode, welinkSessionId })} | error=${JSON.stringify(err)}`);
      if (mode !== 'skillCUI') {
        showToast(tRef.current('common.copyFailed'), MESSAGE_COPY_TOAST_OPTIONS);
      }
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
    slashCommands,
    onLoadMoreHistory: loadMoreHistory,
    onRequestSlashCommands,
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
    slashCommands,
    welinkSessionId,
    onRequestSlashCommands,
  ]);
}
