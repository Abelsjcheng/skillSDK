import type {
  Message,
  MessagePart,
  MessagePartSnapshot,
  MessageRole,
  QuestionOption,
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

export function normalizeQuestionOptions(options: unknown): QuestionOption[] | undefined {
  if (!Array.isArray(options)) {
    return undefined;
  }

  const normalized = options.reduce<QuestionOption[]>((result, option) => {
    if (typeof option === 'string') {
      const label = option.trim();
      if (label) {
        result.push({ label });
      }
      return result;
    }

    if (!option || typeof option !== 'object') {
      return result;
    }

    const label = typeof (option as { label?: unknown }).label === 'string'
      ? (option as { label: string }).label.trim()
      : '';
    if (!label) {
      return result;
    }

    const description = typeof (option as { description?: unknown }).description === 'string'
      ? (option as { description: string }).description.trim()
      : '';

    result.push({
      label,
      ...(description ? { description } : {}),
    });
    return result;
  }, []);

  return normalized.length > 0 ? normalized : undefined;
}

export function extractQuestionFields(
  input: unknown,
): Pick<MessagePart, 'header' | 'question' | 'options'> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const inputRecord = input as {
    header?: unknown;
    question?: unknown;
    options?: unknown;
    questions?: unknown;
  };

  if (Array.isArray(inputRecord.questions) && inputRecord.questions.length > 0) {
    const firstQuestion = inputRecord.questions[0];
    if (firstQuestion && typeof firstQuestion === 'object') {
      const questionRecord = firstQuestion as {
        header?: unknown;
        question?: unknown;
        options?: unknown;
      };
      return {
        header: typeof questionRecord.header === 'string' ? questionRecord.header : undefined,
        question: typeof questionRecord.question === 'string' ? questionRecord.question : undefined,
        options: normalizeQuestionOptions(questionRecord.options),
      };
    }
  }

  return {
    header: typeof inputRecord.header === 'string' ? inputRecord.header : undefined,
    question: typeof inputRecord.question === 'string' ? inputRecord.question : undefined,
    options: normalizeQuestionOptions(inputRecord.options),
  };
}

function normalizeResolvedStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function mapRawPartToMessagePart(rawPart: RawMessagePart, isStreaming: boolean): MessagePart {
  const questionFields = extractQuestionFields(rawPart.input);
  const rawStatus = normalizeResolvedStatus(rawPart.status);
  const normalizedStatus = normalizePartStatus(rawPart.status);
  const normalizedOutput = typeof rawPart.output === 'string' ? rawPart.output : undefined;
  const normalizedResponse = typeof rawPart.response === 'string' ? rawPart.response : undefined;
  const normalizedQuestion = rawPart.question ?? questionFields.question ?? undefined;
  const questionAnswered = rawPart.type === 'question'
    && (
      (rawPart as { answered?: boolean | null }).answered === true
      || rawStatus === 'completed'
      || rawStatus === 'error'
      || Boolean(normalizedOutput?.trim())
    );
  const permissionResolved = rawPart.type === 'permission'
    && (
      Boolean(normalizedResponse?.trim())
      || rawStatus === 'completed'
      || rawStatus === 'resolved'
      || rawStatus === 'approved'
      || rawStatus === 'rejected'
    );
  const normalizedContent = rawPart.type === 'permission'
    ? (rawPart.content ?? rawPart.title ?? '')
    : (rawPart.content ?? normalizedQuestion ?? '');

  return {
    partId: rawPart.partId,
    type: rawPart.type,
    content: normalizedContent,
    isStreaming,
    toolName: rawPart.toolName ?? undefined,
    toolCallId: rawPart.toolCallId ?? undefined,
    status: normalizedStatus,
    input: rawPart.input ?? undefined,
    output: normalizedOutput,
    title: rawPart.title ?? undefined,
    header: rawPart.header ?? questionFields.header ?? undefined,
    question: normalizedQuestion,
    options: questionFields.options ?? normalizeQuestionOptions(rawPart.options) ?? undefined,
    answered: questionAnswered || undefined,
    permissionId: rawPart.permissionId ?? undefined,
    permType: rawPart.permType ?? undefined,
    response: normalizedResponse,
    permResolved: permissionResolved || undefined,
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
    contentType: sessionMessage.contentType ?? 'plain',
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
    contentType: messageOperation.contentType ?? 'plain',
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
    contentType: snapshot.contentType ?? 'plain',
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
