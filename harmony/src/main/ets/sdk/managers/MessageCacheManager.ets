import { Logger } from '../utils/Logger';
import {
  MessageContentType,
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
  stableMessageId?: string;
  role: MessageRole;
  content: string;
  parts: SessionMessagePart[];
  createdAt: string;
  final: boolean;
  contentType?: MessageContentType;
  seq?: number | null;
  meta?: Record<string, any> | null;
}

interface SessionCacheState {
  bySeq: Map<number, LocalMessageState>;
  byMessageId: Map<string, number>;
  nextSyntheticMessageId: number;
}

/**
 * In-memory message cache for:
 * - stream aggregation
 * - history + local merge
 * - regenerate/send-to-im lookups
 */
export class MessageCacheManager {
  private readonly logger: Logger;
  private readonly sessions: Map<string, SessionCacheState> = new Map();

  constructor(enableLog: boolean = false) {
    this.logger = new Logger('MessageCacheManager', enableLog);
  }

  setEnableLog(enable: boolean): void {
    this.logger.setEnabled(enable);
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clearAll(): void {
    this.sessions.clear();
  }

  cacheHistory(sessionId: string, messages: SessionMessage[]): void {
    const state = this.ensureSessionState(sessionId);
    for (const message of messages) {
      const normalized = this.normalizeHistoryMessage(message);
      state.bySeq.set(normalized.messageSeq, normalized);
      this.indexMessageIds(state, normalized);
    }
  }

  cacheSentUserMessage(result: SendMessageResult): void {
    const state = this.ensureSessionState(result.welinkSessionId);
    const local: LocalMessageState = {
      messageSeq: result.messageSeq ?? this.resolveFallbackMessageSeq(state),
      messageId: result.id,
      role: 'user',
      content: result.content ?? '',
      parts: (result.parts ?? []).map((part: SessionMessagePart) => this.normalizePart(part)),
      createdAt: result.createdAt,
      final: true,
      contentType: result.contentType ?? undefined,
      seq: result.seq ?? undefined,
      meta: result.meta ?? undefined
    };
    state.bySeq.set(local.messageSeq, local);
    this.indexMessageIds(state, local);
  }

  onStreamMessage(message: StreamMessage): void {
    const sessionId = message.welinkSessionId?.trim();
    if (sessionId === undefined || sessionId === '') {
      return;
    }
    const state = this.ensureSessionState(sessionId);

    if (this.isTransportOnlyType(message.type)) {
      this.applyTransportOnlyEvent(state, message);
      return;
    }

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
    this.indexMessageIds(state, local, message.messageId);
  }

  getLastUserMessageContent(sessionId: string): string | null {
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

  getFinalMessageContent(sessionId: string, messageId?: string): string | null {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return null;
    }

    if (messageId !== undefined && messageId.trim() !== '') {
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

  hasMessage(sessionId: string, messageId: string): boolean {
    if (messageId.trim() === '') {
      return false;
    }
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return false;
    }
    const seq = this.resolveMessageSeqById(state, messageId);
    return seq !== null && state.bySeq.has(seq);
  }

  isMessageCompleted(sessionId: string, messageId: string): boolean {
    if (messageId.trim() === '') {
      return false;
    }
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return false;
    }
    const seq = this.resolveMessageSeqById(state, messageId);
    if (seq === null) {
      return false;
    }
    const target = state.bySeq.get(seq);
    return target !== undefined && target.final;
  }

  getLatestLocalMessageNotInHistory(sessionId: string, history: SessionMessage[]): SessionMessage | null {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return null;
    }

    const ordered = this.toOrderedMessages(state);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const candidate = this.toSessionMessage(sessionId, ordered[i]);
      const duplicated = history.some((item: SessionMessage) => this.isSameMessage(item, candidate));
      if (!duplicated) {
        return candidate;
      }
    }

