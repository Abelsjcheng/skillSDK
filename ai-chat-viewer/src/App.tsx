
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import Content from './components/Content';
import Footer from './components/Footer';
import {
  AgentStatus,
  ChatMessage,
  ChatMessagePart,
  Hwh5Ext,
  PermissionResponse,
  RegisterSessionListenerParams,
  SessionMessage,
  SessionMessagePart,
  SessionStatus,
  SnapshotMessage,
  StreamMessage,
  StreamingPart,
} from './types';
import './styles/App.less';

const DEFAULT_TITLE = 'OpenCode AI 助手';
const HISTORY_PAGE_SIZE = 50;
const MAX_SEQ_CACHE_SIZE = 5000;

let localIdSeed = 0;

function createLocalId(prefix: string = 'msg'): string {
  localIdSeed += 1;
  return `${prefix}-${Date.now()}-${localIdSeed}`;
}

function parseSessionIdFromUrl(): number | null {
  const candidates = [window.location.search];
  if (window.location.hash.includes('?')) {
    candidates.push(window.location.hash.slice(window.location.hash.indexOf('?')));
  }

  for (let i = 0; i < candidates.length; i += 1) {
    const params = new URLSearchParams(candidates[i]);
    const value = params.get('welinkSessionId');
    if (!value) continue;

    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function formatErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as {
      errorMessage?: string;
      message?: string;
      errorCode?: number;
    };

    if (maybeError.errorMessage) {
      return maybeError.errorCode
        ? `${fallback} (${maybeError.errorCode}): ${maybeError.errorMessage}`
        : `${fallback}: ${maybeError.errorMessage}`;
    }

    if (maybeError.message) {
      return `${fallback}: ${maybeError.message}`;
    }
  }

  return fallback;
}

function normalizeSessionStatus(status?: string): SessionStatus {
  if (status === 'busy' || status === 'idle' || status === 'retry') {
    return status;
  }
  return 'unknown';
}

function normalizeRole(role?: string): 'user' | 'assistant' | 'system' | 'tool' {
  if (role === 'user' || role === 'assistant' || role === 'system' || role === 'tool') {
    return role;
  }
  return 'assistant';
}

function normalizePartType(type?: string): 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file' {
  if (type === 'text' || type === 'thinking' || type === 'tool' || type === 'question' || type === 'permission' || type === 'file') {
    return type;
  }
  return 'text';
}

function normalizeToolStatus(status?: string): 'pending' | 'running' | 'completed' | 'error' {
  if (status === 'pending' || status === 'running' || status === 'completed' || status === 'error') {
    return status;
  }
  return 'pending';
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const aSeq = typeof a.messageSeq === 'number' ? a.messageSeq : Number.MAX_SAFE_INTEGER;
  const bSeq = typeof b.messageSeq === 'number' ? b.messageSeq : Number.MAX_SAFE_INTEGER;

  if (aSeq !== bSeq) {
    return aSeq - bSeq;
  }

  const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.MAX_SAFE_INTEGER;
  const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return a.localId.localeCompare(b.localId);
}

function sortParts(parts: ChatMessagePart[]): ChatMessagePart[] {
  return parts.slice().sort((a, b) => {
    const aSeq = typeof a.partSeq === 'number' ? a.partSeq : Number.MAX_SAFE_INTEGER;
    const bSeq = typeof b.partSeq === 'number' ? b.partSeq : Number.MAX_SAFE_INTEGER;

    if (aSeq !== bSeq) {
      return aSeq - bSeq;
    }

    return a.partId.localeCompare(b.partId);
  });
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice().sort(compareMessages);
}

function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    parts: message.parts.map((part) => ({
      ...part,
      toolInput: part.toolInput ? { ...part.toolInput } : undefined,
      metadata: part.metadata ? { ...part.metadata } : undefined,
      options: part.options ? [...part.options] : undefined,
    })),
    meta: message.meta ? { ...message.meta } : undefined,
  };
}

