import type { StreamMessage, MessagePart } from '../types';
import { extractQuestionFields, normalizeQuestionOptions } from '../utils/message';

export class StreamAssembler {
  private parts = new Map<string, MessagePart>();
  private partOrder: string[] = [];
  private completed = false;
  private partIdCounter = 0;

  private genPartId(prefix: string): string {
    return `${prefix}_${++this.partIdCounter}`;
  }

  private getOrCreatePart(partId: string, type: MessagePart['type']): MessagePart {
    let part = this.parts.get(partId);
    if (!part) {
      part = {
        partId,
        type,
        content: '',
        isStreaming: true,
      };
      this.parts.set(partId, part);
      this.partOrder.push(partId);
    }
    return part;
  }

  handleMessage(msg: StreamMessage): void {
    if (this.completed) return;

    switch (msg.type) {
      case 'text.delta': {
        const id = msg.partId || this.findActivePartId('text') || this.genPartId('text');
        const part = this.getOrCreatePart(id, 'text');
        part.content += msg.content ?? '';
        part.isStreaming = true;
        break;
      }

      case 'text.done': {
        const id = msg.partId || this.findActivePartId('text');
        if (id) {
          const part = this.parts.get(id);
          if (part) {
            if (msg.content) part.content = msg.content;
            part.isStreaming = false;
          }
        } else {
          const newId = this.genPartId('text');
          const part = this.getOrCreatePart(newId, 'text');
          part.content = msg.content ?? '';
          part.isStreaming = false;
        }
        break;
      }

      case 'thinking.delta': {
        const id = msg.partId || this.findActivePartId('thinking') || this.genPartId('thinking');
        const part = this.getOrCreatePart(id, 'thinking');
        part.content += msg.content ?? '';
        part.isStreaming = true;
        break;
      }

      case 'thinking.done': {
        const id = msg.partId || this.findActivePartId('thinking');
        if (id) {
          const part = this.parts.get(id);
          if (part) {
            if (msg.content) part.content = msg.content;
            part.isStreaming = false;
          }
        } else {
          const newId = this.genPartId('thinking');
          const part = this.getOrCreatePart(newId, 'thinking');
          part.content = msg.content ?? '';
          part.isStreaming = false;
        }
        break;
      }

      case 'tool.update': {
        const id = msg.partId || this.genPartId('tool');
        const part = this.getOrCreatePart(id, 'tool');
        part.toolName = msg.toolName ?? undefined;
        part.toolCallId = msg.toolCallId ?? undefined;
        const status = msg.status;
        part.status =
          status === 'pending' || status === 'running' || status === 'completed' || status === 'error'
            ? status
            : undefined;
        part.title = msg.title ?? undefined;
        if (msg.input) part.input = msg.input;
        if (msg.output != null) part.output = msg.output;
        if (msg.error) part.content = msg.error;
        part.isStreaming = msg.status === 'pending' || msg.status === 'running';
        break;
      }

      case 'question': {
        const questionPart = msg.parts?.find((p) =>
          msg.partId ? p.partId === msg.partId : p.type === 'question',
        );
        const questionFields = extractQuestionFields(msg.input ?? questionPart?.input);
        const id = msg.partId || questionPart?.partId || this.genPartId('question');
        const part = this.getOrCreatePart(id, 'question');
        part.toolName = msg.toolName ?? questionPart?.toolName ?? part.toolName;
        part.toolCallId = msg.toolCallId ?? questionPart?.toolCallId ?? part.toolCallId;

        const status = msg.status ?? questionPart?.status;
        if (status === 'pending' || status === 'running' || status === 'completed' || status === 'error') {
          part.status = status;
        }

        part.header = msg.header ?? questionFields.header ?? questionPart?.header ?? part.header;
        part.question = msg.question ?? questionFields.question ?? questionPart?.question ?? part.question;
        if (msg.output != null) {
          part.output = msg.output;
        }
        part.options =
          questionFields.options
          ?? normalizeQuestionOptions(msg.options ?? questionPart?.options)
          ?? part.options;
        if (status === 'completed' || status === 'error') {
          part.answered = true;
        }
        part.content = msg.content ?? questionPart?.content ?? part.content;
        if (!part.content && part.question) {
          part.content = part.question;
        }
        part.isStreaming = false;
        break;
      }

      case 'permission.ask': {
        const id = msg.partId || msg.permissionId || this.genPartId('perm');
        const part = this.getOrCreatePart(id, 'permission');
        part.permissionId = msg.permissionId ?? undefined;
        part.permType = msg.permType ?? undefined;
        part.toolName = msg.toolName ?? undefined;
        part.content = msg.title ?? msg.content ?? part.content;
        part.permResolved = false;
        part.response = undefined;
        part.isStreaming = false;
        break;
      }

      case 'permission.reply': {
        const id = this.findPermissionPartId(msg.permissionId) || msg.partId || msg.permissionId || this.genPartId('perm');
        const part = this.getOrCreatePart(id, 'permission');
        part.permissionId = msg.permissionId ?? part.permissionId;
        part.response = msg.response ?? part.response;
        part.permResolved = true;
        part.isStreaming = false;
        break;
      }

      case 'file': {
        const id = msg.partId || this.genPartId('file');
        const part = this.getOrCreatePart(id, 'file');
        part.fileName = msg.fileName ?? undefined;
        part.fileUrl = msg.fileUrl ?? undefined;
        part.fileMime = msg.fileMime ?? undefined;
        part.isStreaming = false;
        break;
      }

      default:
        break;
    }
  }

  private findActivePartId(type: MessagePart['type']): string | null {
    for (let i = this.partOrder.length - 1; i >= 0; i--) {
      const id = this.partOrder[i];
      const part = this.parts.get(id);
      if (part && part.type === type && part.isStreaming) {
        return id;
      }
    }
    return null;
  }

  private findPermissionPartId(permissionId?: string | null): string | null {
    if (!permissionId) {
      return null;
    }

    for (let i = this.partOrder.length - 1; i >= 0; i -= 1) {
      const id = this.partOrder[i];
      const part = this.parts.get(id);
      if (part?.type === 'permission' && part.permissionId === permissionId) {
        return id;
      }
    }

    return null;
  }

  getText(): string {
    return this.partOrder
      .map(id => this.parts.get(id))
      .filter((p): p is MessagePart => p !== undefined && p.type === 'text')
      .map(p => p.content)
      .join('');
  }

  getParts(): MessagePart[] {
    return this.partOrder
      .map(id => this.parts.get(id))
      .filter((p): p is MessagePart => p !== undefined);
  }

  hasActiveStreaming(): boolean {
    for (const part of this.parts.values()) {
      if (part.isStreaming) return true;
    }
    return false;
  }

  complete(): void {
    this.completed = true;
    for (const part of this.parts.values()) {
      part.isStreaming = false;
    }
  }

  isCompleted(): boolean {
    return this.completed;
  }

  reset(): void {
    this.parts.clear();
    this.partOrder = [];
    this.completed = false;
    this.partIdCounter = 0;
  }
}
