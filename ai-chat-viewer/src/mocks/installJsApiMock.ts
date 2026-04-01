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
  GetSessionMessageHistoryParams,
  GetHistorySessionsListParams,
  GetSessionMessageParams,
  GetWeAgentDetailsParams,
  GetWeAgentListParams,
  HWH5EXT,
  HistorySessionsListResult,
  OpenWeAgentCUIParams,
  OpenWeAgentCUIResult,
  RegenerateAnswerParams,
  RegisterSessionListenerParams,
  ReplyPermissionParams,
  SendMessageParams,
  SendMessageToIMParams,
  SkillSession,
  StopSkillParams,
  UnregisterSessionListenerParams,
  WeAgentDetails,
  WeAgentDetailsArrayResult,
  WeAgentListResult,
  WeAgentUriResult,
} from '../utils/hwext';
import { HOST } from '../constants';

interface MockHWH5Bridge {
  openWebview?: (payload: { uri: string }) => void;
  getDeviceInfo?: () => Promise<{ statusBarHeight: number }>;
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
}

interface SessionListener {
  onMessage: RegisterSessionListenerParams['onMessage'];
  onError?: RegisterSessionListenerParams['onError'];
  onClose?: RegisterSessionListenerParams['onClose'];
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
  };

declare global {
  interface Window {
    __AI_CHAT_VIEWER_JSAPI_MOCK__?: boolean;
  }
}

const URL_BASE = 'https://ai-chat-viewer.mock.local';
const BASE_PAGE_URI = `${HOST}/index.html`;
const DEFAULT_ASSISTANT_ACCOUNT = 'mock_assistant_001';
const MOCK_UID = 'mock_uid_10001';
const DEFAULT_PAGE_SIZE = 50;

let idCounter = 0;
let currentAssistantAccount = DEFAULT_ASSISTANT_ACCOUNT;

const assistantDetailsStore = new Map<string, WeAgentDetails>();
const sessionStore = new Map<string, SessionRecord>();
const listeners = new Map<string, SessionListener>();

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

function buildTextPart(partId: string, content: string): SessionMessage['parts'] {
  return [{
    partId,
    partSeq: 1,
    type: 'text',
    content,
    status: 'completed',
  }];
}