function aggregateMessageContent(parts: ChatMessagePart[], fallback: string): string {
  const orderedParts = sortParts(parts);
  let text = '';

  for (let i = 0; i < orderedParts.length; i += 1) {
    if (orderedParts[i].type === 'text' && orderedParts[i].content) {
      text += orderedParts[i].content;
    }
  }

  if (text.trim()) {
    return text;
  }

  const summary: string[] = [];
  for (let i = 0; i < orderedParts.length; i += 1) {
    const part = orderedParts[i];

    if (part.type === 'question' && (part.question || part.content)) {
      summary.push(part.question ?? part.content);
    }

    if (part.type === 'permission' && part.content) {
      summary.push(part.content);
    }

    if (part.type === 'file' && (part.fileName || part.fileUrl)) {
      summary.push(part.fileName ?? part.fileUrl ?? '文件');
    }

    if (part.type === 'tool' && part.toolOutput) {
      summary.push(part.toolOutput);
    }
  }

  if (summary.length > 0) {
    return summary.join('\n');
  }

  return fallback;
}
function recalculateMessage(message: ChatMessage): ChatMessage {
  const sorted = sortParts(message.parts);
  const hasStreaming = sorted.some((part) => part.isStreaming);
  const awaitingQuestion = sorted.some((part) => part.type === 'question' && !part.answered);
  const awaitingPermission = sorted.some((part) => part.type === 'permission' && !part.permResolved);
  const awaitingUserAction = awaitingQuestion || awaitingPermission;

  const completed =
    message.role === 'user'
      ? true
      : !hasStreaming && !awaitingUserAction && !message.stepRunning;

  return {
    ...message,
    parts: sorted,
    content: aggregateMessageContent(sorted, message.content),
    isStreaming: hasStreaming,
    awaitingUserAction,
    completed,
  };
}

function findMessageIndexByIdentity(messages: ChatMessage[], event: StreamMessage): number {
  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i];

    if (
      typeof event.messageSeq === 'number' &&
      typeof current.messageSeq === 'number' &&
      current.messageSeq === event.messageSeq
    ) {
      return i;
    }

    if (
      event.messageId !== undefined &&
      current.messageId !== undefined &&
      String(current.messageId) === String(event.messageId)
    ) {
      return i;
    }
  }

  return -1;
}

function patchMessageIdentity(message: ChatMessage, event: StreamMessage, defaultRole: 'user' | 'assistant' | 'system' | 'tool'): void {
  if (event.messageId !== undefined) {
    message.messageId = event.messageId;
  }
  if (typeof event.messageSeq === 'number') {
    message.messageSeq = event.messageSeq;
  }
  message.role = normalizeRole(event.role ?? defaultRole);
}

function createMessageFromEvent(event: StreamMessage, defaultRole: 'user' | 'assistant' | 'system' | 'tool'): ChatMessage {
  const role = normalizeRole(event.role ?? defaultRole);
  return {
    localId: createLocalId(role),
    messageId: event.messageId,
    messageSeq: typeof event.messageSeq === 'number' ? event.messageSeq : undefined,
    role,
    content: event.content ?? '',
    createdAt: event.emittedAt,
    parts: [],
    completed: role === 'user',
    isStreaming: false,
    awaitingUserAction: false,
    stepRunning: false,
  };
}

function resolvePartId(
  event: StreamMessage,
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file',
): string {
  if (event.partId) {
    return String(event.partId);
  }

  if (typeof event.partSeq === 'number') {
    return `${type}:${event.partSeq}`;
  }

  if (type === 'tool' && event.toolCallId) {
    return `tool:${event.toolCallId}`;
  }

  if (type === 'question' && event.toolCallId) {
    return `question:${event.toolCallId}`;
  }

  if (type === 'permission' && event.permissionId) {
    return `permission:${event.permissionId}`;
  }

  if (type === 'file' && event.fileUrl) {
    return `file:${event.fileUrl}`;
  }

  return `${type}:main`;
}

function upsertPart(
  message: ChatMessage,
  partId: string,
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file',
  partSeq?: number,
): ChatMessagePart {
  let index = -1;
  for (let i = 0; i < message.parts.length; i += 1) {
    if (message.parts[i].partId === partId) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    const created: ChatMessagePart = {
      partId,
      partSeq,
      type,
      content: '',
      isStreaming: false,
    };
    message.parts.push(created);
    return created;
  }

  const existing = { ...message.parts[index] };
  if (typeof partSeq === 'number' && typeof existing.partSeq !== 'number') {
    existing.partSeq = partSeq;
  }
  message.parts[index] = existing;
  return existing;
}

function updateMessageWithEvent(
  messages: ChatMessage[],
  event: StreamMessage,
  defaultRole: 'user' | 'assistant' | 'system' | 'tool',
  updater: (message: ChatMessage) => void,
): ChatMessage[] {
  const next = messages.slice();
  let targetIndex = findMessageIndexByIdentity(next, event);

  if (targetIndex === -1) {
    next.push(createMessageFromEvent(event, defaultRole));
    targetIndex = next.length - 1;
  } else {
    next[targetIndex] = cloneMessage(next[targetIndex]);
  }

  const target = next[targetIndex];
  patchMessageIdentity(target, event, defaultRole);
  updater(target);
  next[targetIndex] = recalculateMessage(target);

  return sortMessages(next);
}

function applyTextOrThinkingEvent(
  messages: ChatMessage[],
  event: StreamMessage,
  type: 'text' | 'thinking',
  done: boolean,
): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const partId = resolvePartId(event, type);
    const part = upsertPart(message, partId, type, event.partSeq);

    if (done) {
      if (event.content !== undefined) {
        part.content = event.content;
      }
      part.isStreaming = false;
    } else {
      part.content += event.content ?? '';
      part.isStreaming = true;
    }

    message.content = aggregateMessageContent(message.parts, message.content);
  });
}

function applyToolUpdateEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const partId = resolvePartId(event, 'tool');
    const part = upsertPart(message, partId, 'tool', event.partSeq);
    const status = normalizeToolStatus(event.status);

    part.toolName = event.toolName ?? part.toolName;
    part.toolCallId = event.toolCallId ?? part.toolCallId;
    part.toolStatus = status;
    part.toolInput = event.input ?? part.toolInput;
    part.toolOutput = event.output ?? part.toolOutput;
    part.toolTitle = event.title ?? part.toolTitle;
    part.content = event.error ?? part.content;
    part.isStreaming = status === 'pending' || status === 'running';

    if (event.output && !part.content) {
      part.content = event.output;
    }

    message.content = aggregateMessageContent(message.parts, message.content);
  });
}
function applyQuestionEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const partId = resolvePartId(event, 'question');
    const part = upsertPart(message, partId, 'question', event.partSeq);

    part.toolName = event.toolName ?? part.toolName;
    part.toolCallId = event.toolCallId ?? part.toolCallId;
    part.header = event.header ?? part.header;
    part.question = event.question ?? part.question;
    part.options = event.options ? [...event.options] : part.options;
    part.content = event.question ?? event.content ?? part.content;
    part.isStreaming = false;
    if (typeof part.answered !== 'boolean') {
      part.answered = false;
    }

    message.content = aggregateMessageContent(message.parts, message.content);
  });
}

function applyPermissionAskEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const partId = resolvePartId(event, 'permission');
    const part = upsertPart(message, partId, 'permission', event.partSeq);

    part.permissionId = event.permissionId ?? part.permissionId;
    part.permType = event.permType ?? part.permType;
    part.toolName = event.toolName ?? part.toolName;
    part.metadata = event.metadata ? { ...event.metadata } : part.metadata;
    part.content = event.content ?? event.title ?? part.content;
    part.permResolved = false;
    part.response = undefined;
    part.isStreaming = false;

    message.content = aggregateMessageContent(message.parts, message.content);
  });
}

function applyPermissionReplyEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  if (!event.permissionId) {
    return messages;
  }

  let updated = false;
  const next = messages.map((current) => {
    let changed = false;
    const nextParts = current.parts.map((part) => {
      if (part.type === 'permission' && part.permissionId === event.permissionId) {
        changed = true;
        updated = true;
        return {
          ...part,
          permResolved: true,
          response: event.response,
          isStreaming: false,
        };
      }
      return part;
    });

    if (!changed) {
      return current;
    }

    return recalculateMessage({
      ...current,
      parts: nextParts,
    });
  });

  if (updated) {
    return sortMessages(next);
  }

  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const partId = resolvePartId(event, 'permission');
    const part = upsertPart(message, partId, 'permission', event.partSeq);

    part.permissionId = event.permissionId;
    part.permResolved = true;
    part.response = event.response;
    part.isStreaming = false;
    if (!part.content) {
      part.content = '权限请求已处理';
    }

    message.content = aggregateMessageContent(message.parts, message.content);
  });
}

function applyFileEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const partId = resolvePartId(event, 'file');
    const part = upsertPart(message, partId, 'file', event.partSeq);

    part.fileName = event.fileName ?? event.title ?? part.fileName;
    part.fileUrl = event.fileUrl ?? event.content ?? part.fileUrl;
    part.fileMime = event.fileMime ?? part.fileMime;
    part.content = part.fileName ?? part.fileUrl ?? part.content;
    part.isStreaming = false;

    message.content = aggregateMessageContent(message.parts, message.content);
  });
}

function applyStepStartEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    message.stepRunning = true;
  });
}

function applyStepDoneEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    message.stepRunning = false;
    message.meta = {
      ...message.meta,
      tokens: event.tokens,
      cost: event.cost,
      reason: event.reason,
    };
  });
}

function finalizeStreamingMessages(messages: ChatMessage[]): ChatMessage[] {
  const finalized = messages.map((current) => {
    if (!current.isStreaming && !current.stepRunning) {
      return current;
    }

    const nextParts = current.parts.map((part) => {
      if (!part.isStreaming) {
        return part;
      }
      return {
        ...part,
        isStreaming: false,
      };
    });

    return recalculateMessage({
      ...current,
      stepRunning: false,
      parts: nextParts,
    });
  });

  return sortMessages(finalized);
}

