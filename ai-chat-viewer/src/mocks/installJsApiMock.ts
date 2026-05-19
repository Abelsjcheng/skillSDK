import type {
  GetSessionMessageHistoryResponse,
  GetSessionMessageResponse,
  RegenerateAnswerResponse,
  SendMessageResponse,
  SessionMessage,
  StreamMessage,
} from '../types';
import type { CreateDigitalTwinParams, InternalAssistantOption } from '../types/digitalTwin';
import type {
  AgentTypeListResult,
  CreateDigitalTwinResult,
  CreateNewSessionParams,
  DeleteWeAgentParams,
  DeleteWeAgentResult,
  GetSessionMessageHistoryParams,
  GetHistorySessionsListParams,
  GetSessionMessageParams,
  GetWeAgentDetailsParams,
  GetWeAgentListParams,
  HWH5EXT,
  HistorySessionsListResult,
  NotifyAssistantDetailUpdatedParams,
  NotifyAssistantDetailUpdatedResult,
  OpenWeAgentCUIParams,
  OpenWeAgentCUIResult,
  QueryQrcodeInfoResult,
  RegenerateAnswerParams,
  RegisterSessionListenerParams,
  ReplyPermissionParams,
  SendMessageParams,
  SendMessageToIMParams,
  SkillSession,
  StopSkillParams,
  UnregisterSessionListenerParams,
  UpdateWeAgentParams,
  UpdateWeAgentResult,
  UpdateQrcodeInfoResult,
  WeAgentDetails,
  WeAgentDetailsArrayResult,
  WeAgentListResult,
  WeAgentUriResult,
} from '../types/bridge';
import { HOST } from '../constants';
import { WeLog } from '../utils/logger';

interface MockHWH5Bridge {
  openWebview?: (payload: { uri: string }) => void;
  showToast?: (payload: { msg: string; type: 'w' }) => Promise<unknown> | unknown;
  reboot?: () => Promise<unknown> | unknown;
  addEventListener?: (params: { type: 'back'; func: () => boolean }) => Promise<unknown> | unknown;
  getDeviceInfo?: () => Promise<{ statusBarHeight: number }>;
  getAppInfo?: () => Promise<{ language: string }>;
  getUserInfo?: () => Promise<{
    uid: string;
    userNameZH: string;
    userNameEN: string;
    corpUserId: string;
  }>;
  getAccountInfo?: () => Promise<string>;
  navigateBack: () => void;
  close: () => void;
}

interface SessionRecord {
  session: SkillSession;
  messages: SessionMessage[];
  nextMessageSeq: number;
  nextStreamSeq: number;
  timerIds: number[];
  continuationScheduled?: boolean;
  activeReplayDraft?: ActiveReplayDraft | null;
}

interface SessionListener {
  onMessage: RegisterSessionListenerParams['onMessage'];
  onError?: RegisterSessionListenerParams['onError'];
  onClose?: RegisterSessionListenerParams['onClose'];
}

interface ActiveReplayDraft {
  messageId: string;
  thinkingPartId: string;
  textPartId: string;
  thinkingContent: string;
  partialText: string;
  finalText: string;
}

interface SessionRoundBuffer {
  welinkSessionId: string;
  events: StreamMessage[];
  createdAt: number;
  updatedAt: number;
  completed: boolean;
}

interface ReplayState {
  replaying: boolean;
  pendingLiveEvents: StreamMessage[];
}

interface SubagentMockContext {
  subagentSessionId: string;
  subagentName: string;
}

type MockReplyScenario =
  | {
    type: 'normal';
    assistantContent: string;
  }
  | {
    type: 'session.error' | 'error';
    prelude: string;
    errorMessage: string;
  }
  | {
    type: 'thinking';
    thinkingContent: string;
    assistantContent: string;
  }
  | {
    type: 'tool';
    toolName: string;
    toolTitle: string;
    toolInput: Record<string, unknown>;
    toolOutput: string;
    assistantContent: string;
  }
  | {
    type: 'question';
    toolCallId: string;
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
  }
  | {
    type: 'permission';
    permissionId: string;
    permType: string;
    toolName: string;
    title: string;
    content: string;
    assistantContent: string;
  }
  | {
    type: 'file';
    assistantContent: string;
    fileName: string;
    fileUrl: string;
    fileMime: string;
  }
  | {
    type: 'step';
    assistantContent: string;
    tokens: NonNullable<StreamMessage['tokens']>;
    cost: number;
  }
  | {
    type: 'snapshot';
    assistantContent: string;
  }
  | {
    type: 'streaming';
    thinkingContent: string;
    partialText: string;
    finalText: string;
  }
  | {
    type: 'session.title';
    title: string;
    assistantContent: string;
  }
  | {
    type: 'message.user';
    userContent: string;
  }
  | {
    type: 'agent.online' | 'agent.offline';
    assistantContent: string;
  }
  | {
    type: 'subagent.basic';
    introContent: string;
    finalContent: string;
    subagent: SubagentMockContext;
    thinkingContent: string;
    toolName: string;
    toolTitle: string;
    toolInput: Record<string, unknown>;
    toolOutput: string;
    subagentContent: string;
  }
  | {
    type: 'subagent.question';
    introContent: string;
    subagent: SubagentMockContext;
    toolCallId: string;
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
  }
  | {
    type: 'subagent.permission';
    introContent: string;
    subagent: SubagentMockContext;
    permissionId: string;
    permType: string;
    toolName: string;
    title: string;
    content: string;
  };

declare global {
  interface Window {
    __AI_CHAT_VIEWER_JSAPI_MOCK__?: boolean;
  }
}

const URL_BASE = 'https://ai-chat-viewer.mock.local';
const BASE_PAGE_URI = `${HOST()}/index.html`;
const DEFAULT_ASSISTANT_ACCOUNT = 'mock_assistant_001';
const MOCK_UID = 'mock_uid_10001';
const DEFAULT_PAGE_SIZE = 50;
const SUBAGENT_BASIC_PREFIX = 'subagent_basic';
const SUBAGENT_QUESTION_PREFIX = 'subagent_question';
const SUBAGENT_PERMISSION_PREFIX = 'subagent_permission';
const DEFAULT_SKILL_CUI_WELINK_SESSION_ID = 'mock_skill_cui_session_001';
const DEFAULT_SKILL_CUI_REPLAY_WELINK_SESSION_ID = 'mock_skill_cui_replay_session_001';

let idCounter = 0;
let currentAssistantAccount = DEFAULT_ASSISTANT_ACCOUNT;
let defaultSkillCUIWelinkSessionId = DEFAULT_SKILL_CUI_WELINK_SESSION_ID;

const assistantDetailsStore = new Map<string, WeAgentDetails>();
const sessionStore = new Map<string, SessionRecord>();
const listeners = new Map<string, SessionListener>();
const roundBufferStore = new Map<string, SessionRoundBuffer>();
const replayStateStore = new Map<string, ReplayState>();

function cloneAssistantDetail(detail: WeAgentDetails): WeAgentDetails {
  return { ...detail };
}

function findAssistantDetail(params: { partnerAccount?: string; robotId?: string }): WeAgentDetails | null {
  const partnerAccount = params.partnerAccount?.trim() ?? '';
  if (partnerAccount) {
    return assistantDetailsStore.get(partnerAccount) ?? null;
  }

  const robotId = params.robotId?.trim() ?? '';
  if (!robotId) {
    return null;
  }

  return Array.from(assistantDetailsStore.values()).find((detail) => detail.id === robotId) ?? null;
}

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseUrl(value: string, base = URL_BASE): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function toRouteHash(path: string, query?: Record<string, string>): string {
  const routeUrl = new URL(path, URL_BASE);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) {
      routeUrl.searchParams.set(key, value);
    }
  });
  return `#${routeUrl.pathname}${routeUrl.search}`;
}

