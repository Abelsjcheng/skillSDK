import type {
  Message,
  MessagePart,
  MessagePartSnapshot,
  MessageRole,
  RegenerateAnswerResponse,
  SendMessageResponse,
  SessionMessage,
  SessionMessagePart,
  SessionMessageSnapshot,
} from '../types';

export type RawMessagePart = SessionMessagePart | MessagePartSnapshot;

const MESSAGE_PART_STATUS = new Set(['pending', 'running', 'completed', 'error']);

let nextMsgId = 1;

export function genMessageId(prefix = 'msg'): string {
  return `${prefix}_${Date.now()}_${nextMsgId++}`;
}

export function normalizeRole(role: unknown): MessageRole {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (
    normalized === 'user'
    || normalized === 'assistant'
    || normalized === 'system'
    || normalized === 'tool'
  ) {
    return normalized;
  }
  return 'assistant';
}

function normalizePartStatus(status: unknown): MessagePart['status'] | undefined {
  if (typeof status !== 'string') {
    return undefined;
  }
  return MESSAGE_PART_STATUS.has(status) ? (status as MessagePart['status']) : undefined;
}

export function mapRawPartToMessagePart(rawPart: RawMessagePart, isStreaming: boolean): MessagePart {
  return {
    partId: rawPart.partId,
    type: rawPart.type,
    content: rawPart.content ?? '',
    isStreaming,
    toolName: rawPart.toolName ?? undefined,
    toolCallId: rawPart.toolCallId ?? undefined,
    status: normalizePartStatus(rawPart.status),
    input: rawPart.input ?? undefined,
    output: rawPart.output ?? undefined,
    title: rawPart.title ?? undefined,
    header: rawPart.header ?? undefined,
    question: rawPart.question ?? undefined,
    options: rawPart.options ?? undefined,
    permissionId: rawPart.permissionId ?? undefined,
    permType: rawPart.permType ?? undefined,
    fileName: rawPart.fileName ?? undefined,
    fileUrl: rawPart.fileUrl ?? undefined,
    fileMime: rawPart.fileMime ?? undefined,
  };
}

export function mapRawParts(
  rawParts: RawMessagePart[] | null | undefined,
  isStreaming: boolean,
): MessagePart[] | undefined {
  if (!rawParts || rawParts.length === 0) {
    return undefined;
  }
  return rawParts.map((part) => mapRawPartToMessagePart(part, isStreaming));
}

export function sessionMessageToMessage(sessionMessage: SessionMessage): Message {
  return {
    id: String(sessionMessage.id),
    role: normalizeRole(sessionMessage.role),
    content: sessionMessage.content ?? '',
    timestamp: new Date(sessionMessage.createdAt).getTime(),
    isStreaming: false,
    parts: mapRawParts(sessionMessage.parts, false),
  };
}

export function messageOperationToMessage(
  messageOperation: SendMessageResponse | RegenerateAnswerResponse,
): Message {
  return {
    id: String(messageOperation.id),
    role: normalizeRole(messageOperation.role),
    content: messageOperation.content ?? '',
    timestamp: new Date(messageOperation.createdAt).getTime(),
    isStreaming: false,
    parts: mapRawParts(messageOperation.parts, false),
  };
}

export function snapshotMessageToMessage(snapshot: SessionMessageSnapshot): Message {
  return {
    id: snapshot.id,
    role: normalizeRole(snapshot.role),
    content: snapshot.content ?? '',
    timestamp: snapshot.createdAt ? new Date(snapshot.createdAt).getTime() : Date.now(),
    isStreaming: false,
    parts: mapRawParts(snapshot.parts, false),
  };
}

export function getLatestUserContent(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === 'user' && msg.content.trim()) {
      return msg.content.trim();
    }
  }
  return '';
}

export function syncToolCallIdForQuestionParts(parts: MessagePart[]): MessagePart[] {
  let currentToolCallId: string | undefined;

  return parts.map((part) => {
    if (part.type === 'tool') {
      if (part.toolCallId) {
        currentToolCallId = part.toolCallId;
      }
      return part;
    }

    if (part.type !== 'question') {
      return part;
    }

    if (part.toolCallId) {
      currentToolCallId = part.toolCallId;
      return part;
    }

    if (!currentToolCallId) {
      return part;
    }

    return {
      ...part,
      toolCallId: currentToolCallId,
    };
  });
}