    return null;
  }

  private normalizeHistoryMessage(message: SessionMessage): LocalMessageState {
    return {
      messageSeq: message.messageSeq ?? 0,
      messageId: message.id,
      stableMessageId: message.id,
      role: message.role,
      content: message.content ?? '',
      parts: (message.parts ?? []).map((part: SessionMessagePart) => this.normalizePart(part)),
      createdAt: message.createdAt,
      final: true,
      contentType: message.contentType ?? undefined,
      seq: message.seq ?? undefined,
      meta: message.meta ?? undefined
    };
  }

  private normalizePart(part: SessionMessagePart): SessionMessagePart {
    return {
      ...part,
      options: part.options === undefined ? undefined : [...part.options]
    };
  }

  private applySnapshot(state: SessionCacheState, messages: StreamSnapshotMessage[]): void {
    for (const item of messages) {
      const stableMessageId = item.id.trim();
      const messageId: string = stableMessageId !== ''
        ? stableMessageId
        : String(this.allocateFallbackMessageId(state, item.messageSeq ?? item.seq ?? undefined));
      const local: LocalMessageState = {
        messageSeq: item.messageSeq ?? item.seq ?? this.resolveFallbackMessageSeq(state),
        messageId: messageId,
        stableMessageId: stableMessageId !== '' ? stableMessageId : undefined,
        role: item.role,
        content: item.content ?? '',
        parts: (item.parts ?? []).map((part: SessionMessagePart) => this.normalizePart(part)),
        createdAt: item.createdAt ?? new Date().toISOString(),
        final: true,
        contentType: item.contentType ?? undefined,
        seq: item.seq ?? undefined,
        meta: item.meta ?? undefined
      };
      state.bySeq.set(local.messageSeq, local);
      this.indexMessageIds(state, local, stableMessageId !== '' ? stableMessageId : undefined);
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
    if (message.createdAt !== undefined) {
      local.createdAt = message.createdAt;
    }
    local.final = message.sessionStatus === 'idle';
    if (message.parts !== undefined) {
      local.parts = message.parts.map((part: StreamingPart) => this.toPartFromStreaming(part));
      local.content = this.aggregateContent(local.parts);
    }
    if (message.messageId !== undefined && message.messageId.trim() !== '') {
      local.stableMessageId = message.messageId.trim();
      if (local.messageId === undefined || local.messageId.trim() === '') {
        local.messageId = local.stableMessageId;
      }
    }
    this.indexMessageIds(state, local, message.messageId);
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
    part.toolName = message.toolName ?? undefined;
    part.toolCallId = message.toolCallId ?? undefined;
    part.status = message.status ?? undefined;
    part.input = message.input ?? undefined;
    part.output = message.output ?? undefined;
    part.error = message.error ?? undefined;
    part.title = message.title ?? undefined;
  }

  private upsertQuestionPart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'question');
    part.toolName = message.toolName ?? undefined;
    part.toolCallId = message.toolCallId ?? undefined;
    part.status = message.status ?? undefined;
    part.input = message.input ?? undefined;
    part.header = message.header ?? undefined;
    part.question = message.question ?? undefined;
    part.options = message.options ?? undefined;
  }

  private upsertPermissionPart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'permission');
    part.permissionId = message.permissionId ?? undefined;
    part.response = message.response ?? undefined;
    part.permType = message.permType ?? undefined;
    part.metadata = message.metadata ?? undefined;
    part.title = message.title ?? undefined;
    part.content = message.title ?? undefined;
    part.status = message.status ?? undefined;
  }

  private upsertFilePart(local: LocalMessageState, message: StreamMessage): void {
    const part = this.ensurePart(local, message.partId, message.partSeq, 'file');
    part.fileName = message.fileName ?? undefined;
    part.fileUrl = message.fileUrl ?? undefined;
    part.fileMime = message.fileMime ?? undefined;
  }

  private ensurePart(
    local: LocalMessageState,
    partId: string | undefined,
    partSeq: number | undefined,
    type: SessionMessagePart['type']
  ): SessionMessagePart {
    let part: SessionMessagePart | undefined;
    if (partId !== undefined && partId.trim() !== '') {
      part = local.parts.find((item: SessionMessagePart) => item.partId === partId);
    }
    if (part === undefined && partSeq !== undefined) {
      part = local.parts.find((item: SessionMessagePart) => item.partSeq === partSeq);
    }
    if (part !== undefined) {
      if (partId !== undefined && partId.trim() !== '') {
        part.partId = partId;
      }
      if (partSeq !== undefined) {
        part.partSeq = partSeq;
      }
      part.type = type;
      return part;
    }

    const targetPartId = partId ?? `auto_${type}_${partSeq ?? local.parts.length + 1}`;
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
      status: part.status,
      input: part.input,
      output: part.output,
      error: part.error,
      title: part.title,
      header: part.header,
      question: part.question,
      options: part.options,
      permissionId: part.permissionId,
      permType: part.permType,
      metadata: part.metadata,
      response: part.response,
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

  private resolveMessageSeqById(state: SessionCacheState, messageId: string): number | null {
    const normalized = messageId.trim();
    if (normalized === '') {
      return null;
    }
    const fromMap = state.byMessageId.get(normalized);
    return fromMap === undefined ? null : fromMap;
  }

  private toOrderedMessages(state: SessionCacheState): LocalMessageState[] {
    const ordered = Array.from(state.bySeq.values());
    ordered.sort((a: LocalMessageState, b: LocalMessageState) => this.compareLocalMessages(a, b));
    return ordered;
  }

  private compareLocalMessages(left: LocalMessageState, right: LocalMessageState): number {
    const seqCompare = this.compareNullableNumber(left.seq, right.seq);
    if (seqCompare !== 0) {
      return seqCompare;
    }
    const messageSeqCompare = this.compareNullableNumber(left.messageSeq, right.messageSeq);
    if (messageSeqCompare !== 0) {
      return messageSeqCompare;
    }
    const leftId = left.messageId ?? '';
    const rightId = right.messageId ?? '';
    return leftId.localeCompare(rightId);
  }

  private compareNullableNumber(left?: number | null, right?: number | null): number {
    if (left !== null && left !== undefined && right !== null && right !== undefined) {
      return left - right;
    }
    if (left !== null && left !== undefined) {
      return -1;
    }
    if (right !== null && right !== undefined) {
      return 1;
    }
    return 0;
  }

  private toSessionMessage(sessionId: string, local: LocalMessageState): SessionMessage {
    return {
      id: local.messageId ?? String(local.messageSeq),
      seq: local.seq ?? null,
      welinkSessionId: sessionId,
      role: local.role,
      content: local.content,
      messageSeq: local.messageSeq,
      parts: local.parts,
      createdAt: local.createdAt,
      contentType: local.contentType,
      meta: local.meta ?? null
    };
  }

  private isSameMessage(left: SessionMessage, right: SessionMessage): boolean {
    if (left.id !== '' && right.id !== '' && left.id === right.id) {
      return true;
    }
    return left.messageSeq !== undefined
      && left.messageSeq !== null
      && right.messageSeq !== undefined
      && right.messageSeq !== null
      && left.messageSeq === right.messageSeq;
  }

  private ensureSessionState(sessionId: string): SessionCacheState {
    let state = this.sessions.get(sessionId);
    if (state !== undefined) {
      return state;
    }
    state = {
      bySeq: new Map<number, LocalMessageState>(),
      byMessageId: new Map<string, number>(),
      nextSyntheticMessageId: -1
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
      if (messageId !== undefined && messageId.trim() !== '') {
        existing.stableMessageId = messageId.trim();
        if (existing.messageId === undefined || existing.messageId.trim() === '') {
          existing.messageId = existing.stableMessageId;
        }
      }
      return existing;
    }

    const stableMessageId = messageId !== undefined && messageId.trim() !== '' ? messageId.trim() : undefined;
    const created: LocalMessageState = {
      messageSeq,
      messageId: stableMessageId ?? String(this.allocateFallbackMessageId(state, messageSeq)),
      stableMessageId,
      role,
      content: '',
      parts: [],
      createdAt: new Date().toISOString(),
      final: false
    };
    state.bySeq.set(messageSeq, created);
    return created;
  }

  private allocateFallbackMessageId(state: SessionCacheState, fallbackSeq?: number): number {
    if (fallbackSeq !== undefined) {
      return fallbackSeq;
    }
    const id = state.nextSyntheticMessageId;
    state.nextSyntheticMessageId -= 1;
    return id;
  }

  private resolveFallbackMessageSeq(state: SessionCacheState): number {
    const id = state.nextSyntheticMessageId;
    state.nextSyntheticMessageId -= 1;
    return Math.abs(id);
  }

  private indexMessageIds(
    state: SessionCacheState,
    local: LocalMessageState,
    explicitStableId?: string
  ): void {
    if (local.messageId !== undefined) {
      state.byMessageId.set(String(local.messageId), local.messageSeq);
    }
    if (local.stableMessageId !== undefined && local.stableMessageId.trim() !== '') {
      state.byMessageId.set(local.stableMessageId, local.messageSeq);
    }
    if (explicitStableId !== undefined && explicitStableId.trim() !== '') {
      state.byMessageId.set(explicitStableId.trim(), local.messageSeq);
    }
  }

  private isTransportOnlyType(type: string): boolean {
    return type === 'session.status'
      || type === 'session.title'
      || type === 'session.error'
      || type === 'agent.online'
      || type === 'agent.offline'
      || type === 'error';
  }

  private applyTransportOnlyEvent(state: SessionCacheState, message: StreamMessage): void {
    if (message.type === 'session.status') {
      if (message.sessionStatus === 'idle') {
        this.markLatestMessageFinal(state, true);
        return;
      }
      if (message.sessionStatus === 'busy' || message.sessionStatus === 'retry') {
        this.markLatestMessageFinal(state, false);
      }
      return;
    }
    if (message.type === 'session.error' || message.type === 'error' || message.type === 'agent.offline') {
      this.markLatestMessageFinal(state, true);
    }
  }

  private markLatestMessageFinal(state: SessionCacheState, final: boolean): void {
    const ordered = this.toOrderedMessages(state);
    if (ordered.length === 0) {
      return;
    }
    ordered[ordered.length - 1].final = final;
  }
}
