import type {
  Message,
  MessagePart,
  MessagePartSnapshot,
  MessageRole,
  QuestionAnswerMatrix,
  QuestionItem,
  QuestionOption,
  RegenerateAnswerResponse,
  SendMessageResponse,
  SessionMessage,
  SessionMessagePart,
  SessionMessageSnapshot,
  SubagentStatus,
} from '../types';

export type RawMessagePart = SessionMessagePart | MessagePartSnapshot;

const MESSAGE_PART_STATUS = new Set(['pending', 'running', 'completed', 'error']);

let nextMsgId = 1;

interface QuestionFieldSource {
  header?: unknown;
  question?: unknown;
  options?: unknown;
  multiSelect?: unknown;
  questions?: unknown;
  content?: unknown;
}

interface MapRawPartOptions {
  allowInputQuestionsFallback?: boolean;
}

interface QuestionAnswerDisplayLabels {
  unanswered?: string;
  questionPrefix?: string;
  answerSeparator?: string;
  questionTitle?: (index: number) => string;
}

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

export function collectUserMessageIds(messages: Message[]): Set<string> {
  return new Set(
    messages
      .filter((message) => normalizeRole(message.role) === 'user')
      .map((message) => message.id),
  );
}

function hasVisibleText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function contentTypeForRole(role: Message['role']): NonNullable<Message['contentType']> {
  switch (role) {
    case 'assistant':
      return 'markdown';
    case 'tool':
      return 'code';
    default:
      return 'plain';
  }
}

// `updateLatestQuestionPart` 已被合并为通用的 `updateLatestPart`，
// 原先的导出已移除以简化公共 API。保留 `updateLatestPart` 供内部使用。

export function updateLatestPart(
  messages: Message[],
  partType: MessagePart['type'],
  matcher: (part: MessagePart) => boolean,
  updater: (part: MessagePart) => MessagePart,
): Message[] {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (!message.parts || message.parts.length === 0) {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts[partIndex];
      if (part.type !== partType || !matcher(part)) {
        continue;
      }

      const nextMessages = [...messages];
      const nextParts = [...message.parts];
      nextParts[partIndex] = updater(part);
      nextMessages[messageIndex] = {
        ...message,
        isStreaming: false,
        parts: nextParts,
      };
      return nextMessages;
    }
  }

  return messages;
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

function normalizeQuestionRecord(record: unknown): QuestionItem | undefined {
  if (!record || typeof record !== 'object') {
    return undefined;
  }

  const questionRecord = record as {
    header?: unknown;
    question?: unknown;
    options?: unknown;
    multiSelect?: unknown;
  };
  const header = normalizeOptionalString(questionRecord.header);
  const question = normalizeOptionalString(questionRecord.question) ?? '';
  const options = normalizeQuestionOptions(questionRecord.options) ?? [];
  const multiSelect = normalizeBoolean(questionRecord.multiSelect) ?? false;

  if (!header && !question.trim() && options.length === 0) {
    return undefined;
  }

  return {
    ...(header ? { header } : {}),
    question,
    options,
    multiSelect,
  };
}

function normalizeQuestionRecords(records: unknown): QuestionItem[] | undefined {
  if (!Array.isArray(records)) {
    return undefined;
  }

  const normalized = records.reduce<QuestionItem[]>((result, record) => {
    const question = normalizeQuestionRecord(record);
    if (question) {
      result.push(question);
    }
    return result;
  }, []);

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeQuestionItems(source: QuestionFieldSource): QuestionItem[] | undefined {
  const directQuestions = normalizeQuestionRecords(source.questions);
  if (directQuestions) {
    return directQuestions;
  }

  const header = normalizeOptionalString(source.header);
  const question = normalizeOptionalString(source.question)
    ?? normalizeOptionalString(source.content)
    ?? '';
  const options = normalizeQuestionOptions(source.options) ?? [];
  const multiSelect = normalizeBoolean(source.multiSelect) ?? false;

  if (!header && !question.trim() && options.length === 0) {
    return undefined;
  }

  return [{
    ...(header ? { header } : {}),
    question,
    options,
    multiSelect,
  }];
}

export function serializeQuestionAnswerMatrix(answer: QuestionAnswerMatrix): string {
  return JSON.stringify(answer);
}

export function serializeQuestionAnswerContent(answer: QuestionAnswerMatrix): string {
  if (answer.length === 1) {
    const firstQuestionAnswers = answer[0] ?? [];
    if (firstQuestionAnswers.length === 1) {
      const singleAnswer = firstQuestionAnswers[0]?.trim();
      if (singleAnswer) {
        return singleAnswer;
      }
    }
  }

  return serializeQuestionAnswerMatrix(answer);
}

export function parseQuestionAnswerMatrix(value: unknown): QuestionAnswerMatrix | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const normalized = parsed.map((item) => {
      if (!Array.isArray(item)) {
        return null;
      }
      return item
        .filter((answer): answer is string => typeof answer === 'string')
        .map((answer) => answer.trim())
        .filter(Boolean);
    });

    if (normalized.some((item) => item === null)) {
      return undefined;
    }

    return normalized as QuestionAnswerMatrix;
  } catch {
    return undefined;
  }
}

