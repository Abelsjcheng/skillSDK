import { Logger } from '../utils/Logger';
import {
  MessageRole,
  SessionMessage,
  SessionMessagePart,
  SendMessageResult,
  StreamMessage,
  StreamSnapshotMessage,
  StreamingPart
} from '../types';

interface LocalMessageState {
  messageSeq: number;
  messageId?: string;
  role: MessageRole;
  content: string;
  parts: SessionMessagePart[];
  createdAt: string;
  final: boolean;
  userId: string | null;
}

interface SessionCacheState {
  bySeq: Map<number, LocalMessageState>;
  byMessageId: Map<string, number>;
}

/**
 * In-memory message cache for:
 * - stream aggregation
 * - history + local merge
 * - regenerate/send-to-im lookups
 */
export class MessageCacheManager {
  private readonly logger: Logger;
  private readonly sessions: Map<number, SessionCacheState> = new Map();

  constructor(enableLog: boolean = false) {
    this.logger = new Logger('MessageCacheManager', enableLog);
  }

  setEnableLog(enable: boolean): void {
    this.logger.setEnabled(enable);
  }

  clearSession(sessionId: number): void {
    this.sessions.delete(sessionId);
  }

  clearAll(): void {
    this.sessions.clear();
  }

  cacheHistory(sessionId: number, messages: SessionMessage[]): void {
    const state = this.ensureSessionState(sessionId);
    for (const message of messages) {
      const normalized = this.normalizeHistoryMessage(message);
      state.bySeq.set(normalized.messageSeq, normalized);
      state.byMessageId.set(String(message.id), normalized.messageSeq);
    }
  }

  cacheSentUserMessage(result: SendMessageResult): void {
    const state = this.ensureSessionState(result.welinkSessionId);
    const local: LocalMessageState = {
      messageSeq: result.messageSeq,
      role: 'user',
      content: result.content,
      parts: [],
      createdAt: result.createdAt,
      final: true,
      userId: result.userId
    };
    state.bySeq.set(local.messageSeq, local);
  }

  onStreamMessage(message: StreamMessage): void {
    const sessionId = this.parseSessionId(message.welinkSessionId);
    if (sessionId === null) {
      return;
    }
    const state = this.ensureSessionState(sessionId);

    if (message.type === 'snapshot') {
      this.applySnapshot(state, message.messages ?? []);
      return;
    }

    if (message.type === 'streaming') {
      this.applyStreaming(state, message);
      return;
    }

    const messageSeq = message.messageSeq;
    if (messageSeq === undefined) {
      return;
    }

    const local = this.ensureLocalMessage(state, messageSeq, message.role ?? 'assistant', message.messageId);
    if (message.createdAt !== undefined) {
      local.createdAt = message.createdAt;
    }

    this.applyMessageEvent(local, message);
    if (message.messageId !== undefined) {
      state.byMessageId.set(message.messageId, messageSeq);
    }
  }