function mapHistoryPart(part: SessionMessagePart, index: number, forceCompleted: boolean): ChatMessagePart {
  const type = normalizePartType(part.type);
  const mapped: ChatMessagePart = {
    partId: part.partId ? String(part.partId) : `history-part-${index}`,
    partSeq: part.partSeq,
    type,
    content: part.content ?? '',
    isStreaming: false,
  };

  if (type === 'tool') {
    mapped.toolName = part.toolName;
    mapped.toolCallId = part.toolCallId;
    mapped.toolStatus = normalizeToolStatus(part.toolStatus);
    mapped.toolInput = part.toolInput;
    mapped.toolOutput = part.toolOutput;
    mapped.toolTitle = part.content;
  }

  if (type === 'question') {
    mapped.header = part.header;
    mapped.question = part.question;
    mapped.options = part.options ? [...part.options] : undefined;
    mapped.toolCallId = part.toolCallId;
    mapped.answered = forceCompleted;
    if (!mapped.content) {
      mapped.content = part.question ?? '';
    }
  }

  if (type === 'permission') {
    mapped.permissionId = part.permissionId;
    mapped.permType = part.permType;
    mapped.response = part.response;
    mapped.permResolved = forceCompleted || Boolean(part.response);
  }

  if (type === 'file') {
    mapped.fileName = part.fileName;
    mapped.fileUrl = part.fileUrl;
    mapped.fileMime = part.fileMime;
    if (!mapped.content) {
      mapped.content = part.fileName ?? part.fileUrl ?? '';
    }
  }

  return mapped;
}
function normalizeHistoryMessage(message: SessionMessage, index: number, forceCompleted: boolean): ChatMessage {
  const parts = Array.isArray(message.parts)
    ? message.parts.map((part, partIndex) => mapHistoryPart(part, partIndex, forceCompleted))
    : [];

  const normalized: ChatMessage = {
    localId: createLocalId('history'),
    messageId: message.id,
    messageSeq: message.messageSeq,
    role: normalizeRole(message.role),
    content: message.content ?? '',
    createdAt: message.createdAt,
    parts,
    completed: forceCompleted || normalizeRole(message.role) === 'user',
    isStreaming: false,
    awaitingUserAction: false,
    stepRunning: false,
  };

  return recalculateMessage(normalized);
}

function normalizeHistoryMessages(messages: SessionMessage[]): ChatMessage[] {
  const normalized: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    normalized.push(normalizeHistoryMessage(messages[i], i, false));
  }
  return sortMessages(normalized);
}

function normalizeSnapshotMessages(messages: SnapshotMessage[]): ChatMessage[] {
  const converted: ChatMessage[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const item = messages[i];
    const wrapped: SessionMessage = {
      id: item.id,
      messageSeq: item.seq,
      role: item.role,
      content: item.content,
      createdAt: item.createdAt,
      parts: item.parts,
    };

    converted.push(normalizeHistoryMessage(wrapped, i, true));
  }

  return sortMessages(converted);
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const next = existing.slice();

  for (let i = 0; i < incoming.length; i += 1) {
    const candidate = incoming[i];

    let found = -1;
    for (let j = 0; j < next.length; j += 1) {
      const current = next[j];
      if (
        (typeof candidate.messageSeq === 'number' && typeof current.messageSeq === 'number' && candidate.messageSeq === current.messageSeq) ||
        (candidate.messageId !== undefined && current.messageId !== undefined && String(candidate.messageId) === String(current.messageId))
      ) {
        found = j;
        break;
      }
    }

    if (found >= 0) {
      next[found] = candidate;
    } else {
      next.push(candidate);
    }
  }

  return sortMessages(next);
}

function mapStreamingPart(part: StreamingPart, index: number): ChatMessagePart {
  const type = normalizePartType(part.type);
  const partId = part.partId ? String(part.partId) : `streaming-part-${index}`;

  const mapped: ChatMessagePart = {
    partId,
    partSeq: part.partSeq,
    type,
    content: part.content ?? '',
    isStreaming: type === 'text' || type === 'thinking',
  };

  if (type === 'tool') {
    const status = normalizeToolStatus(part.status);
    mapped.toolName = part.toolName;
    mapped.toolCallId = part.toolCallId;
    mapped.toolStatus = status;
    mapped.isStreaming = status === 'pending' || status === 'running';
  }

  if (type === 'question') {
    mapped.header = part.header;
    mapped.question = part.question;
    mapped.options = part.options ? [...part.options] : undefined;
    mapped.toolCallId = part.toolCallId;
    mapped.answered = false;
    mapped.isStreaming = false;
    if (!mapped.content) {
      mapped.content = part.question ?? '';
    }
  }

  if (type === 'permission') {
    mapped.permissionId = part.permissionId;
    mapped.permType = part.permType;
    mapped.permResolved = false;
    mapped.isStreaming = false;
  }

  if (type === 'file') {
    mapped.fileName = part.fileName;
    mapped.fileUrl = part.fileUrl;
    mapped.fileMime = part.fileMime;
    mapped.isStreaming = false;
    if (!mapped.content) {
      mapped.content = part.fileName ?? part.fileUrl ?? '';
    }
  }

  return mapped;
}