function cloneSessionMessage(message: SessionMessage): SessionMessage {
  return {
    ...message,
    meta: message.meta ? { ...message.meta } : null,
    parts: message.parts ? message.parts.map((part) => ({ ...part })) : null,
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

function emit(sessionId: string, payload: Omit<StreamMessage, 'welinkSessionId' | 'seq' | 'emittedAt'>): void {
  const record = sessionStore.get(sessionId);
  const listener = listeners.get(sessionId);
  if (!record || !listener) return;

  record.nextStreamSeq += 1;
  listener.onMessage({
    welinkSessionId: sessionId,
    seq: record.nextStreamSeq,
    emittedAt: nowIso(),
    ...payload,
  });
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

function scheduleAssistantReply(record: SessionRecord, userContent: string): void {
  clearSessionTimers(record);

  record.session.status = 'ACTIVE';
  const sessionId = record.session.welinkSessionId;
  const scenario = resolveMockReplyScenario(userContent);
  const assistantContent = scenario.type === 'normal' ? scenario.assistantContent : scenario.prelude;
  const partId = nextId('part_assistant');
  const chunks = splitReplyContent(assistantContent);

  const busyTimer = window.setTimeout(() => {
    emit(sessionId, {
      type: 'session.status',
      sessionStatus: 'busy',
    });
  }, 40);
  record.timerIds.push(busyTimer);

  chunks.forEach((chunk, index) => {
    const timerId = window.setTimeout(() => {
      emit(sessionId, {
        type: 'text.delta',
        role: 'assistant',
        partId,
        content: chunk,
      });
    }, 120 + index * 80);
    record.timerIds.push(timerId);
  });

  const doneTimer = window.setTimeout(() => {
    emit(sessionId, {
      type: 'text.done',
      role: 'assistant',
      partId,
      content: assistantContent,
    });

    if (scenario.type === 'normal') {
      const assistantMessage = createMessage(
        sessionId,
        'assistant',
        assistantContent,
        record.nextMessageSeq,
        partId,
      );
      record.nextMessageSeq += 1;
      upsertSessionRecord(record, assistantMessage);

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
  }, 180 + chunks.length * 80);
  record.timerIds.push(doneTimer);
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
    creatorNameEn: 'Mock User',
    ownerWelinkId: 'mock_owner',
    ownerName: 'Mock Owner',
    ownerNameEn: 'Mock Owner',
    ownerDeptName: 'R&D',
    ownerDeptNameEn: 'R&D',
    bizRobotId: 'biz_robot_1001',
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
    creatorNameEn: 'Mock User',
    ownerWelinkId: 'mock_owner',
    ownerName: 'Mock Owner',
    ownerNameEn: 'Mock Owner',
    ownerDeptName: '',
    ownerDeptNameEn: '',
    bizRobotId: '',
    bizRobotName: '',
    bizRobotNameEn: '',
    weCodeUrl: 'h5://921535418692659/index.html#weAgentCUI',
  };

  assistantDetailsStore.set(internalAssistant.partnerAccount, internalAssistant);
  assistantDetailsStore.set(customAssistant.partnerAccount, customAssistant);

  const seedSession = createSession({
    ak: internalAssistant.appKey,
    title: 'mock-initial-session',
    bussinessDomain: 'miniapp',
    bussinessType: 'direct',
    assistantAccount: internalAssistant.partnerAccount,
    bussinessId: MOCK_UID,
  });

  const seedRecord: SessionRecord = {
    session: seedSession,
    messages: [],
    nextMessageSeq: 1,
    nextStreamSeq: 0,
    timerIds: [],
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
}

function ensureDefaultAssistantAccountInHash(): void {
  const hashValue = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hashValue) {
    window.location.hash = toRouteHash('/weAgentCUI', { assistantAccount: DEFAULT_ASSISTANT_ACCOUNT });
    return;
  }

  const hashUrl = parseUrl(hashValue);
  if (!hashUrl) return;
  if (hashUrl.pathname !== '/weAgentCUI') return;
  if (hashUrl.searchParams.get('assistantAccount')) return;

  window.location.hash = toRouteHash('/weAgentCUI', { assistantAccount: DEFAULT_ASSISTANT_ACCOUNT });
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

  if (typeof hwh5.getDeviceInfo !== 'function') {
    hwh5.getDeviceInfo = async () => ({ statusBarHeight: 0 });
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
      if (listeners.has(params.welinkSessionId)) {
        return;
      }
      listeners.set(params.welinkSessionId, {
        onMessage: params.onMessage,
        onError: params.onError,
        onClose: params.onClose,
      });
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

    replyPermission: async (params: ReplyPermissionParams) => ({
      welinkSessionId: params.welinkSessionId,
      permissionId: params.permId,
      response: params.response,
    }),

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
        creatorNameEn: 'Mock User',
        ownerWelinkId: 'mock_owner',
        ownerName: 'Mock Owner',
        ownerNameEn: 'Mock Owner',
        ownerDeptName: bizRobotId ? 'R&D' : '',
        ownerDeptNameEn: bizRobotId ? 'R&D' : '',
        bizRobotId,
        bizRobotName: bizRobotId ? 'Staff Assistant' : '',
        bizRobotNameEn: bizRobotId ? 'Staff Assistant' : '',
        weCodeUrl: buildExternalWeAgentUri(partnerAccount),
      };

      assistantDetailsStore.set(partnerAccount, detail);
      currentAssistantAccount = partnerAccount;

      return {
        partnerAccount,
        robotId: bizRobotId || undefined,
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
        .map((detail) => ({ ...detail }));

      if (details[0]?.partnerAccount) {
        currentAssistantAccount = details[0].partnerAccount;
      }

      return {
        WeAgentDetailsArray: details,
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
    ensureDefaultAssistantAccountInHash();
  } catch (error) {
    // mock 安装失败不应阻断页面渲染，避免首屏白屏
    // eslint-disable-next-line no-console
    console.error('[ai-chat-viewer] installJsApiMock failed:', error);
  }
}