export function alignQuestionAnswerMatrix(
  questions: QuestionItem[],
  answer: QuestionAnswerMatrix,
): QuestionAnswerMatrix {
  return questions.map((_, index) => answer[index] ?? []);
}

export function formatQuestionAnswerDisplay(
  questions: QuestionItem[],
  answer: QuestionAnswerMatrix,
  labels: QuestionAnswerDisplayLabels = {},
): string {
  const unanswered = labels.unanswered ?? '未回答';
  const questionPrefix = labels.questionPrefix ?? '第';
  const answerSeparator = labels.answerSeparator ?? '、';
  const questionCount = Math.max(questions.length, answer.length);
  const lines: string[] = [];

  for (let index = 0; index < questionCount; index += 1) {
    const question = questions[index];
    const title = question?.question?.trim()
      || question?.header?.trim()
      || labels.questionTitle?.(index)
      || `${questionPrefix}${index + 1}题`;
    const answers = answer[index] ?? [];
    lines.push(`${title}: ${answers.length > 0 ? answers.join(answerSeparator) : unanswered}`);
  }

  return lines.join('\n');
}

function normalizeResolvedStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

function getInputQuestions(input: unknown): unknown | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  return (input as { questions?: unknown }).questions;
}

export function mapRawPartToMessagePart(
  rawPart: RawMessagePart,
  isStreaming: boolean,
  options: MapRawPartOptions = {},
): MessagePart {
  const fallbackQuestions = rawPart.type === 'question'
    && options.allowInputQuestionsFallback
    && rawPart.questions == null
    ? getInputQuestions(rawPart.input)
    : undefined;
  const questionItems = normalizeQuestionItems({
    header: rawPart.header,
    question: rawPart.question,
    options: rawPart.options,
    multiSelect: rawPart.multiSelect,
    questions: rawPart.questions ?? fallbackQuestions,
    content: rawPart.content,
  });
  const firstQuestion = questionItems?.[0];
  const rawStatus = normalizeResolvedStatus(rawPart.status);
  const normalizedStatus = normalizePartStatus(rawPart.status);
  const normalizedOutput = typeof rawPart.output === 'string' ? rawPart.output : undefined;
  const normalizedResponse = typeof rawPart.response === 'string' ? rawPart.response : undefined;
  const normalizedQuestion = firstQuestion?.question || rawPart.question || undefined;
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
    header: rawPart.header ?? firstQuestion?.header ?? undefined,
    question: normalizedQuestion,
    questionId: rawPart.questionId ?? undefined,
    options: firstQuestion && firstQuestion.options.length > 0
      ? firstQuestion.options
      : normalizeQuestionOptions(rawPart.options) ?? undefined,
    answered: questionAnswered || undefined,
    permissionId: rawPart.permissionId ?? undefined,
    permType: rawPart.permType ?? undefined,
    response: normalizedResponse,
    permResolved: permissionResolved || undefined,
    fileName: rawPart.fileName ?? undefined,
    fileUrl: rawPart.fileUrl ?? undefined,
    fileMime: rawPart.fileMime ?? undefined,
    multiSelect: firstQuestion?.multiSelect ?? rawPart.multiSelect ?? undefined,
    questions: questionItems,
    extParam: rawPart.extParam ?? undefined,
    subagentSessionId: rawPart.subagentSessionId ?? undefined,
    subagentName: rawPart.subagentName ?? undefined,
  };
}

export function mapRawParts(
  rawParts: RawMessagePart[] | null | undefined,
  isStreaming: boolean,
  options: MapRawPartOptions = {},
): MessagePart[] | undefined {
  if (!rawParts || rawParts.length === 0) {
    return undefined;
  }
  return rawParts.map((part) => mapRawPartToMessagePart(part, isStreaming, options));
}