  getLastUserMessageContent(sessionId: number): string | null {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return null;
    }
    const ordered = this.toOrderedMessages(state);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const item = ordered[i];
      if (item.role === 'user' && item.content.trim() !== '') {
        return item.content;
      }
    }
    return null;
  }

  getFinalMessageContent(sessionId: number, messageId?: number | string): string | null {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return null;
    }

    if (messageId !== undefined) {
      const seq = this.resolveMessageSeqById(state, messageId);
      if (seq === null) {
        return null;
      }
      const target = state.bySeq.get(seq);
      if (target === undefined || !target.final || target.content.trim() === '') {
        return null;
      }
      return target.content;
    }

    const ordered = this.toOrderedMessages(state);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const item = ordered[i];
      if (item.final && item.content.trim() !== '') {
        return item.content;
      }
    }
    return null;
  }

  mergeWithHistory(sessionId: number, history: SessionMessage[]): SessionMessage[] {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return history;
    }

    const historyBySeq = new Map<number, SessionMessage>();
    for (const message of history) {
      historyBySeq.set(message.messageSeq, message);
    }

    const merged: SessionMessage[] = [...history];
    const orderedLocal = this.toOrderedMessages(state);
    for (const local of orderedLocal) {
      if (historyBySeq.has(local.messageSeq)) {
        continue;
      }
      merged.push(this.toSessionMessage(sessionId, local));
    }

    merged.sort((a: SessionMessage, b: SessionMessage) => a.messageSeq - b.messageSeq);
    return merged;
  }

  private normalizeHistoryMessage(message: SessionMessage): LocalMessageState {
    return {
      messageSeq: message.messageSeq,
      messageId: String(message.id),
      role: message.role,
      content: message.content,
      parts: message.parts ?? [],
      createdAt: message.createdAt,
      final: true,
      userId: message.userId
    };
  }

  private applySnapshot(state: SessionCacheState, messages: StreamSnapshotMessage[]): void {
    for (const item of messages) {
      const local: LocalMessageState = {
        messageSeq: item.seq,
        messageId: item.id,
        role: item.role,
        content: item.content,
        parts: item.parts ?? [],
        createdAt: item.createdAt ?? new Date().toISOString(),
        final: true,
        userId: item.role === 'user' ? '' : null
      };
      state.bySeq.set(local.messageSeq, local);
      state.byMessageId.set(item.id, item.seq);
    }
  }

  private applyStreaming(state: SessionCacheState, message: StreamMessage): void {
    if (message.messageSeq === undefined) {
      return;
    }
    const local = this.ensureLocalMessage(
      state,
      message.messageSeq,
      message.role ?? 'assistant',
      message.messageId
    );
    local.final = message.sessionStatus === 'idle';
    if (message.parts !== undefined) {
      local.parts = message.parts.map((part: StreamingPart) => this.toPartFromStreaming(part));
      local.content = this.aggregateContent(local.parts);
    }
    if (message.messageId !== undefined) {
      state.byMessageId.set(message.messageId, message.messageSeq);
    }
  }

  private applyMessageEvent(local: LocalMessageState, message: StreamMessage): void {
    switch (message.type) {
      case 'text.delta':
      case 'thinking.delta':
        this.upsertTextPart(local, message);
        local.content = this.aggregateContent(local.parts);
        local.final = false;
        break;
      case 'text.done':
      case 'thinking.done':
        this.upsertTextPart(local, message, true);
        local.content = this.aggregateContent(local.parts);
        local.final = true;
        break;
      case 'tool.update':
        this.upsertToolPart(local, message);
        local.final = message.status === 'completed';
        break;
      case 'question':
        this.upsertQuestionPart(local, message);
        local.final = false;
        break;
      case 'permission.ask':
      case 'permission.reply':
        this.upsertPermissionPart(local, message);
        local.final = message.type === 'permission.reply';
        break;
      case 'file':
        this.upsertFilePart(local, message);
        break;
      case 'step.done':
        local.final = true;
        break;
      case 'session.error':
      case 'error':
        local.final = true;
        break;
      default:
        break;
    }
  }

  private upsertTextPart(local: LocalMessageState, message: StreamMessage, overwrite: boolean = false): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, message.type.startsWith('thinking') ? 'thinking' : 'text');
    if (overwrite) {
      part.content = message.content ?? '';
      return;
    }
    part.content = `${part.content ?? ''}${message.content ?? ''}`;
  }

  private upsertToolPart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'tool');
    part.toolName = message.toolName;
    part.toolCallId = message.toolCallId;
    part.toolStatus = message.status;
    part.toolInput = message.input;
    part.toolOutput = message.output;
    part.toolError = message.error;
  }

  private upsertQuestionPart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'question');
    part.toolName = message.toolName;
    part.toolCallId = message.toolCallId;
    part.toolStatus = message.status;
    part.header = message.header;
    part.question = message.question;
    part.options = message.options;
  }

  private upsertPermissionPart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'permission');
    part.permissionId = message.permissionId;
    part.permissionResponse = message.response;
    part.toolName = message.permType;
    part.content = message.title;
  }

  private upsertFilePart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'file');
    part.fileName = message.fileName;
    part.fileUrl = message.fileUrl;
    part.fileMime = message.fileMime;
  }

  private ensurePart(
    local: LocalMessageState,
    partId: string | undefined,
    partSeq: number | undefined,
    type: SessionMessagePart['type']
  ): SessionMessagePart {
    const targetPartId = partId ?? `auto_${type}_${partSeq ?? local.parts.length + 1}`;
    let part = local.parts.find((item: SessionMessagePart) => item.partId === targetPartId);
    if (part !== undefined) {
      return part;
    }
    part = {
      partId: targetPartId,
      partSeq,
      type,
      content: ''
    };
    local.parts.push(part);
    local.parts.sort((a: SessionMessagePart, b: SessionMessagePart) => {
      const left = a.partSeq ?? Number.MAX_SAFE_INTEGER;
      const right = b.partSeq ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });
    return part;
  }

  private toPartFromStreaming(part: StreamingPart): SessionMessagePart {
    return {
      partId: part.partId,
      partSeq: part.partSeq,
      type: part.type,
      content: part.content,
      toolName: part.toolName,
      toolCallId: part.toolCallId,
      toolStatus: part.status,
      header: part.header,
      question: part.question,
      options: part.options,
      fileName: part.fileName,
      fileUrl: part.fileUrl,
      fileMime: part.fileMime
    };
  }

  private aggregateContent(parts: SessionMessagePart[]): string {
    const texts: string[] = [];
    for (const part of parts) {
      if ((part.type === 'text' || part.type === 'thinking') && part.content !== undefined) {
        texts.push(part.content);
      }
    }
    return texts.join('');
  }

  private resolveMessageSeqById(state: SessionCacheState, messageId: number | string): number | null {
    if (typeof messageId === 'number') {
      if (state.bySeq.has(messageId)) {
        return messageId;
      }
      const fromMap = state.byMessageId.get(String(messageId));
      return fromMap === undefined ? null : fromMap;
    }
    const seq = state.byMessageId.get(messageId);
    if (seq !== undefined) {
      return seq;
    }
    const numeric = Number(messageId);
    if (!Number.isNaN(numeric) && state.bySeq.has(numeric)) {
      return numeric;
    }
    return null;
  }

  private toOrderedMessages(state: SessionCacheState): LocalMessageState[] {
    const ordered = Array.from(state.bySeq.values());
    ordered.sort((a: LocalMessageState, b: LocalMessageState) => a.messageSeq - b.messageSeq);
    return ordered;
  }

  private toSessionMessage(sessionId: number, local: LocalMessageState): SessionMessage {
    return {
      id: local.messageId ?? local.messageSeq,
      welinkSessionId: sessionId,
      userId: local.userId,
      role: local.role,
      content: local.content,
      messageSeq: local.messageSeq,
      parts: local.parts,
      createdAt: local.createdAt
    };
  }

  private parseSessionId(welinkSessionId: string): number | null {
    const parsed = Number(welinkSessionId);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }

  private ensureSessionState(sessionId: number): SessionCacheState {
    let state = this.sessions.get(sessionId);
    if (state !== undefined) {
      return state;
    }
    state = {
      bySeq: new Map<number, LocalMessageState>(),
      byMessageId: new Map<string, number>()
    };
    this.sessions.set(sessionId, state);
    return state;
  }

  private ensureLocalMessage(
    state: SessionCacheState,
    messageSeq: number,
    role: MessageRole,
    messageId?: string
  ): LocalMessageState {
    const existing = state.bySeq.get(messageSeq);
    if (existing !== undefined) {
      if (messageId !== undefined) {
        existing.messageId = messageId;
      }
      return existing;
    }
    const created: LocalMessageState = {
      messageSeq,
      messageId,
      role,
      content: '',
      parts: [],
      createdAt: new Date().toISOString(),
      final: false,
      userId: role === 'user' ? '' : null
    };
    state.bySeq.set(messageSeq, created);
    return created;
  }
}
