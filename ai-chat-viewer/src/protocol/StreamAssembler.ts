import type { StreamMessage, MessagePart, MessagePartSnapshot, PartStatus } from '../types';
import { normalizeQuestionItems, normalizeQuestionOptions } from '../utils/message';

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

  private syncSubagentFields(part: MessagePart, msg: StreamMessage): void {
    part.subagentSessionId = msg.subagentSessionId ?? part.subagentSessionId;
    part.subagentName = msg.subagentName ?? part.subagentName;
  }

  handleMessage(msg: StreamMessage): void {
    if (this.completed) return;

    switch (msg.type) {
      case 'text.delta': {
        const id = msg.partId || this.findActivePartId('text') || this.genPartId('text');
        const part = this.getOrCreatePart(id, 'text');
        this.syncSubagentFields(part, msg);
        part.content += msg.content ?? '';
        part.isStreaming = true;
        break;
      }

      case 'text.done': {
        const id = msg.partId || this.findActivePartId('text');
        if (id) {
          const part = this.getOrCreatePart(id, 'text');
          this.syncSubagentFields(part, msg);
          if (msg.content) part.content = msg.content;
          part.isStreaming = false;
        } else {
          const newId = this.genPartId('text');
          const part = this.getOrCreatePart(newId, 'text');
          this.syncSubagentFields(part, msg);
          part.content = msg.content ?? '';
          part.isStreaming = false;
        }
        break;
      }

      case 'thinking.delta': {
        const id = msg.partId || this.findActivePartId('thinking') || this.genPartId('thinking');
        const part = this.getOrCreatePart(id, 'thinking');
        this.syncSubagentFields(part, msg);
        part.content += msg.content ?? '';
        part.isStreaming = true;
        break;
      }

      case 'thinking.done': {
        const id = msg.partId || this.findActivePartId('thinking');
        if (id) {
          const part = this.parts.get(id);
          if (part) {
            this.syncSubagentFields(part, msg);
            if (msg.content) part.content = msg.content;
            part.isStreaming = false;
          }
        } else {
          const newId = this.genPartId('thinking');
          const part = this.getOrCreatePart(newId, 'thinking');
          this.syncSubagentFields(part, msg);
          part.content = msg.content ?? '';
          part.isStreaming = false;
        }
        break;
      }

      case 'tool.update': {
        const id = msg.partId || this.genPartId('tool');
        const part = this.getOrCreatePart(id, 'tool');
        this.syncSubagentFields(part, msg);
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
        const questionItems = normalizeQuestionItems({
          header: msg.header ?? questionPart?.header,
          question: msg.question ?? questionPart?.question,
          options: msg.options ?? questionPart?.options,
          multiSelect: msg.multiSelect ?? questionPart?.multiSelect,
          questions: msg.questions ?? questionPart?.questions,
          content: msg.content ?? questionPart?.content,
        });
        const firstQuestion = questionItems?.[0];
        const id = msg.partId || questionPart?.partId || this.genPartId('question');
        const part = this.getOrCreatePart(id, 'question');
        this.syncSubagentFields(part, msg);
        part.toolName = msg.toolName ?? questionPart?.toolName ?? part.toolName;
        part.toolCallId = msg.toolCallId ?? questionPart?.toolCallId ?? part.toolCallId;
        part.questionId = msg.questionId ?? questionPart?.questionId ?? part.questionId;

        const status = msg.status ?? questionPart?.status;
        if (status === 'pending' || status === 'running' || status === 'completed' || status === 'error') {
          part.status = status;
        }

        part.header = msg.header ?? firstQuestion?.header ?? questionPart?.header ?? part.header;
        part.question = msg.question ?? firstQuestion?.question ?? questionPart?.question ?? part.question;
        if (msg.output != null) {
          part.output = msg.output;
        }
        part.options =
          (firstQuestion && firstQuestion.options.length > 0 ? firstQuestion.options : undefined)
          ?? normalizeQuestionOptions(msg.options ?? questionPart?.options)
          ?? part.options;
        part.multiSelect = firstQuestion?.multiSelect ?? msg.multiSelect ?? questionPart?.multiSelect ?? part.multiSelect;
        part.questions = questionItems ?? part.questions;
        part.extParam = msg.extParam ?? questionPart?.extParam ?? part.extParam;
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
        this.syncSubagentFields(part, msg);
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
        this.syncSubagentFields(part, msg);
        part.permissionId = msg.permissionId ?? part.permissionId;
        part.response = msg.response ?? part.response;
        part.permResolved = true;
        part.isStreaming = false;
        break;
      }

      case 'file': {
        const id = msg.partId || this.genPartId('file');
        const part = this.getOrCreatePart(id, 'file');
        this.syncSubagentFields(part, msg);
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

  initializeFromSnapshot(partSnapshots: MessagePartSnapshot[]): void {
    if (this.completed) return;
    this.parts.clear();
    this.partOrder = [];
    partSnapshots.forEach((partSnapshot) => {
      const questionItems = normalizeQuestionItems({
        header: partSnapshot.header,
        question: partSnapshot.question,
        options: partSnapshot.options,
        multiSelect: partSnapshot.multiSelect,
        questions: partSnapshot.questions,
        content: partSnapshot.content,
      });
      const firstQuestion = questionItems?.[0];
      const partId = partSnapshot.partId || this.genPartId(partSnapshot.type);
      const part = this.getOrCreatePart(partId, partSnapshot.type);
      part.content = partSnapshot.content ?? '';
      part.isStreaming = true;
      part.subagentSessionId = partSnapshot.subagentSessionId ?? undefined;
      part.subagentName = partSnapshot.subagentName ?? undefined;
      if (partSnapshot.toolCallId) part.toolCallId = partSnapshot.toolCallId;
      if (partSnapshot.toolName) part.toolName = partSnapshot.toolName;
      if (partSnapshot.status) part.status = partSnapshot.status as unknown as PartStatus;
      if (partSnapshot.input) part.input = partSnapshot.input;
      if (partSnapshot.output != null) part.output = partSnapshot.output;
      if (partSnapshot.header ?? firstQuestion?.header) {
        part.header = partSnapshot.header ?? firstQuestion?.header ?? undefined;
      }
      if (partSnapshot.question ?? firstQuestion?.question) {
        part.question = partSnapshot.question ?? firstQuestion?.question ?? undefined;
      }
      if (partSnapshot.questionId) part.questionId = partSnapshot.questionId;
      if (partSnapshot.options ?? firstQuestion?.options) {
        part.options = firstQuestion && firstQuestion.options.length > 0
          ? firstQuestion.options
          : normalizeQuestionOptions(partSnapshot.options) ?? undefined;
      }
      if (firstQuestion) part.multiSelect = firstQuestion.multiSelect;
      if (questionItems) part.questions = questionItems;
      if (partSnapshot.extParam) part.extParam = partSnapshot.extParam;
      if (partSnapshot.fileName) part.fileName = partSnapshot.fileName;
      if (partSnapshot.fileUrl) part.fileUrl = partSnapshot.fileUrl;
      if (partSnapshot.fileMime) part.fileMime = partSnapshot.fileMime;
    });
  }
}