function applyStreamingRecoveryEvent(messages: ChatMessage[], event: StreamMessage): ChatMessage[] {
  return updateMessageWithEvent(messages, event, 'assistant', (message) => {
    const parts = Array.isArray(event.parts)
      ? event.parts.map((part, index) => mapStreamingPart(part, index))
      : [];

    message.parts = parts;
    message.stepRunning = true;
    message.content = aggregateMessageContent(parts, message.content);
  });
}

function markQuestionAnswered(
  messages: ChatMessage[],
  messageLocalId: string,
  partId: string,
): ChatMessage[] {
  const next = messages.slice();
  const index = next.findIndex((item) => item.localId === messageLocalId);
  if (index < 0) {
    return messages;
  }

  const cloned = cloneMessage(next[index]);
  let changed = false;

  cloned.parts = cloned.parts.map((part) => {
    if (part.partId === partId && part.type === 'question' && !part.answered) {
      changed = true;
      return {
        ...part,
        answered: true,
      };
    }
    return part;
  });

  if (!changed) {
    return messages;
  }

  next[index] = recalculateMessage(cloned);
  return sortMessages(next);
}

function setPermissionReply(
  messages: ChatMessage[],
  messageLocalId: string,
  partId: string,
  response: PermissionResponse,
): ChatMessage[] {
  const next = messages.slice();
  const index = next.findIndex((item) => item.localId === messageLocalId);
  if (index < 0) {
    return messages;
  }

  const cloned = cloneMessage(next[index]);
  let changed = false;

  cloned.parts = cloned.parts.map((part) => {
    if (part.partId === partId && part.type === 'permission') {
      changed = true;
      return {
        ...part,
        permResolved: true,
        response,
      };
    }
    return part;
  });

  if (!changed) {
    return messages;
  }

  next[index] = recalculateMessage(cloned);
  return sortMessages(next);
}