function appendQuery(uri: string, key: string, value: string): string {
  const parsed = parseUrl(uri);
  if (!parsed) return uri;
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function buildAssistantPageUri(partnerAccount: string, hash: 'assistantDetail' | 'switchAssistant'): string {
  const parsed = parseUrl(BASE_PAGE_URI);
  if (!parsed) return BASE_PAGE_URI;
  parsed.searchParams.set('partnerAccount', partnerAccount);
  parsed.hash = hash;
  return parsed.toString();
}

function buildExternalWeAgentUri(partnerAccount: string): string {
  const parsed = parseUrl(BASE_PAGE_URI);
  if (!parsed) return BASE_PAGE_URI;
  parsed.searchParams.set('assistantAccount', partnerAccount);
  parsed.hash = 'weAgentCUI';
  return parsed.toString();
}

function splitReplyContent(content: string): string[] {
  const chunks: string[] = [];
  let cursor = 0;
  const chunkSize = 12;
  while (cursor < content.length) {
    chunks.push(content.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }
  return chunks.length > 0 ? chunks : [content];
}

function buildTextPart(
  partId: string,
  content: string,
  partSeq = 1,
  subagent?: SubagentMockContext,
  status: 'completed' | 'running' = 'completed',
): SessionMessage['parts'] {
  return [{
    partId,
    partSeq,
    type: 'text',
    content,
    status,
    ...(subagent
      ? {
        subagentSessionId: subagent.subagentSessionId,
        subagentName: subagent.subagentName,
      }
      : {}),
  }];
}

function buildThinkingPart(
  partId: string,
  content: string,
  partSeq = 1,
  subagent?: SubagentMockContext,
): NonNullable<SessionMessage['parts']>[number] {
  return {
    partId,
    partSeq,
    type: 'thinking',
    content,
    status: 'completed',
    ...(subagent
      ? {
        subagentSessionId: subagent.subagentSessionId,
        subagentName: subagent.subagentName,
      }
      : {}),
  };
}

function buildToolPart(
  partId: string,
  toolName: string,
  title: string,
  input: Record<string, unknown>,
  output: string,
  toolCallId: string,
  partSeq = 1,
  subagent?: SubagentMockContext,
): NonNullable<SessionMessage['parts']>[number] {
  return {
    partId,
    partSeq,
    type: 'tool',
    content: '',
    status: 'completed',
    toolName,
    title,
    toolCallId,
    input,
    output,
    ...(subagent
      ? {
        subagentSessionId: subagent.subagentSessionId,
        subagentName: subagent.subagentName,
      }
      : {}),
  };
}

function buildQuestionPart(
  partId: string,
  toolCallId: string,
  header: string,
  question: string,
  options: Array<{ label: string; description?: string }>,
  partSeq = 1,
  subagent?: SubagentMockContext,
): NonNullable<SessionMessage['parts']>[number] {
  return {
    partId,
    partSeq,
    type: 'question',
    content: question,
    status: 'running',
    toolCallId,
    header,
    question,
    options,
    ...(subagent
      ? {
        subagentSessionId: subagent.subagentSessionId,
        subagentName: subagent.subagentName,
      }
      : {}),
  };
}

function buildPermissionPart(
  partId: string,
  permissionId: string,
  permType: string,
  toolName: string,
  title: string,
  content: string,
  response?: ReplyPermissionParams['response'],
  partSeq = 1,
  subagent?: SubagentMockContext,
): NonNullable<SessionMessage['parts']>[number] {
  return {
    partId,
    partSeq,
    type: 'permission',
    content,
    status: response ? 'completed' : 'running',
    permissionId,
    permType,
    toolName,
    title,
    response,
    ...(subagent
      ? {
        subagentSessionId: subagent.subagentSessionId,
        subagentName: subagent.subagentName,
      }
      : {}),
  };
}

function buildFilePart(
  partId: string,
  fileName: string,
  fileUrl: string,
  fileMime: string,
  partSeq = 1,
  subagent?: SubagentMockContext,
): NonNullable<SessionMessage['parts']>[number] {
  return {
    partId,
    partSeq,
    type: 'file',
    content: fileName,
    status: 'completed',
    fileName,
    fileUrl,
    fileMime,
    ...(subagent
      ? {
        subagentSessionId: subagent.subagentSessionId,
        subagentName: subagent.subagentName,
      }
      : {}),
  };
}

function createAssistantMessage(
  sessionId: string,
  content: string,
  messageSeq: number,
  parts: SessionMessage['parts'],
  meta: object | null = null,
): SessionMessage {
  const createdAt = nowIso();
  return {
    id: nextId('msg_assistant'),
    seq: messageSeq,
    welinkSessionId: sessionId,
    role: 'assistant',
    content,
    contentType: 'plain',
    meta,
    messageSeq,
    parts,
    createdAt,
  };
}

function cloneSessionMessage(message: SessionMessage): SessionMessage {
  return {
    ...message,
    meta: message.meta ? { ...message.meta } : null,
    parts: message.parts ? message.parts.map((part) => ({ ...part })) : null,
  };
}

function toSnapshotMessage(message: SessionMessage): NonNullable<StreamMessage['messages']>[number] {
  return {
    ...cloneSessionMessage(message),
    parts: message.parts ? message.parts.map((part) => ({ ...part })) : undefined,
  };
}

function cloneSession(session: SkillSession): SkillSession {
  return { ...session };
}

function createSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createAvatar(label: string, bg: string): string {
  return createSvgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
      <rect width="72" height="72" rx="19" fill="${bg}" />
      <text x="36" y="41" text-anchor="middle" font-size="18" fill="#ffffff" font-weight="700">${label}</text>
    </svg>`,
  );
}

function createAgentIcon(label: string, bg: string): string {
  return createSvgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <rect width="20" height="20" rx="6" fill="${bg}" />
      <text x="10" y="13" text-anchor="middle" font-size="10" fill="#ffffff" font-weight="700">${label}</text>
    </svg>`,
  );
}

function buildAssistantReply(content: string): string {
  const trimmed = content.trim();
  return [
    `Received your request: ${trimmed}`,
    '',
    'This response is generated by local JSAPI mock for WeAgentCUI integration.',
    '- Supports creating and switching sessions',
    '- Supports history message rendering',
    '- Supports streaming text updates',
  ].join('\n');
}

function buildMockFileUrl(fileName: string): string {
  return `${URL_BASE}/downloads/${encodeURIComponent(fileName)}`;
}

function matchesMockKeyword(normalized: string, keywords: string[]): boolean {
  return keywords.some((keyword) => normalized.includes(keyword));
}

function createSubagentContext(prefix: string, subagentName: string): SubagentMockContext {
  return {
    subagentSessionId: nextId(prefix),
    subagentName,
  };
}

function matchesSubagentSession(subagentSessionId: string | undefined, prefix: string): boolean {
  return Boolean(subagentSessionId && subagentSessionId.startsWith(`${prefix}_`));
}

function resolveSubagentName(subagentSessionId: string): string {
  if (matchesSubagentSession(subagentSessionId, SUBAGENT_QUESTION_PREFIX)) {
    return 'Platform Planner';
  }
  if (matchesSubagentSession(subagentSessionId, SUBAGENT_PERMISSION_PREFIX)) {
    return 'Workspace Writer';
  }
  return 'Code Indexer';
}

function resolveMockReplyScenario(content: string): MockReplyScenario {
  const normalized = content.trim().toLowerCase();

  if (
    normalized.includes('触发session.error')
    || normalized.includes('mock-session-error')
    || normalized.includes('session.error')
  ) {
    return {
      type: 'session.error',
      prelude: 'Mock AI is preparing an answer before session-level failure...',
      errorMessage: 'Mock session error: agent connection lost while generating response.',
    };
  }

  if (
    normalized.includes('触发error事件')
    || normalized.includes('触发ai错误')
    || normalized.includes('mock-error')
    || normalized === 'error'
  ) {
    return {
      type: 'error',
      prelude: 'Mock AI is preparing an answer before generic stream failure...',
      errorMessage: 'Mock stream error: internal server error from local JSAPI mock.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-thinking', 'trigger-thinking', '触发thinking'])) {
    return {
      type: 'thinking',
      thinkingContent: [
        '1. Read the route entry and assistantAccount query.',
        '2. Initialize or reuse the latest available session.',
        '3. Register the listener and assemble mixed message parts.',
      ].join('\n'),
      assistantContent: [
        'Thinking flow verified.',
        '',
        '- The page reads `assistantAccount` from the route.',
        '- Session init and listener registration happen in `App.tsx`.',
        '- Thinking and text parts are rendered in the same assistant message.',
      ].join('\n'),
    };
  }

  if (matchesMockKeyword(normalized, ['mock-codeblock', 'trigger-codeblock', '触发代码块样式'])) {
    return {
      type: 'normal',
      assistantContent: [
        '使用 Python 的 PIL/Pillow 库去去除背景。代码逻辑分以下四步：',
        '',
        '1. 把图片转成 RGBA 模式（带透明通道）',
        '2. 识别背景颜色（灰色区域）',
        '3. 把那些像素点的 alpha 通道设为 0（变透明）',
        '4. 导出处理后的 PNG 图片',
        '',
        '具体代码：',
        '',
        '```cpp',
        'class Solution {',
        'public:',
        '    int countTestedDevices(vector<int>& batteryPercentages) {',
        '        int tested = 0;',
        '        for (int battery : batteryPercentages) {',
        '            if (battery - tested > 0) {',
        '                tested++;',
        '            }',
        '        }',
        '        return tested;',
        '    }',
        '};',
        '',
        'class Solution {',
        'public:',
        '    int countTestedDevices(vector<int>& batteryPercentages) {',
        '        int tested = 0;',
        '        for (int i = 0; i < static_cast<int>(batteryPercentages.size()); ++i) {',
        '            if (batteryPercentages[i] > tested) {',
        '                tested += 1;',
        '            }',
        '        }',
        '        return tested;',
        '    }',
        '};',
        '```',
      ].join('\n'),
    };
  }

  if (matchesMockKeyword(normalized, ['mock-tool', 'trigger-tool', '触发tool'])) {
    return {
      type: 'tool',
      toolName: 'code_search',
      toolTitle: 'Locate weAgentCUI entry and renderer',
      toolInput: {
        query: 'weAgentCUI App.tsx StreamAssembler MessageBubble',
      },
      toolOutput: 'Matched src/pages/weAgentCUI.tsx, src/App.tsx, src/protocol/StreamAssembler.ts, src/components/MessageBubble.tsx',
      assistantContent: 'Tool execution finished. The core flow has been located and summarized.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-subagent-question', 'trigger-subagent-question', '触发subagent-question'])) {
    return {
      type: 'subagent.question',
      introContent: 'I am delegating platform confirmation to a subagent before continuing the main task.',
      subagent: createSubagentContext(SUBAGENT_QUESTION_PREFIX, 'Platform Planner'),
      toolCallId: nextId('tool_call_subagent_question'),
      header: 'Subagent needs your input',
      question: 'Which platform should the follow-up implementation plan prioritize?',
      options: [
        { label: 'Android', description: 'Continue with Java/Kotlin implementation details' },
        { label: 'iOS', description: 'Continue with Objective-C/Swift implementation details' },
        { label: 'HarmonyOS', description: 'Continue with ArkTS implementation details' },
      ],
    };
  }

  if (matchesMockKeyword(normalized, ['mock-subagent-permission', 'trigger-subagent-permission', '触发subagent-permission'])) {
    return {
      type: 'subagent.permission',
      introContent: 'I delegated file generation to a subagent and it is now requesting write permission.',
      subagent: createSubagentContext(SUBAGENT_PERMISSION_PREFIX, 'Workspace Writer'),
      permissionId: nextId('perm_subagent_write'),
      permType: 'file_write',
      toolName: 'write_case_markdown',
      title: 'Subagent wants to write a case file',
      content: 'The subagent plans to generate a markdown case under docs/subagent-cases/.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-subagent', 'trigger-subagent', '触发subagent'])) {
    return {
      type: 'subagent.basic',
      introContent: 'I split this request into a dedicated subagent to inspect the UI rendering path.',
      finalContent: 'The subagent finished its inspection and the main flow can continue with the summarized result.',
      subagent: createSubagentContext(SUBAGENT_BASIC_PREFIX, 'Code Indexer'),
      thinkingContent: [
        '1. Locate the message render path.',
        '2. Group subagent-tagged parts into a visual subtask block.',
        '3. Bubble interactive cards back to the main flow when required.',
      ].join('\n'),
      toolName: 'code_search',
      toolTitle: 'Inspect subagent rendering pipeline',
      toolInput: {
        query: 'MessageBubble groupMessagePartsForDisplay SubtaskBlock',
      },
      toolOutput: 'Matched MessageBubble.tsx, utils/message.ts, and SubtaskBlock.tsx.',
      subagentContent: 'The subagent confirmed that subagent-tagged parts are grouped at render time and remain compatible with history and streaming recovery.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-question', 'trigger-question', '触发question'])) {
    return {
      type: 'question',
      toolCallId: nextId('tool_call_question'),
      header: 'Need your confirmation',
      question: 'Which platform should this requirement prioritize first?',
      options: [
        { label: 'Android', description: 'Focus on Java/Kotlin SDK changes' },
        { label: 'iOS', description: 'Focus on Objective-C/Swift SDK changes' },
        { label: 'HarmonyOS', description: 'Focus on ArkTS SDK changes' },
      ],
    };
  }

  if (matchesMockKeyword(normalized, ['mock-permission', 'trigger-permission', '触发permission'])) {
    return {
      type: 'permission',
      permissionId: nextId('perm_write'),
      permType: 'file_write',
      toolName: 'write_markdown',
      title: 'Need permission to write a markdown file',
      content: 'The assistant wants to create a case document under docs/.',
      assistantContent: 'Permission request emitted. Please approve or reject it from the card.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-file', 'trigger-file', '触发file'])) {
    return {
      type: 'file',
      assistantContent: 'The file result is attached below for verification.',
      fileName: 'mock-release-notes.md',
      fileUrl: buildMockFileUrl('mock-release-notes.md'),
      fileMime: 'text/markdown',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-step', 'trigger-step', '触发step'])) {
    return {
      type: 'step',
      assistantContent: 'Step metrics have been produced and attached to the current message meta.',
      tokens: {
        input: 128,
        output: 256,
        reasoning: 96,
        cache: {
          read: 64,
          write: 0,
        },
      },
      cost: 0.0025,
    };
  }

  if (matchesMockKeyword(normalized, ['mock-snapshot', 'trigger-snapshot', '触发snapshot'])) {
    return {
      type: 'snapshot',
      assistantContent: 'Snapshot recovery replaced the current message list with recovered conversation data.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-streaming', 'trigger-streaming', '触发streaming'])) {
    return {
      type: 'streaming',
      thinkingContent: 'Recovering the in-flight message from cached stream parts.',
      partialText: 'Recovered partial assistant output from streaming event.',
      finalText: [
        'Recovered partial assistant output from streaming event.',
        '',
        'The listener continued the same message with follow-up stream chunks and then completed it.',
      ].join('\n'),
    };
  }

  if (matchesMockKeyword(normalized, ['mock-session-title', 'trigger-session-title', '触发session.title'])) {
    return {
      type: 'session.title',
      title: 'Mock Session Title Updated',
      assistantContent: 'A session.title event has been emitted. The current page does not render this event yet.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-agent-online', 'trigger-agent-online', '触发agent.online'])) {
    return {
      type: 'agent.online',
      assistantContent: 'An agent.online event has been emitted. The current page does not render this event yet.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-agent-offline', 'trigger-agent-offline', '触发agent.offline'])) {
    return {
      type: 'agent.offline',
      assistantContent: 'An agent.offline event has been emitted. The page will render an assistant error block and stop generating.',
    };
  }

  if (matchesMockKeyword(normalized, ['mock-message-user', 'trigger-message-user', '瑙﹀彂message.user'])) {
    return {
      type: 'message.user',
      userContent: 'This user message was sent from the PC side and synchronized to the current mobile conversation.',
    };
  }

  return {
    type: 'normal',
    assistantContent: buildAssistantReply(content),
  };
}

function createMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  messageSeq: number,
  partId?: string,
): SessionMessage {
  const createdAt = nowIso();
  return {
    id: nextId(`msg_${role}`),
    seq: messageSeq,
    welinkSessionId: sessionId,
    role,
    content,
    contentType: 'plain',
    meta: null,
    messageSeq,
    parts: partId ? buildTextPart(partId, content) : null,
    createdAt,
  };
}

function toSendMessageResponse(message: SessionMessage): SendMessageResponse {
  return {
    id: message.id,
    welinkSessionId: message.welinkSessionId,
    seq: message.seq,
    messageSeq: message.messageSeq,
    role: message.role,
    content: message.content,
    contentType: message.contentType,
    createdAt: message.createdAt,
    meta: message.meta,
    parts: message.parts,
  };
}

function toRegenerateResponse(message: SessionMessage): RegenerateAnswerResponse {
  return toSendMessageResponse(message);
}

type MockEmitPayload = Omit<StreamMessage, 'welinkSessionId' | 'seq' | 'emittedAt'> & {
  emittedAt?: StreamMessage['emittedAt'];
};

function getOrCreateReplayState(sessionId: string): ReplayState {
  const existing = replayStateStore.get(sessionId);
  if (existing) {
    return existing;
  }

  const nextState: ReplayState = {
    replaying: false,
    pendingLiveEvents: [],
  };
  replayStateStore.set(sessionId, nextState);
  return nextState;
}

function getOrCreateRoundBuffer(sessionId: string): SessionRoundBuffer {
  const existing = roundBufferStore.get(sessionId);
  if (existing && !existing.completed) {
    return existing;
  }

  const timestamp = Date.now();
  const nextBuffer: SessionRoundBuffer = {
    welinkSessionId: sessionId,
    events: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    completed: false,
  };
  roundBufferStore.set(sessionId, nextBuffer);
  return nextBuffer;
}

function shouldCompleteCurrentRound(message: StreamMessage): boolean {
  if (message.type === 'session.status') {
    return message.sessionStatus === 'idle';
  }

  return message.type === 'session.error'
    || message.type === 'error'
    || message.type === 'agent.offline';
}

function appendToRoundBuffer(sessionId: string, message: StreamMessage): void {
  const buffer = getOrCreateRoundBuffer(sessionId);
  buffer.events.push(message);
  buffer.updatedAt = Date.now();
}

function markRoundCompleted(sessionId: string): void {
  const buffer = roundBufferStore.get(sessionId);
  if (!buffer) {
    return;
  }

  buffer.completed = true;
  buffer.updatedAt = Date.now();
}

function dispatchToSessionListener(listener: SessionListener, message: StreamMessage): void {
  try {
    listener.onMessage(message);
  } catch (callbackError) {
    listener.onError?.({
      code: 'CALLBACK_ERROR',
      message: callbackError instanceof Error ? callbackError.message : 'Session listener callback failed',
      timestamp: Date.now(),
    });
  }
}

function flushPendingReplayEvents(sessionId: string): void {
  const replayState = replayStateStore.get(sessionId);
  if (!replayState) {
    return;
  }

  while (true) {
    const listener = listeners.get(sessionId);
    if (!listener) {
      replayState.replaying = false;
      return;
    }

    if (replayState.pendingLiveEvents.length === 0) {
      replayState.replaying = false;
      return;
    }

    const pendingMessages = replayState.pendingLiveEvents.splice(0, replayState.pendingLiveEvents.length);
    pendingMessages.forEach((message) => {
      dispatchToSessionListener(listener, message);
    });
  }
}

function replayBufferedEventsIfNeeded(sessionId: string): void {
  const buffer = roundBufferStore.get(sessionId);
  const replayState = replayStateStore.get(sessionId);
  if (!replayState) {
    return;
  }

  if (!buffer || buffer.completed) {
    replayState.replaying = false;
    return;
  }

  const listener = listeners.get(sessionId);
  if (!listener) {
    replayState.replaying = false;
    return;
  }

  const snapshot = buffer.events.slice();
  snapshot.forEach((message) => {
    dispatchToSessionListener(listener, message);
  });
  flushPendingReplayEvents(sessionId);
}

function enqueueLiveEventDuringReplay(sessionId: string, message: StreamMessage): boolean {
  const replayState = replayStateStore.get(sessionId);
  if (!replayState || !replayState.replaying) {
    return false;
  }

  replayState.pendingLiveEvents.push(message);
  return true;
}

function emit(sessionId: string, payload: MockEmitPayload): void {
  const record = sessionStore.get(sessionId);
  if (!record) return;

  record.nextStreamSeq += 1;
  const message: StreamMessage = {
    ...payload,
    welinkSessionId: sessionId,
    seq: record.nextStreamSeq,
    emittedAt: payload.emittedAt ?? nowIso(),
  };

  appendToRoundBuffer(sessionId, message);
  if (shouldCompleteCurrentRound(message)) {
    markRoundCompleted(sessionId);
  }

  const listener = listeners.get(sessionId);
  if (!listener) {
    return;
  }

  if (enqueueLiveEventDuringReplay(sessionId, message)) {
    return;
  }

  dispatchToSessionListener(listener, message);
}

function clearSessionTimers(record: SessionRecord): void {
  record.timerIds.forEach((timerId) => window.clearTimeout(timerId));
  record.timerIds = [];
}

function upsertSessionRecord(record: SessionRecord, message: SessionMessage): void {
  record.messages.push(message);
  record.session.updatedAt = message.createdAt;
}

function getSessionRecordOrThrow(sessionId: string): SessionRecord {
  const record = sessionStore.get(sessionId);
  if (!record) {
    throw new Error(`mock session not found: ${sessionId}`);
  }
  return record;
}