export function shouldRenderMessagePart(part: MessagePart): boolean {
  switch (part.type) {
    case 'text':
    case 'thinking':
    case 'error':
      return hasVisibleText(part.content);
    case 'tool':
      return hasVisibleText(part.content)
        || hasVisibleText(part.toolName)
        || hasVisibleText(part.title)
        || hasVisibleText(part.output)
        || hasVisibleText(part.error)
        || Boolean(part.input)
        || Boolean(part.status);
    case 'question':
      return hasVisibleText(part.content)
        || hasVisibleText(part.header)
        || hasVisibleText(part.question)
        || Boolean(part.options?.length)
        || Boolean(part.questions?.some((question) => (
          hasVisibleText(question.header)
          || hasVisibleText(question.question)
          || question.options.length > 0
        )))
        || hasVisibleText(part.output)
        || Boolean(part.answered);
    case 'permission':
      return hasVisibleText(part.content)
        || hasVisibleText(part.permType)
        || hasVisibleText(part.permissionId)
        || hasVisibleText(part.response)
        || Boolean(part.permResolved);
    case 'file':
      return hasVisibleText(part.content)
        || hasVisibleText(part.fileName)
        || hasVisibleText(part.fileUrl);
    case 'subtask':
      return hasVisibleText(part.subagentName)
        || hasVisibleText(part.subagentPrompt)
        || Boolean(part.subParts?.some(shouldRenderMessagePart));
    default:
      return hasVisibleText(part.content);
  }
}

export function shouldRenderMessage(message: Message): boolean {
  if (message.parts?.some(shouldRenderMessagePart)) {
    return true;
  }

  return hasVisibleText(message.content);
}

export function sessionMessageToMessage(sessionMessage: SessionMessage): Message {
  return {
    id: String(sessionMessage.id),
    role: normalizeRole(sessionMessage.role),
    content: sessionMessage.content ?? '',
    contentType: sessionMessage.contentType ?? 'plain',
    timestamp: new Date(sessionMessage.createdAt).getTime(),
    isStreaming: false,
    parts: mapRawParts(sessionMessage.parts, false, { allowInputQuestionsFallback: true }),
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

function extractSubtaskPreview(part: MessagePart): string | undefined {
  switch (part.type) {
    case 'text':
    case 'thinking':
    case 'error':
      return hasVisibleText(part.content) ? part.content.trim() : undefined;
    case 'tool':
      if (hasVisibleText(part.title)) return part.title!.trim();
      if (hasVisibleText(part.toolName)) return part.toolName!.trim();
      if (hasVisibleText(part.output)) return part.output!.trim();
      return undefined;
    case 'file':
      return hasVisibleText(part.fileName) ? part.fileName!.trim() : undefined;
    case 'question':
      return hasVisibleText(part.question) ? part.question!.trim() : undefined;
    case 'permission':
      return hasVisibleText(part.content) ? part.content.trim() : undefined;
    default:
      return undefined;
  }
}

function resolveSubagentStatus(parts: MessagePart[]): SubagentStatus {
  const hasError = parts.some((part) =>
    part.type === 'error'
    || part.status === 'error'
    || (part.type === 'tool' && hasVisibleText(part.content))
  );
  if (hasError) {
    return 'error';
  }

  const isRunning = parts.some((part) =>
    part.isStreaming
    || part.status === 'pending'
    || part.status === 'running'
    || (part.type === 'question' && !part.answered)
    || (part.type === 'permission' && !part.permResolved)
  );
  return isRunning ? 'running' : 'completed';
}

function createSubtaskContainer(subagentSessionId: string, subagentName?: string): MessagePart {
  return {
    partId: `subtask_${subagentSessionId}`,
    type: 'subtask',
    content: '',
    isStreaming: false,
    subagentSessionId,
    subagentName,
    subParts: [],
  };
}

export function groupMessagePartsForDisplay(parts: MessagePart[]): MessagePart[] {
  const groupedParts: MessagePart[] = [];
  const subtasks = new Map<string, MessagePart>();

  for (const part of parts) {
    const subagentSessionId = part.subagentSessionId?.trim();
    if (!subagentSessionId) {
      groupedParts.push(part);
      continue;
    }

    let subtask = subtasks.get(subagentSessionId);
    if (!subtask) {
      subtask = createSubtaskContainer(subagentSessionId, part.subagentName);
      subtasks.set(subagentSessionId, subtask);
      groupedParts.push(subtask);
    }

    if (!subtask.subagentName && part.subagentName) {
      subtask.subagentName = part.subagentName;
    }

    const subParts = subtask.subParts ?? [];
    subParts.push(part);
    subtask.subParts = subParts;
    subtask.isStreaming = subParts.some((item) => item.isStreaming);

    if (!subtask.subagentPrompt) {
      const preview = extractSubtaskPreview(part);
      if (preview) {
        subtask.subagentPrompt = preview;
      }
    }
  }

  for (const subtask of subtasks.values()) {
    const subParts = subtask.subParts ?? [];
    subtask.subagentStatus = resolveSubagentStatus(subParts);
    if (!subtask.subagentPrompt) {
      subtask.subagentPrompt = subtask.subagentName;
    }
  }

  return groupedParts;
}