function App() {
  const welinkSessionId = useMemo(parseSessionIdFromUrl, []);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('unknown');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('unknown');
  const [initializing, setInitializing] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [hwh5Ready, setHwh5Ready] = useState(false);

  const [sendingToIMMessageId, setSendingToIMMessageId] = useState<string | null>(null);
  const [replyingPermissionPartId, setReplyingPermissionPartId] = useState<string | null>(null);
  const [answeringQuestionPartId, setAnsweringQuestionPartId] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const hwh5Ref = useRef<Hwh5Ext | null>(null);
  const listenerRef = useRef<RegisterSessionListenerParams | null>(null);

  const historyLoadingRef = useRef(false);
  const bufferedEventsRef = useRef<StreamMessage[]>([]);

  const realtimeQueueRef = useRef<StreamMessage[]>([]);
  const realtimeTimerRef = useRef<number | null>(null);

  const seenSeqSetRef = useRef<Set<number>>(new Set());
  const seenSeqQueueRef = useRef<number[]>([]);

  const destroyedRef = useRef(false);
  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [feedback]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages]);

  const showFeedback = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedback({ message, type });
  }, []);

  const isGenerating = useMemo(() => {
    if (sessionStatus === 'busy') {
      return true;
    }

    return messages.some((message) => message.isStreaming || message.stepRunning);
  }, [messages, sessionStatus]);

  const shouldProcessBySeq = useCallback((event: StreamMessage): boolean => {
    if (typeof event.seq !== 'number') {
      return true;
    }

    if (seenSeqSetRef.current.has(event.seq)) {
      return false;
    }

    seenSeqSetRef.current.add(event.seq);
    seenSeqQueueRef.current.push(event.seq);

    if (seenSeqQueueRef.current.length > MAX_SEQ_CACHE_SIZE) {
      const oldest = seenSeqQueueRef.current.shift();
      if (typeof oldest === 'number') {
        seenSeqSetRef.current.delete(oldest);
      }
    }

    return true;
  }, []);

  const handleStreamEvent = useCallback((event: StreamMessage) => {
    const type = event.type;
    if (!type) {
      return;
    }

    if (event.welinkSessionId !== undefined && welinkSessionId !== null) {
      const incomingSessionId = Number(event.welinkSessionId);
      if (Number.isFinite(incomingSessionId) && incomingSessionId !== welinkSessionId) {
        return;
      }
    }

    if (type === 'text.delta') {
      setMessages((prev) => applyTextOrThinkingEvent(prev, event, 'text', false));
      return;
    }

    if (type === 'text.done') {
      setMessages((prev) => applyTextOrThinkingEvent(prev, event, 'text', true));
      return;
    }

    if (type === 'thinking.delta') {
      setMessages((prev) => applyTextOrThinkingEvent(prev, event, 'thinking', false));
      return;
    }

    if (type === 'thinking.done') {
      setMessages((prev) => applyTextOrThinkingEvent(prev, event, 'thinking', true));
      return;
    }

    if (type === 'tool.update') {
      setMessages((prev) => applyToolUpdateEvent(prev, event));
      return;
    }

    if (type === 'question') {
      setMessages((prev) => applyQuestionEvent(prev, event));
      return;
    }

    if (type === 'permission.ask') {
      setMessages((prev) => applyPermissionAskEvent(prev, event));
      return;
    }

    if (type === 'permission.reply') {
      setMessages((prev) => applyPermissionReplyEvent(prev, event));
      return;
    }

    if (type === 'file') {
      setMessages((prev) => applyFileEvent(prev, event));
      return;
    }

    if (type === 'step.start') {
      setMessages((prev) => applyStepStartEvent(prev, event));
      return;
    }

    if (type === 'step.done') {
      setMessages((prev) => applyStepDoneEvent(prev, event));
      return;
    }

    if (type === 'session.status') {
      const nextStatus = normalizeSessionStatus(event.sessionStatus);
      setSessionStatus(nextStatus);
      if (nextStatus === 'idle') {
        setMessages((prev) => finalizeStreamingMessages(prev));
      }
      return;
    }

    if (type === 'session.title') {
      if (event.title) {
        setTitle(event.title);
      }
      return;
    }

    if (type === 'session.error') {
      setSessionStatus('idle');
      setErrorMessage(event.error ?? '会话发生异常');
      return;
    }

    if (type === 'agent.online') {
      setAgentStatus('online');
      return;
    }

    if (type === 'agent.offline') {
      setAgentStatus('offline');
      setErrorMessage('Agent 已离线');
      return;
    }

    if (type === 'snapshot') {
      const snapshots = Array.isArray(event.messages) ? event.messages : [];
      const snapshotMessages = normalizeSnapshotMessages(snapshots);
      setMessages((prev) => mergeMessages(prev, snapshotMessages));
      return;
    }

    if (type === 'streaming') {
      setMessages((prev) => applyStreamingRecoveryEvent(prev, event));
      setSessionStatus(normalizeSessionStatus(event.sessionStatus ?? 'busy'));
      return;
    }

    if (type === 'error') {
      setSessionStatus('idle');
      setMessages((prev) => finalizeStreamingMessages(prev));
      setErrorMessage(event.error ?? '流式连接异常');
    }
  }, [welinkSessionId]);

  const processEventBatch = useCallback((events: StreamMessage[]) => {
    const ordered = events.slice().sort((a, b) => {
      const aSeq = typeof a.seq === 'number' ? a.seq : Number.MAX_SAFE_INTEGER;
      const bSeq = typeof b.seq === 'number' ? b.seq : Number.MAX_SAFE_INTEGER;
      return aSeq - bSeq;
    });

    for (let i = 0; i < ordered.length; i += 1) {
      const event = ordered[i];
      if (!shouldProcessBySeq(event)) {
        continue;
      }
      handleStreamEvent(event);
    }
  }, [handleStreamEvent, shouldProcessBySeq]);

  const enqueueRealtimeEvent = useCallback((event: StreamMessage) => {
    realtimeQueueRef.current.push(event);

    if (realtimeTimerRef.current !== null) {
      return;
    }

    realtimeTimerRef.current = window.setTimeout(() => {
      realtimeTimerRef.current = null;
      const batch = realtimeQueueRef.current.splice(0, realtimeQueueRef.current.length);
      processEventBatch(batch);
    }, 20);
  }, [processEventBatch]);
  useEffect(() => {
    destroyedRef.current = false;
    bufferedEventsRef.current = [];
    realtimeQueueRef.current = [];
    seenSeqSetRef.current.clear();
    seenSeqQueueRef.current = [];

    if (welinkSessionId === null) {
      setInitializing(false);
      setHistoryLoading(false);
      setHwh5Ready(false);
      setSessionStatus('unknown');
      setErrorMessage('URL 缺少有效的 welinkSessionId，无法初始化会话');
      return () => {
        destroyedRef.current = true;
      };
    }

    const hwh5 = window.HWH5EXT;
    if (!hwh5) {
      setInitializing(false);
      setHistoryLoading(false);
      setHwh5Ready(false);
      setSessionStatus('unknown');
      setErrorMessage('window.HWH5EXT 不可用，无法调用小程序 JSAPI');
      return () => {
        destroyedRef.current = true;
      };
    }

    hwh5Ref.current = hwh5;
    setHwh5Ready(true);
    setInitializing(true);
    setHistoryLoading(true);
    setErrorMessage(null);
    setAgentStatus('unknown');
    setSessionStatus('unknown');

    historyLoadingRef.current = true;

    const onMessage = (message: StreamMessage) => {
      if (historyLoadingRef.current) {
        bufferedEventsRef.current.push(message);
        return;
      }
      enqueueRealtimeEvent(message);
    };

    const onError = (error: { errorCode?: number; errorMessage?: string }) => {
      setErrorMessage(formatErrorMessage(error, '监听异常'));
    };

    const onClose = (reason?: string) => {
      setErrorMessage(reason ? `监听已关闭: ${reason}` : '监听已关闭');
    };

    const listener: RegisterSessionListenerParams = {
      welinkSessionId,
      onMessage,
      onError,
      onClose,
    };

    listenerRef.current = listener;

    const initialize = async () => {
      try {
        await Promise.resolve(hwh5.registerSessionListener(listener));

        const history: SessionMessage[] = [];
        let page = 0;
        let total = Number.MAX_SAFE_INTEGER;

        while (history.length < total) {
          const result = await hwh5.getSessionMessage({
            welinkSessionId,
            page,
            size: HISTORY_PAGE_SIZE,
          });

          const pageContent = Array.isArray(result.content) ? result.content : [];
          history.push(...pageContent);

          if (typeof result.total === 'number') {
            total = result.total;
          }

          if (pageContent.length === 0 || pageContent.length < HISTORY_PAGE_SIZE) {
            break;
          }

          page += 1;
        }

        if (destroyedRef.current) {
          return;
        }

        setMessages(normalizeHistoryMessages(history));

        historyLoadingRef.current = false;
        setHistoryLoading(false);

        const buffered = bufferedEventsRef.current.splice(0, bufferedEventsRef.current.length);
        processEventBatch(buffered);

        setSessionStatus((prev) => (prev === 'unknown' ? 'idle' : prev));
        setInitializing(false);
      } catch (error) {
        if (destroyedRef.current) {
          return;
        }

        historyLoadingRef.current = false;
        setHistoryLoading(false);
        setInitializing(false);
        setSessionStatus('idle');
        setErrorMessage(formatErrorMessage(error, '初始化会话失败'));
      }
    };

    void initialize();

    return () => {
      destroyedRef.current = true;
      historyLoadingRef.current = false;

      if (realtimeTimerRef.current !== null) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }

      const activeHwh5 = hwh5Ref.current;
      const activeListener = listenerRef.current;
      if (activeHwh5 && activeListener) {
        void Promise.resolve(activeHwh5.unregisterSessionListener(activeListener)).catch(() => undefined);
      }

      listenerRef.current = null;
    };
  }, [enqueueRealtimeEvent, processEventBatch, welinkSessionId]);

  const sendMessage = useCallback(async (content: string, toolCallId?: string): Promise<boolean> => {
    if (!hwh5Ref.current || welinkSessionId === null) {
      setErrorMessage('会话未准备完成，暂时无法发送消息');
      return false;
    }

    const tempLocalId = createLocalId('user');

    const optimisticMessage: ChatMessage = {
      localId: tempLocalId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      parts: [],
      completed: true,
      isStreaming: false,
      awaitingUserAction: false,
      stepRunning: false,
    };

    setMessages((prev) => sortMessages([...prev, optimisticMessage]));
    setErrorMessage(null);
    setSessionStatus('busy');

    try {
      const result = await hwh5Ref.current.sendMessage({
        welinkSessionId,
        content,
        ...(toolCallId ? { toolCallId } : {}),
      });

      setMessages((prev) => {
        const next = prev.slice();
        const index = next.findIndex((message) => message.localId === tempLocalId);
        if (index < 0) {
          return prev;
        }

        const updated = cloneMessage(next[index]);
        updated.messageId = result.id ?? updated.messageId;
        updated.messageSeq = result.messageSeq ?? updated.messageSeq;
        updated.createdAt = result.createdAt ?? updated.createdAt;
        updated.role = normalizeRole(result.role ?? updated.role);
        next[index] = recalculateMessage(updated);

        return sortMessages(next);
      });

      return true;
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.localId !== tempLocalId));
      setSessionStatus('idle');
      setErrorMessage(formatErrorMessage(error, '发送消息失败'));
      return false;
    }
  }, [welinkSessionId]);

  const handleSendMessage = useCallback((content: string) => {
    void sendMessage(content);
  }, [sendMessage]);
  const handleStop = useCallback(async () => {
    if (!hwh5Ref.current || welinkSessionId === null) {
      setErrorMessage('会话未准备完成，暂时无法停止生成');
      return;
    }

    try {
      await hwh5Ref.current.stopSkill({ welinkSessionId });
      setSessionStatus('idle');
      setMessages((prev) => finalizeStreamingMessages(prev));
      showFeedback('已停止生成', 'info');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error, '停止生成失败'));
    }
  }, [showFeedback, welinkSessionId]);

  const handleMinimize = useCallback(async () => {
    if (!hwh5Ref.current) {
      setErrorMessage('window.HWH5EXT 不可用，无法执行缩小操作');
      return;
    }

    try {
      await hwh5Ref.current.controlSkillWeCode({ action: 'minimize' });
      showFeedback('已发送缩小指令', 'info');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error, '缩小小程序失败'));
    }
  }, [showFeedback]);

  const handleClose = useCallback(async () => {
    if (!hwh5Ref.current) {
      setErrorMessage('window.HWH5EXT 不可用，无法执行关闭操作');
      return;
    }

    try {
      await hwh5Ref.current.controlSkillWeCode({ action: 'close' });
      showFeedback('已发送关闭指令', 'info');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error, '关闭小程序失败'));
    }
  }, [showFeedback]);

  const handleSendToIM = useCallback(async (message: ChatMessage) => {
    if (!hwh5Ref.current || welinkSessionId === null) {
      setErrorMessage('会话未准备完成，暂时无法发送到 IM');
      return;
    }

    if (!message.completed) {
      showFeedback('消息未完成，暂不能发送到 IM', 'info');
      return;
    }

    setSendingToIMMessageId(message.localId);

    try {
      const params: { welinkSessionId: number; messageId?: number | string } = {
        welinkSessionId,
      };

      if (message.messageId !== undefined) {
        params.messageId = message.messageId;
      }

      const result = await hwh5Ref.current.sendMessageToIM(params);
      if (result.status === 'failed') {
        showFeedback('发送到 IM 失败', 'error');
      } else {
        showFeedback('已发送到 IM', 'success');
      }
    } catch (error) {
      setErrorMessage(formatErrorMessage(error, '发送到 IM 失败'));
    } finally {
      setSendingToIMMessageId(null);
    }
  }, [showFeedback, welinkSessionId]);

  const handleQuestionAnswer = useCallback(async (payload: {
    messageLocalId: string;
    partId: string;
    answer: string;
    toolCallId?: string;
  }) => {
    setAnsweringQuestionPartId(payload.partId);

    const ok = await sendMessage(payload.answer, payload.toolCallId);
    if (ok) {
      setMessages((prev) => markQuestionAnswered(prev, payload.messageLocalId, payload.partId));
      showFeedback('已提交回答', 'success');
    }

    setAnsweringQuestionPartId(null);
  }, [sendMessage, showFeedback]);

  const handleReplyPermission = useCallback(async (payload: {
    messageLocalId: string;
    partId: string;
    permissionId: string;
    response: PermissionResponse;
  }) => {
    if (!hwh5Ref.current || welinkSessionId === null) {
      setErrorMessage('会话未准备完成，暂时无法回复权限请求');
      return;
    }

    setReplyingPermissionPartId(payload.partId);

    try {
      await hwh5Ref.current.replyPermission({
        welinkSessionId,
        permId: payload.permissionId,
        response: payload.response,
      });

      setMessages((prev) => setPermissionReply(prev, payload.messageLocalId, payload.partId, payload.response));
      showFeedback('权限请求已回复', 'success');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error, '回复权限请求失败'));
    } finally {
      setReplyingPermissionPartId(null);
    }
  }, [showFeedback, welinkSessionId]);

  const canOperate = welinkSessionId !== null && hwh5Ready && !initializing;

  return (
    <div className="app-container">
      <div className="header-wrapper">
        <Header
          title={title}
          sessionStatus={sessionStatus}
          agentStatus={agentStatus}
          onMinimize={handleMinimize}
          onClose={handleClose}
          disabled={!canOperate}
        />
      </div>

      <div className="status-wrapper">
        {errorMessage && <div className="error-banner">{errorMessage}</div>}
        {feedback && (
          <div className={`feedback-banner ${feedback.type}`}>
            {feedback.message}
          </div>
        )}
        {welinkSessionId !== null && (
          <div className="info-banner">当前会话: {welinkSessionId}</div>
        )}
      </div>

      <div className="content-wrapper" ref={contentRef}>
        {(initializing || historyLoading) ? (
          <div className="loading-state">正在初始化会话并加载历史消息...</div>
        ) : (
          <Content
            messages={messages}
            sendingToIMMessageId={sendingToIMMessageId}
            answeringQuestionPartId={answeringQuestionPartId}
            replyingPermissionPartId={replyingPermissionPartId}
            onSendToIM={handleSendToIM}
            onAnswerQuestion={handleQuestionAnswer}
            onReplyPermission={handleReplyPermission}
            onFeedback={showFeedback}
          />
        )}
      </div>

      <div className="footer-wrapper">
        <Footer
          onSend={handleSendMessage}
          onStop={handleStop}
          isGenerating={isGenerating}
          disabled={!canOperate}
        />
      </div>
    </div>
  );
}

export default App;