function scheduleRecordTimer(record: SessionRecord, delay: number, callback: () => void): void {
  const timerId = window.setTimeout(callback, delay);
  record.timerIds.push(timerId);
}

function finalizeAssistantMessage(
  record: SessionRecord,
  content: string,
  parts: SessionMessage['parts'],
  meta: object | null = null,
): void {
  const assistantMessage = createAssistantMessage(
    record.session.welinkSessionId,
    content,
    record.nextMessageSeq,
    parts,
    meta,
  );
  record.nextMessageSeq += 1;
  upsertSessionRecord(record, assistantMessage);
}

function scheduleReplayDraftContinuation(record: SessionRecord): void {
  const draft = record.activeReplayDraft;
  if (!draft || record.continuationScheduled) {
    return;
  }

  record.continuationScheduled = true;
  const sessionId = record.session.welinkSessionId;

  scheduleRecordTimer(record, 160, () => {
    emit(sessionId, {
      type: 'thinking.done',
      messageId: draft.messageId,
      role: 'assistant',
      partId: draft.thinkingPartId,
      content: draft.thinkingContent,
    });
    emit(sessionId, {
      type: 'text.delta',
      messageId: draft.messageId,
      role: 'assistant',
      partId: draft.textPartId,
      content: '\nContinuing after listener replay...',
    });
  });

  scheduleRecordTimer(record, 320, () => {
    emit(sessionId, {
      type: 'text.done',
      messageId: draft.messageId,
      role: 'assistant',
      partId: draft.textPartId,
      content: draft.finalText,
    });
    finalizeAssistantMessage(record, draft.finalText, [
      buildThinkingPart(draft.thinkingPartId, draft.thinkingContent, 1),
      {
        ...buildTextPart(draft.textPartId, draft.finalText)![0],
        partSeq: 2,
      },
    ]);
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'idle',
    });
    clearSessionTimers(record);
    record.activeReplayDraft = null;
    record.continuationScheduled = false;
  });
}

function updateStoredPermissionResponse(
  record: SessionRecord,
  permissionId: string,
  response: ReplyPermissionParams['response'],
): void {
  for (let i = record.messages.length - 1; i >= 0; i -= 1) {
    const message = record.messages[i];
    if (!message.parts) {
      continue;
    }

    const targetPart = message.parts.find(
      (part) => part.type === 'permission' && part.permissionId === permissionId,
    );
    if (!targetPart) {
      continue;
    }

    targetPart.response = response;
    targetPart.status = 'completed';
    record.session.updatedAt = nowIso();
    return;
  }
}

function scheduleSubagentQuestionReply(
  record: SessionRecord,
  subagentSessionId: string,
  answer: string,
): void {
  clearSessionTimers(record);

  const sessionId = record.session.welinkSessionId;
  const assistantMessageId = nextId('msg_assistant_subagent_question_reply');
  const subagent: SubagentMockContext = {
    subagentSessionId,
    subagentName: resolveSubagentName(subagentSessionId),
  };
  const toolPartId = nextId('part_subagent_question_tool');
  const subagentTextPartId = nextId('part_subagent_question_text');
  const summaryPartId = nextId('part_subagent_question_summary');
  const toolCallId = nextId('tool_call_subagent_answer');
  const toolOutput = `User selected ${answer}. Continue downstream implementation on that platform.`;
  const subagentContent = `The subagent locked the implementation focus to ${answer} and updated its execution notes.`;
  const finalContent = `Platform preference recorded: ${answer}. The main flow can now continue with a focused implementation plan.`;

  scheduleRecordTimer(record, 40, () => {
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'busy',
    });
  });

  scheduleRecordTimer(record, 120, () => {
    emit(sessionId, {
      type: 'tool.update',
      messageId: assistantMessageId,
      role: 'assistant',
      partId: toolPartId,
      toolName: 'platform_router',
      toolCallId,
      status: 'running',
      title: 'Confirm platform preference',
      input: { answer },
      subagentSessionId: subagent.subagentSessionId,
      subagentName: subagent.subagentName,
    });
  });

  scheduleRecordTimer(record, 220, () => {
    emit(sessionId, {
      type: 'tool.update',
      messageId: assistantMessageId,
      role: 'assistant',
      partId: toolPartId,
      toolName: 'platform_router',
      toolCallId,
      status: 'completed',
      title: 'Confirm platform preference',
      input: { answer },
      output: toolOutput,
      subagentSessionId: subagent.subagentSessionId,
      subagentName: subagent.subagentName,
    });
  });

  scheduleRecordTimer(record, 320, () => {
    emit(sessionId, {
      type: 'text.done',
      messageId: assistantMessageId,
      role: 'assistant',
      partId: subagentTextPartId,
      content: subagentContent,
      subagentSessionId: subagent.subagentSessionId,
      subagentName: subagent.subagentName,
    });
  });

  scheduleRecordTimer(record, 420, () => {
    emit(sessionId, {
      type: 'text.done',
      messageId: assistantMessageId,
      role: 'assistant',
      partId: summaryPartId,
      content: finalContent,
    });
    finalizeAssistantMessage(record, finalContent, [
      buildToolPart(
        toolPartId,
        'platform_router',
        'Confirm platform preference',
        { answer },
        toolOutput,
        toolCallId,
        1,
        subagent,
      ),
      {
        ...buildTextPart(subagentTextPartId, subagentContent, 2, subagent)![0],
      },
      {
        ...buildTextPart(summaryPartId, finalContent, 3)![0],
      },
    ]);
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'idle',
    });
    clearSessionTimers(record);
  });
}

function scheduleSubagentPermissionReply(
  record: SessionRecord,
  subagentSessionId: string,
  response: ReplyPermissionParams['response'],
): void {
  clearSessionTimers(record);

  const sessionId = record.session.welinkSessionId;
  const assistantMessageId = nextId('msg_assistant_subagent_permission_reply');
  const subagent: SubagentMockContext = {
    subagentSessionId,
    subagentName: resolveSubagentName(subagentSessionId),
  };
  const subagentTextPartId = nextId('part_subagent_permission_text');
  const summaryPartId = nextId('part_subagent_permission_summary');
  const subagentContent = `The subagent received permission response "${response}" and updated its file-writing workflow.`;
  const finalContent = response === 'reject'
    ? 'The subagent stopped the file generation flow because permission was rejected.'
    : 'The subagent can continue the file generation flow after the permission approval.';

  scheduleRecordTimer(record, 40, () => {
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'busy',
    });
  });

  scheduleRecordTimer(record, 160, () => {
    emit(sessionId, {
      type: 'text.done',
      messageId: assistantMessageId,
      role: 'assistant',
      partId: subagentTextPartId,
      content: subagentContent,
      subagentSessionId: subagent.subagentSessionId,
      subagentName: subagent.subagentName,
    });
  });

  scheduleRecordTimer(record, 280, () => {
    emit(sessionId, {
      type: 'text.done',
      messageId: assistantMessageId,
      role: 'assistant',
      partId: summaryPartId,
      content: finalContent,
    });
    finalizeAssistantMessage(record, finalContent, [
      {
        ...buildTextPart(subagentTextPartId, subagentContent, 1, subagent)![0],
      },
      {
        ...buildTextPart(summaryPartId, finalContent, 2)![0],
      },
    ]);
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'idle',
    });
    clearSessionTimers(record);
  });
}

function scheduleAssistantReply(record: SessionRecord, userContent: string): void {
  clearSessionTimers(record);

  record.session.status = 'ACTIVE';
  const sessionId = record.session.welinkSessionId;
  const scenario = resolveMockReplyScenario(userContent);
  const assistantMessageId = nextId('msg_assistant_stream');
  scheduleRecordTimer(record, 40, () => {
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'busy',
    });
  });

  if (scenario.type === 'normal' || scenario.type === 'session.error' || scenario.type === 'error') {
    const assistantContent = scenario.type === 'normal' ? scenario.assistantContent : scenario.prelude;
    const partId = nextId('part_assistant');
    const chunks = splitReplyContent(assistantContent);

    chunks.forEach((chunk, index) => {
      scheduleRecordTimer(record, 120 + index * 80, () => {
        emit(sessionId, {
          type: 'text.delta',
          messageId: assistantMessageId,
          role: 'assistant',
          partId,
          content: chunk,
        });
      });
    });

    scheduleRecordTimer(record, 180 + chunks.length * 80, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId,
        content: assistantContent,
      });

      if (scenario.type === 'normal') {
        finalizeAssistantMessage(record, assistantContent, buildTextPart(partId, assistantContent));
        emit(sessionId, {
          type: 'session.status',
          sessionStatus: 'idle',
        });
      } else {
        emit(sessionId, {
          type: scenario.type,
          role: 'assistant',
          messageId: nextId('mock_error_message'),
          error: scenario.errorMessage,
        });
      }

      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'thinking') {
    const thinkingPartId = nextId('part_thinking');
    const textPartId = nextId('part_assistant');
    const thinkingChunks = splitReplyContent(scenario.thinkingContent);
    const textChunks = splitReplyContent(scenario.assistantContent);

    thinkingChunks.forEach((chunk, index) => {
      scheduleRecordTimer(record, 120 + index * 80, () => {
        emit(sessionId, {
          type: 'thinking.delta',
          messageId: assistantMessageId,
          role: 'assistant',
          partId: thinkingPartId,
          content: chunk,
        });
      });
    });

    scheduleRecordTimer(record, 140 + thinkingChunks.length * 80, () => {
      emit(sessionId, {
        type: 'thinking.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: thinkingPartId,
        content: scenario.thinkingContent,
      });
    });

    textChunks.forEach((chunk, index) => {
      scheduleRecordTimer(record, 220 + thinkingChunks.length * 80 + index * 80, () => {
        emit(sessionId, {
          type: 'text.delta',
          messageId: assistantMessageId,
          role: 'assistant',
          partId: textPartId,
          content: chunk,
        });
      });
    });

    scheduleRecordTimer(record, 280 + thinkingChunks.length * 80 + textChunks.length * 80, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: textPartId,
        content: scenario.assistantContent,
      });
      finalizeAssistantMessage(record, scenario.assistantContent, [
        buildThinkingPart(thinkingPartId, scenario.thinkingContent, 1),
        {
          ...buildTextPart(textPartId, scenario.assistantContent)![0],
          partSeq: 2,
        },
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'tool') {
    const toolPartId = nextId('part_tool');
    const toolCallId = nextId('tool_call');
    const textPartId = nextId('part_tool_text');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'tool.update',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: toolPartId,
        toolName: scenario.toolName,
        toolCallId,
        status: 'pending',
        title: scenario.toolTitle,
        input: scenario.toolInput,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'tool.update',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: toolPartId,
        toolName: scenario.toolName,
        toolCallId,
        status: 'running',
        title: scenario.toolTitle,
        input: scenario.toolInput,
      });
    });

    scheduleRecordTimer(record, 320, () => {
      emit(sessionId, {
        type: 'tool.update',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: toolPartId,
        toolName: scenario.toolName,
        toolCallId,
        status: 'completed',
        title: scenario.toolTitle,
        input: scenario.toolInput,
        output: scenario.toolOutput,
      });
    });

    scheduleRecordTimer(record, 420, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: textPartId,
        content: scenario.assistantContent,
      });
      finalizeAssistantMessage(record, scenario.assistantContent, [
        buildToolPart(toolPartId, scenario.toolName, scenario.toolTitle, scenario.toolInput, scenario.toolOutput, toolCallId, 1),
        {
          ...buildTextPart(textPartId, scenario.assistantContent)![0],
          partSeq: 2,
        },
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'subagent.basic') {
    const introPartId = nextId('part_subagent_intro');
    const thinkingPartId = nextId('part_subagent_thinking');
    const toolPartId = nextId('part_subagent_tool');
    const subagentTextPartId = nextId('part_subagent_text');
    const summaryPartId = nextId('part_subagent_summary');
    const toolCallId = nextId('tool_call_subagent');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: introPartId,
        content: scenario.introContent,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'thinking.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: thinkingPartId,
        content: scenario.thinkingContent,
        subagentSessionId: scenario.subagent.subagentSessionId,
        subagentName: scenario.subagent.subagentName,
      });
    });

    scheduleRecordTimer(record, 320, () => {
      emit(sessionId, {
        type: 'tool.update',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: toolPartId,
        toolName: scenario.toolName,
        toolCallId,
        status: 'pending',
        title: scenario.toolTitle,
        input: scenario.toolInput,
        subagentSessionId: scenario.subagent.subagentSessionId,
        subagentName: scenario.subagent.subagentName,
      });
    });

    scheduleRecordTimer(record, 420, () => {
      emit(sessionId, {
        type: 'tool.update',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: toolPartId,
        toolName: scenario.toolName,
        toolCallId,
        status: 'completed',
        title: scenario.toolTitle,
        input: scenario.toolInput,
        output: scenario.toolOutput,
        subagentSessionId: scenario.subagent.subagentSessionId,
        subagentName: scenario.subagent.subagentName,
      });
    });

    scheduleRecordTimer(record, 520, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: subagentTextPartId,
        content: scenario.subagentContent,
        subagentSessionId: scenario.subagent.subagentSessionId,
        subagentName: scenario.subagent.subagentName,
      });
    });

    scheduleRecordTimer(record, 620, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: summaryPartId,
        content: scenario.finalContent,
      });
      finalizeAssistantMessage(record, scenario.finalContent, [
        {
          ...buildTextPart(introPartId, scenario.introContent, 1)![0],
        },
        buildThinkingPart(thinkingPartId, scenario.thinkingContent, 2, scenario.subagent),
        buildToolPart(
          toolPartId,
          scenario.toolName,
          scenario.toolTitle,
          scenario.toolInput,
          scenario.toolOutput,
          toolCallId,
          3,
          scenario.subagent,
        ),
        {
          ...buildTextPart(subagentTextPartId, scenario.subagentContent, 4, scenario.subagent)![0],
        },
        {
          ...buildTextPart(summaryPartId, scenario.finalContent, 5)![0],
        },
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'subagent.question') {
    const introPartId = nextId('part_subagent_question_intro');
    const questionPartId = nextId('part_subagent_question');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: introPartId,
        content: scenario.introContent,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'question',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: questionPartId,
        toolCallId: scenario.toolCallId,
        header: scenario.header,
        question: scenario.question,
        options: scenario.options,
        status: 'running',
        subagentSessionId: scenario.subagent.subagentSessionId,
        subagentName: scenario.subagent.subagentName,
      });
    });

    scheduleRecordTimer(record, 320, () => {
      finalizeAssistantMessage(record, scenario.introContent, [
        {
          ...buildTextPart(introPartId, scenario.introContent, 1)![0],
        },
        buildQuestionPart(
          questionPartId,
          scenario.toolCallId,
          scenario.header,
          scenario.question,
          scenario.options,
          2,
          scenario.subagent,
        ),
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'subagent.permission') {
    const introPartId = nextId('part_subagent_permission_intro');
    const permissionPartId = nextId('part_subagent_permission');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: introPartId,
        content: scenario.introContent,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'permission.ask',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: permissionPartId,
        permissionId: scenario.permissionId,
        permType: scenario.permType,
        toolName: scenario.toolName,
        title: scenario.title,
        content: scenario.content,
        subagentSessionId: scenario.subagent.subagentSessionId,
        subagentName: scenario.subagent.subagentName,
      });
    });

    scheduleRecordTimer(record, 320, () => {
      finalizeAssistantMessage(record, scenario.introContent, [
        {
          ...buildTextPart(introPartId, scenario.introContent, 1)![0],
        },
        buildPermissionPart(
          permissionPartId,
          scenario.permissionId,
          scenario.permType,
          scenario.toolName,
          scenario.title,
          scenario.content,
          undefined,
          2,
          scenario.subagent,
        ),
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'question') {
    const questionPartId = nextId('part_question');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'question',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: questionPartId,
        toolCallId: scenario.toolCallId,
        header: scenario.header,
        question: scenario.question,
        options: scenario.options,
        status: 'running',
      });
    });

    scheduleRecordTimer(record, 220, () => {
      finalizeAssistantMessage(record, scenario.question, [
        buildQuestionPart(questionPartId, scenario.toolCallId, scenario.header, scenario.question, scenario.options, 1),
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'permission') {
    const permissionPartId = nextId('part_permission');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'permission.ask',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: permissionPartId,
        permissionId: scenario.permissionId,
        permType: scenario.permType,
        toolName: scenario.toolName,
        title: scenario.title,
        content: scenario.content,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: nextId('part_permission_text'),
        content: scenario.assistantContent,
      });
      finalizeAssistantMessage(record, scenario.assistantContent, [
        buildPermissionPart(
          permissionPartId,
          scenario.permissionId,
          scenario.permType,
          scenario.toolName,
          scenario.title,
          scenario.content,
          undefined,
          1,
        ),
        {
          ...buildTextPart(nextId('part_permission_summary'), scenario.assistantContent)![0],
          partSeq: 2,
        },
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'file') {
    const filePartId = nextId('part_file');
    const textPartId = nextId('part_file_text');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'file',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: filePartId,
        fileName: scenario.fileName,
        fileUrl: scenario.fileUrl,
        fileMime: scenario.fileMime,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: textPartId,
        content: scenario.assistantContent,
      });
      finalizeAssistantMessage(record, scenario.assistantContent, [
        buildFilePart(filePartId, scenario.fileName, scenario.fileUrl, scenario.fileMime, 1),
        {
          ...buildTextPart(textPartId, scenario.assistantContent)![0],
          partSeq: 2,
        },
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'step') {
    const partId = nextId('part_step_text');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'step.start',
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId,
        content: scenario.assistantContent,
      });
    });

    scheduleRecordTimer(record, 320, () => {
      emit(sessionId, {
        type: 'step.done',
        tokens: scenario.tokens,
        cost: scenario.cost,
      });
      finalizeAssistantMessage(
        record,
        scenario.assistantContent,
        buildTextPart(partId, scenario.assistantContent),
        {
          tokens: scenario.tokens,
          cost: scenario.cost,
        },
      );
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'snapshot') {
    scheduleRecordTimer(record, 160, () => {
      const assistantPartId = nextId('part_snapshot_text');
      const recoveredUserMessage = createMessage(
        sessionId,
        'user',
        userContent,
        record.nextMessageSeq,
      );
      const recoveredAssistantMessage = createAssistantMessage(
        sessionId,
        scenario.assistantContent,
        record.nextMessageSeq + 1,
        buildTextPart(assistantPartId, scenario.assistantContent),
      );
      record.nextMessageSeq += 2;
      record.messages = [recoveredUserMessage, recoveredAssistantMessage];
      record.session.updatedAt = recoveredAssistantMessage.createdAt;

      emit(sessionId, {
        type: 'snapshot',
        messages: [
          toSnapshotMessage(recoveredUserMessage),
          toSnapshotMessage(recoveredAssistantMessage),
        ],
      });
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'streaming') {
    const thinkingPartId = nextId('part_stream_thinking');
    const textPartId = nextId('part_stream_text');

    scheduleRecordTimer(record, 120, () => {
      emit(sessionId, {
        type: 'streaming',
        messageId: assistantMessageId,
        role: 'assistant',
        sessionStatus: 'busy',
        parts: [
          {
            partId: thinkingPartId,
            type: 'thinking',
            content: scenario.thinkingContent,
            status: 'running',
          },
          {
            partId: textPartId,
            type: 'text',
            content: scenario.partialText,
            status: 'running',
          },
        ],
      });
    });

    scheduleRecordTimer(record, 240, () => {
      emit(sessionId, {
        type: 'thinking.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: thinkingPartId,
        content: scenario.thinkingContent,
      });
      emit(sessionId, {
        type: 'text.delta',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: textPartId,
        content: '\nContinuing after recovered partial output...',
      });
    });

    scheduleRecordTimer(record, 360, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId: textPartId,
        content: scenario.finalText,
      });
      finalizeAssistantMessage(record, scenario.finalText, [
        buildThinkingPart(thinkingPartId, scenario.thinkingContent, 1),
        {
          ...buildTextPart(textPartId, scenario.finalText)![0],
          partSeq: 2,
        },
      ]);
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'message.user') {
    scheduleRecordTimer(record, 120, () => {
      const userMessage = createMessage(
        sessionId,
        'user',
        scenario.userContent,
        record.nextMessageSeq,
      );
      record.nextMessageSeq += 1;
      upsertSessionRecord(record, userMessage);

      emit(sessionId, {
        type: 'message.user',
        role: 'user',
        messageId: userMessage.id,
        messageSeq: userMessage.messageSeq,
        content: userMessage.content,
        emittedAt: userMessage.createdAt,
      });
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
    return;
  }

  if (scenario.type === 'session.title' || scenario.type === 'agent.online' || scenario.type === 'agent.offline') {
    const partId = nextId('part_misc_text');

    scheduleRecordTimer(record, 120, () => {
      if (scenario.type === 'session.title') {
        record.session.title = scenario.title;
        emit(sessionId, {
          type: 'session.title',
          title: scenario.title,
        });
      } else {
        emit(sessionId, {
          type: scenario.type,
        });
      }
    });

    scheduleRecordTimer(record, 220, () => {
      emit(sessionId, {
        type: 'text.done',
        messageId: assistantMessageId,
        role: 'assistant',
        partId,
        content: scenario.assistantContent,
      });
      finalizeAssistantMessage(record, scenario.assistantContent, buildTextPart(partId, scenario.assistantContent));
      emit(sessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      clearSessionTimers(record);
    });
  }
}

function createSession(params: CreateNewSessionParams): SkillSession {
  const createdAt = nowIso();
  return {
    welinkSessionId: nextId('session'),
    userId: 'mock_user_id',
    ak: params.ak,
    title: params.title ?? `session-${idCounter}`,
    bussinessDomain: params.bussinessDomain,
    bussinessType: params.bussinessType,
    bussinessId: params.bussinessId,
    assistantAccount: params.assistantAccount,
    status: 'ACTIVE',
    toolSessionId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function createFixedSession(params: CreateNewSessionParams, welinkSessionId: string): SkillSession {
  const createdAt = nowIso();
  return {
    welinkSessionId,
    userId: 'mock_user_id',
    ak: params.ak,
    title: params.title ?? welinkSessionId,
    bussinessDomain: params.bussinessDomain,
    bussinessType: params.bussinessType,
    bussinessId: params.bussinessId,
    assistantAccount: params.assistantAccount,
    status: 'ACTIVE',
    toolSessionId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function seedMockData(): void {
  if (assistantDetailsStore.size > 0) {
    return;
  }

  const internalAssistant: WeAgentDetails = {
    name: 'CodeAgent',
    icon: createAvatar('C', '#0D94FF'),
    desc: 'Your coding assistant',
    moduleId: 'module_mock_code',
    appKey: 'mock_app_key_code',
    appSecret: 'mock_app_secret_code',
    partnerAccount: DEFAULT_ASSISTANT_ACCOUNT,
    createdBy: 'mock_user_id',
    creatorName: 'Mock User',
    creatorWorkId: '10001',
    creatorW3Account: 'mock_user',
    creatorNameEn: 'Mock User',
    ownerWelinkId: 'mock_owner',
    ownerW3Account: 'mock_owner',
    ownerName: 'Mock Owner',
    ownerNameEn: 'Mock Owner',
    ownerDeptName: 'R&D',
    ownerDeptNameEn: 'R&D',
    id: 'robot_mock_code',
    bizRobotId: 'biz_robot_1001',
    bizRobotTag: '',
    bizRobotName: 'Staff Assistant',
    bizRobotNameEn: 'Staff Assistant',
    weCodeUrl: 'h5://921535418692659/index.html',
  };

  const customAssistant: WeAgentDetails = {
    name: 'External Assistant',
    icon: createAvatar('E', '#22C55E'),
    desc: 'External deployment example',
    moduleId: 'module_mock_external',
    appKey: 'mock_external_app_key',
    appSecret: 'mock_external_app_secret',
    partnerAccount: 'mock_assistant_002',
    createdBy: 'mock_user_id',
    creatorName: 'Mock User',
    creatorWorkId: '10001',
    creatorW3Account: 'mock_user',
    creatorNameEn: 'Mock User',
    ownerWelinkId: 'mock_owner',
    ownerW3Account: 'mock_owner',
    ownerName: 'Mock Owner',
    ownerNameEn: 'Mock Owner',
    ownerDeptName: '',
    ownerDeptNameEn: '',
    id: 'robot_mock_external',
    bizRobotId: '',
    bizRobotTag: '',
    bizRobotName: '',
    bizRobotNameEn: '',
    weCodeUrl: 'h5://921535418692659/index.html#weAgentCUI',
  };

  assistantDetailsStore.set(internalAssistant.partnerAccount, internalAssistant);
  assistantDetailsStore.set(customAssistant.partnerAccount, customAssistant);

  const seedSession = createFixedSession({
    ak: internalAssistant.appKey,
    title: 'mock-initial-session',
    bussinessDomain: 'miniapp',
    bussinessType: 'direct',
    assistantAccount: internalAssistant.partnerAccount,
    bussinessId: MOCK_UID,
  }, DEFAULT_SKILL_CUI_WELINK_SESSION_ID);

  const seedRecord: SessionRecord = {
    session: seedSession,
    messages: [],
    nextMessageSeq: 1,
    nextStreamSeq: 0,
    timerIds: [],
    continuationScheduled: false,
    activeReplayDraft: null,
  };

  const firstUserMessage = createMessage(
    seedSession.welinkSessionId,
    'user',
    'Please explain what this page can do.',
    seedRecord.nextMessageSeq,
  );
  seedRecord.nextMessageSeq += 1;
  upsertSessionRecord(seedRecord, firstUserMessage);

  const firstAssistantMessage = createMessage(
    seedSession.welinkSessionId,
    'assistant',
    'This page hosts WeAgentCUI chat, including session init, message send, and history display.',
    seedRecord.nextMessageSeq,
    nextId('part_seed'),
  );
  seedRecord.nextMessageSeq += 1;
  upsertSessionRecord(seedRecord, firstAssistantMessage);

  sessionStore.set(seedSession.welinkSessionId, seedRecord);
  defaultSkillCUIWelinkSessionId = seedSession.welinkSessionId;

  const replaySession = createFixedSession({
    ak: internalAssistant.appKey,
    title: 'mock-replay-session',
    bussinessDomain: 'miniapp',
    bussinessType: 'direct',
    assistantAccount: internalAssistant.partnerAccount,
    bussinessId: MOCK_UID,
  }, DEFAULT_SKILL_CUI_REPLAY_WELINK_SESSION_ID);

  const replayRecord: SessionRecord = {
    session: replaySession,
    messages: [],
    nextMessageSeq: 1,
    nextStreamSeq: 0,
    timerIds: [],
    continuationScheduled: false,
    activeReplayDraft: null,
  };

  const replayHistoryUser = createMessage(
    replaySession.welinkSessionId,
    'user',
    'Show me how listener replay restores cached streaming events.',
    replayRecord.nextMessageSeq,
  );
  replayRecord.nextMessageSeq += 1;
  upsertSessionRecord(replayRecord, replayHistoryUser);

  const replayHistoryAssistant = createAssistantMessage(
    replaySession.welinkSessionId,
    'History messages are loaded from getSessionMessageHistory first.',
    replayRecord.nextMessageSeq,
    buildTextPart(nextId('part_replay_history'), 'History messages are loaded from getSessionMessageHistory first.'),
  );
  replayRecord.nextMessageSeq += 1;
  upsertSessionRecord(replayRecord, replayHistoryAssistant);

  const replayCurrentUser = createMessage(
    replaySession.welinkSessionId,
    'user',
    'Continue the answer even if the page opens late.',
    replayRecord.nextMessageSeq,
  );
  replayRecord.nextMessageSeq += 1;
  upsertSessionRecord(replayRecord, replayCurrentUser);

  const replayDraftMessageId = nextId('msg_replay_stream');
  const replayThinkingPartId = nextId('part_replay_thinking');
  const replayTextPartId = nextId('part_replay_text');
  const replayThinkingContent = [
    '1. The page opens after the current round already started.',
    '2. SDK replays cached raw stream events for the unfinished round.',
    '3. After replay, new live events continue in order.',
  ].join('\n');
  const replayPartialText = 'Recovered partial assistant output from cached listener events.';
  const replayFinalText = [
    'Recovered partial assistant output from cached listener events.',
    '',
    'This tail is delivered after replay finishes, proving that cached events and live events stay ordered.',
  ].join('\n');

  replayRecord.activeReplayDraft = {
    messageId: replayDraftMessageId,
    thinkingPartId: replayThinkingPartId,
    textPartId: replayTextPartId,
    thinkingContent: replayThinkingContent,
    partialText: replayPartialText,
    finalText: replayFinalText,
  };

  sessionStore.set(replaySession.welinkSessionId, replayRecord);

  emit(replaySession.welinkSessionId, {
    type: 'session.status',
    sessionStatus: 'busy',
  });
  emit(replaySession.welinkSessionId, {
    type: 'streaming',
    messageId: replayDraftMessageId,
    role: 'assistant',
    sessionStatus: 'busy',
    parts: [
      {
        partId: replayThinkingPartId,
        partSeq: 1,
        type: 'thinking',
        content: replayThinkingContent,
        status: 'running',
      },
      {
        partId: replayTextPartId,
        partSeq: 2,
        type: 'text',
        content: replayPartialText,
        status: 'running',
      },
    ],
  });
}

function ensureDefaultMockRouteQueryInHash(): void {
  const hashValue = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hashValue) {
    window.location.hash = toRouteHash('/weAgentCUI', { assistantAccount: DEFAULT_ASSISTANT_ACCOUNT });
    return;
  }

  const hashUrl = parseUrl(hashValue);
  if (!hashUrl) return;
  const nextQuery = Object.fromEntries(hashUrl.searchParams.entries());

  if (hashUrl.pathname === '/weAgentCUI' && !hashUrl.searchParams.get('assistantAccount')) {
    nextQuery.assistantAccount = DEFAULT_ASSISTANT_ACCOUNT;
    window.location.hash = toRouteHash('/weAgentCUI', nextQuery);
    return;
  }

  if (hashUrl.pathname === '/skillCUI' && !hashUrl.searchParams.get('welinkSessionId')) {
    nextQuery.welinkSessionId = defaultSkillCUIWelinkSessionId;
    window.location.hash = toRouteHash('/skillCUI', nextQuery);
    return;
  }

  if (hashUrl.pathname === '/assistantDetail' && !hashUrl.searchParams.get('partnerAccount')) {
    nextQuery.partnerAccount = DEFAULT_ASSISTANT_ACCOUNT;
    window.location.hash = toRouteHash('/assistantDetail', nextQuery);
    return;
  }

  if (hashUrl.pathname === '/switchAssistant' && !hashUrl.searchParams.get('partnerAccount')) {
    nextQuery.partnerAccount = DEFAULT_ASSISTANT_ACCOUNT;
    window.location.hash = toRouteHash('/switchAssistant', nextQuery);
    return;
  }

  if (hashUrl.pathname === '/createAssistant' && !hashUrl.searchParams.get('from')) {
    nextQuery.from = 'weAgent';
    window.location.hash = toRouteHash('/createAssistant', nextQuery);
  }

  if (hashUrl.pathname === '/selectBrainAssistant' && !hashUrl.searchParams.get('from')) {
    nextQuery.from = 'weAgent';
    window.location.hash = toRouteHash('/selectBrainAssistant', nextQuery);
  }
}

function resolveMockLanguage(): string {
  const query = new URLSearchParams(window.location.search);
  const hashValue = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashQueryIndex = hashValue.indexOf('?');
  const hashQuery = hashQueryIndex >= 0 ? new URLSearchParams(hashValue.slice(hashQueryIndex + 1)) : null;
  const candidate = (query.get('language')
    || query.get('lang')
    || hashQuery?.get('language')
    || hashQuery?.get('lang')
    || '').trim().toLowerCase();

  return candidate === 'en' ? 'en' : 'zh';
}

function ensureMockHWH5Bridge(): void {
  const hwh5 = (window.HWH5 ?? {}) as MockHWH5Bridge;

  if (typeof hwh5.openWebview !== 'function') {
    hwh5.openWebview = ({ uri }) => {
      const parsed = parseUrl(uri);
      if (!parsed) return;
      const route = parsed.hash ? parsed.hash.replace(/^#/, '') : '';
      if (!route) return;
      const path = route.startsWith('/') ? route : `/${route}`;
      window.location.hash = toRouteHash(path, Object.fromEntries(parsed.searchParams.entries()));
    };
  }

  if (typeof hwh5.showToast !== 'function') {
    hwh5.showToast = async ({ msg, type }) => {
      console.info('[ai-chat-viewer] mock HWH5.showToast', { msg, type });
    };
  }

  if (typeof hwh5.reboot !== 'function') {
    hwh5.reboot = async () => undefined;
  }

  if (typeof hwh5.addEventListener !== 'function') {
    hwh5.addEventListener = async () => undefined;
  }

  if (typeof hwh5.getDeviceInfo !== 'function') {
    hwh5.getDeviceInfo = async () => ({ statusBarHeight: 0 });
  }

  if (typeof hwh5.getAppInfo !== 'function') {
    hwh5.getAppInfo = async () => ({ language: resolveMockLanguage(), versionName: '5.83.0' });
  }

  if (typeof hwh5.getUserInfo !== 'function') {
    hwh5.getUserInfo = async () => ({
      uid: MOCK_UID,
      userNameZH: '测试用户',
      userNameEN: 'Mock User',
      corpUserId: 'mock-avatar.example.com/user.png',
    });
  }

  if (typeof hwh5.getAccountInfo !== 'function') {
    hwh5.getAccountInfo = async () => MOCK_UID;
  }

  if (typeof hwh5.navigateBack !== 'function') {
    hwh5.navigateBack = () => {
      window.history.back();
    };
  }

  if (typeof hwh5.close !== 'function') {
    hwh5.close = () => {
      // no-op for browser mock
    };
  }

  window.HWH5 = hwh5 as any;
}

function buildMockAgentTypes(): InternalAssistantOption[] {
  return [
    { name: 'Coding Helper', icon: createAgentIcon('C', '#0D94FF'), bizRobotId: 'biz_robot_1001' },
    { name: 'Docs Helper', icon: createAgentIcon('D', '#16A34A'), bizRobotId: 'biz_robot_1002' },
    { name: 'QA Helper', icon: createAgentIcon('Q', '#F59E0B'), bizRobotId: 'biz_robot_1003' },
  ];
}

function buildMockApi(): HWH5EXT {
  return {
    onTabForUpdate: (_callback: () => void) => undefined,
    regenerateAnswer: async (params: RegenerateAnswerParams): Promise<RegenerateAnswerResponse> => {
      const record = getSessionRecordOrThrow(params.welinkSessionId);
      const latestUser = [...record.messages].reverse().find((message) => message.role === 'user');
      const assistantMessage = createMessage(
        record.session.welinkSessionId,
        'assistant',
        buildAssistantReply(latestUser?.content ?? 'Please continue'),
        record.nextMessageSeq,
        nextId('part_regenerate'),
      );
      record.nextMessageSeq += 1;
      upsertSessionRecord(record, assistantMessage);
      emit(record.session.welinkSessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      return toRegenerateResponse(assistantMessage);
    },

    sendMessageToIM: async (_params: SendMessageToIMParams) => ({ success: true }),

    getSessionMessage: async (params: GetSessionMessageParams): Promise<GetSessionMessageResponse> => {
      const record = getSessionRecordOrThrow(params.welinkSessionId);
      const page = Math.max(0, params.page ?? 0);
      const size = Math.max(1, params.size ?? 20);

      const sortedMessages = [...record.messages].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
      const total = sortedMessages.length;
      const start = page * size;
      const content = sortedMessages.slice(start, start + size).map(cloneSessionMessage);
      const totalPages = Math.ceil(total / size);

      return {
        content,
        page,
        size,
        total,
        totalPages,
      };
    },

    getSessionMessageHistory: async (
      params: GetSessionMessageHistoryParams,
    ): Promise<GetSessionMessageHistoryResponse> => {
      const record = getSessionRecordOrThrow(params.welinkSessionId);
      const size = Math.max(1, params.size ?? DEFAULT_PAGE_SIZE);

      const sortedMessages = [...record.messages].sort((left, right) => {
        const leftSeq = left.seq ?? left.messageSeq ?? 0;
        const rightSeq = right.seq ?? right.messageSeq ?? 0;
        return leftSeq - rightSeq;
      });

      const beforeSeq = params.beforeSeq;
      const scopedMessages = typeof beforeSeq === 'number'
        ? sortedMessages.filter((message) => (message.seq ?? message.messageSeq ?? 0) < beforeSeq)
        : sortedMessages;

      const startIndex = Math.max(0, scopedMessages.length - size);
      const content = scopedMessages.slice(startIndex).map(cloneSessionMessage);
      const hasMore = startIndex > 0;
      const nextBeforeSeq = hasMore
        ? (content[0]?.seq ?? content[0]?.messageSeq ?? null)
        : null;

      return {
        content,
        size,
        hasMore,
        nextBeforeSeq,
      };
    },

    registerSessionListener: (params: RegisterSessionListenerParams): void => {
      const replayState = getOrCreateReplayState(params.welinkSessionId);
      const buffer = roundBufferStore.get(params.welinkSessionId);
      let shouldReplay = false;

      if (buffer && !buffer.completed && !replayState.replaying) {
        replayState.replaying = true;
        shouldReplay = true;
      }

      listeners.set(params.welinkSessionId, {
        onMessage: params.onMessage,
        onError: params.onError,
        onClose: params.onClose,
      });

      if (shouldReplay) {
        window.setTimeout(() => {
          replayBufferedEventsIfNeeded(params.welinkSessionId);
          const record = sessionStore.get(params.welinkSessionId);
          if (record?.activeReplayDraft) {
            scheduleReplayDraftContinuation(record);
          }
        }, 0);
      }
    },

    unregisterSessionListener: (params: UnregisterSessionListenerParams): void => {
      listeners.delete(params.welinkSessionId);
    },

    sendMessage: async (params: SendMessageParams): Promise<SendMessageResponse> => {
      const record = getSessionRecordOrThrow(params.welinkSessionId);
      const userMessage = createMessage(
        record.session.welinkSessionId,
        'user',
        params.content,
        record.nextMessageSeq,
      );
      record.nextMessageSeq += 1;
      upsertSessionRecord(record, userMessage);
      if (matchesSubagentSession(params.subagentSessionId, SUBAGENT_QUESTION_PREFIX)) {
        scheduleSubagentQuestionReply(record, params.subagentSessionId!, params.content);
        return toSendMessageResponse(userMessage);
      }
      scheduleAssistantReply(record, params.content);
      return toSendMessageResponse(userMessage);
    },

    stopSkill: async (params: StopSkillParams) => {
      const record = getSessionRecordOrThrow(params.welinkSessionId);
      clearSessionTimers(record);
      emit(record.session.welinkSessionId, {
        type: 'session.status',
        sessionStatus: 'idle',
      });
      return {
        welinkSessionId: params.welinkSessionId,
        status: 'aborted',
      };
    },

    replyPermission: async (params: ReplyPermissionParams) => {
      const record = getSessionRecordOrThrow(params.welinkSessionId);
      updateStoredPermissionResponse(record, params.permId, params.response);
      emit(record.session.welinkSessionId, {
        type: 'permission.reply',
        permissionId: params.permId,
        response: params.response,
        ...(params.subagentSessionId
          ? {
            subagentSessionId: params.subagentSessionId,
            subagentName: resolveSubagentName(params.subagentSessionId),
          }
          : {}),
      });
      if (matchesSubagentSession(params.subagentSessionId, SUBAGENT_PERMISSION_PREFIX)) {
        scheduleSubagentPermissionReply(record, params.subagentSessionId!, params.response);
      }
      return {
        welinkSessionId: params.welinkSessionId,
        permissionId: params.permId,
        response: params.response,
      };
    },

    controlSkillWeCode: async () => ({ status: 'success' }),

    createNewSession: async (params: CreateNewSessionParams): Promise<SkillSession> => {
      const nextSession = createSession(params);
      const record: SessionRecord = {
        session: nextSession,
        messages: [],
        nextMessageSeq: 1,
        nextStreamSeq: 0,
        timerIds: [],
      };
      sessionStore.set(nextSession.welinkSessionId, record);
      currentAssistantAccount = params.assistantAccount;
      return cloneSession(nextSession);
    },

    createDigitalTwin: async (params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult> => {
      const partnerAccount = nextId('mock_assistant');
      const bizRobotId = params.weCrewType === 1 ? (params.bizRobotId ?? nextId('biz_robot')) : '';
      const robotId = nextId('robot');

      const detail: WeAgentDetails = {
        name: params.name,
        icon: params.icon,
        desc: params.description,
        moduleId: nextId('module'),
        appKey: nextId('app_key'),
        appSecret: nextId('app_secret'),
        partnerAccount,
        createdBy: 'mock_user_id',
        creatorName: 'Mock User',
        creatorWorkId: '10001',
        creatorW3Account: 'mock_user',
        creatorNameEn: 'Mock User',
        ownerWelinkId: 'mock_owner',
        ownerW3Account: 'mock_owner',
        ownerName: 'Mock Owner',
        ownerNameEn: 'Mock Owner',
        ownerDeptName: bizRobotId ? 'R&D' : '',
        ownerDeptNameEn: bizRobotId ? 'R&D' : '',
        id: robotId,
        bizRobotId,
        bizRobotTag: '',
        bizRobotName: bizRobotId ? 'Staff Assistant' : '',
        bizRobotNameEn: bizRobotId ? 'Staff Assistant' : '',
        weCodeUrl: buildExternalWeAgentUri(partnerAccount),
      };

      assistantDetailsStore.set(partnerAccount, detail);
      currentAssistantAccount = partnerAccount;

      return {
        partnerAccount,
        robotId,
        message: 'success',
      };
    },

    getAgentType: async (): Promise<AgentTypeListResult> => ({
      content: buildMockAgentTypes(),
    }),

    getWeAgentList: async (params: GetWeAgentListParams): Promise<WeAgentListResult> => {
      const pageSize = Math.max(1, params.pageSize ?? 20);
      const pageNumber = Math.max(1, params.pageNumber ?? 1);
      const allItems = Array.from(assistantDetailsStore.values()).map((detail) => ({
        name: detail.name,
        icon: detail.icon,
        description: detail.desc,
        partnerAccount: detail.partnerAccount,
        bizRobotName: detail.bizRobotName,
        bizRobotNameEn: detail.bizRobotNameEn,
        robotId: detail.bizRobotId,
      }));
      const start = (pageNumber - 1) * pageSize;

      return {
        content: allItems.slice(start, start + pageSize),
      };
    },

    getWeAgentDetails: async (params: GetWeAgentDetailsParams): Promise<WeAgentDetailsArrayResult> => {
      const partnerAccounts = 'partnerAccount' in params
        ? [params.partnerAccount]
        : params.partnerAccounts;
      const details = partnerAccounts
        .map((partnerAccount) => assistantDetailsStore.get(partnerAccount))
        .filter((detail): detail is WeAgentDetails => Boolean(detail))
        .map((detail) => cloneAssistantDetail(detail));

      if (details[0]?.partnerAccount) {
        currentAssistantAccount = details[0].partnerAccount;
      }

      return {
        weAgentDetailsArray: details,
      };
    },

    updateWeAgent: async (params: UpdateWeAgentParams): Promise<UpdateWeAgentResult> => {
      const detail = findAssistantDetail(params);
      if (!detail) {
        throw new Error('Assistant detail not found.');
      }

      const nextDetail: WeAgentDetails = {
        ...detail,
        name: params.name,
        icon: params.icon,
        desc: params.description,
      };

      assistantDetailsStore.set(nextDetail.partnerAccount, nextDetail);
      currentAssistantAccount = nextDetail.partnerAccount;

      return {
        updateResult: 'success',
      };
    },

    deleteWeAgent: async (params: DeleteWeAgentParams): Promise<DeleteWeAgentResult> => {
      const detail = findAssistantDetail(params);
      if (!detail) {
        throw new Error('Assistant detail not found.');
      }

      assistantDetailsStore.delete(detail.partnerAccount);

      return {
        deleteResult: 'success',
      };
    },

    queryQrcodeInfo: async ({ qrcode }): Promise<QueryQrcodeInfoResult> => ({
      qrcode,
      weUrl: `${URL_BASE}/#/createAssistant?from=qrcode&qrcode=${encodeURIComponent(qrcode)}`,
      pcUrl: `${URL_BASE}/#/createAssistant?from=qrcode&qrcode=${encodeURIComponent(qrcode)}`,
      expireTime: String(Date.now() + 10 * 60 * 1000),
      status: 0,
      expired: false,
    }),

    updateQrcodeInfo: async (): Promise<UpdateQrcodeInfoResult> => ({
      status: 'success',
    }),

    notifyAssistantDetailUpdated: async (
      params: NotifyAssistantDetailUpdatedParams,
    ): Promise<NotifyAssistantDetailUpdatedResult> => {
      window.dispatchEvent(new CustomEvent('assistant-detail-updated', { detail: { ...params } }));
      return {
        status: 'success',
      };
    },

    getHistorySessionsList: async (params: GetHistorySessionsListParams): Promise<HistorySessionsListResult> => {
      const page = Math.max(0, params.page ?? 0);
      const size = Math.max(1, params.size ?? DEFAULT_PAGE_SIZE);
      const filtered = Array.from(sessionStore.values())
        .map((record) => record.session)
        .filter((session) => !params.assistantAccount || session.assistantAccount === params.assistantAccount)
        .filter((session) => !params.status || session.status === params.status)
        .filter((session) => !params.ak || session.ak === params.ak)
        .filter((session) => !params.bussinessId || session.bussinessId === params.bussinessId)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

      const total = filtered.length;
      const content = filtered.slice(page * size, page * size + size).map(cloneSession);

      return {
        content,
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      };
    },

    getWeAgentUri: async (): Promise<WeAgentUriResult> => {
      const detail = assistantDetailsStore.get(currentAssistantAccount)
        ?? assistantDetailsStore.values().next().value;
      if (!detail) {
        return {
          weAgentUri: `${BASE_PAGE_URI}?wecodePlace=weAgent#activateAssistant`,
          assistantDetailUri: BASE_PAGE_URI,
          switchAssistantUri: BASE_PAGE_URI,
        };
      }

      const weAgentBaseUri = detail.bizRobotId
        ? detail.weCodeUrl
        : buildExternalWeAgentUri(detail.partnerAccount);

      return {
        weAgentUri: appendQuery(weAgentBaseUri, 'wecodePlace', 'weAgent'),
        assistantDetailUri: buildAssistantPageUri(detail.partnerAccount, 'assistantDetail'),
        switchAssistantUri: buildAssistantPageUri(detail.partnerAccount, 'switchAssistant'),
      };
    },

    openWeAgentCUI: async (params: OpenWeAgentCUIParams): Promise<OpenWeAgentCUIResult> => {
      const detailUri = parseUrl(params.assistantDetailUri);
      const weAgentUri = parseUrl(params.weAgentUri);
      const partnerAccount = detailUri?.searchParams.get('partnerAccount')
        ?? weAgentUri?.searchParams.get('assistantAccount')
        ?? currentAssistantAccount;

      currentAssistantAccount = partnerAccount;
      window.location.hash = toRouteHash('/weAgentCUI', { assistantAccount: partnerAccount });

      return { status: 'success' };
    },
  };
}

export function installJsApiMock(): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    const isLocalDebugEnv = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    const enableFromQuery = new URLSearchParams(window.location.search).get('mockJsApi') === '1'
      || window.location.hash.includes('mockJsApi=1');
    const shouldEnableMock = isLocalDebugEnv || enableFromQuery;

    if (!shouldEnableMock) {
      return;
    }

    if (typeof window.Pedestal?.callMethod === 'function') {
      return;
    }

    if (window.HWH5EXT && !window.__AI_CHAT_VIEWER_JSAPI_MOCK__) {
      return;
    }

    seedMockData();
    ensureMockHWH5Bridge();

    if (!window.HWH5EXT) {
      window.HWH5EXT = buildMockApi();
    }

    window.__AI_CHAT_VIEWER_JSAPI_MOCK__ = true;
    ensureDefaultMockRouteQueryInHash();
  } catch (error) {
    // mock 安装失败不应阻断页面渲染，避免首屏白屏
    WeLog(`installJsApiMock installJsApiMock failed | error=${JSON.stringify(error)}`);
  }
}
