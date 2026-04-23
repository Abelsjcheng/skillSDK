import type {
  GetSessionMessageHistoryResponse,
  GetSessionMessageResponse,
  RegenerateAnswerResponse,
  ReplyPermissionResponse,
  SendMessageResponse,
  StopSkillResponse,
} from '../types';
import type {
  AgentTypeListResult,
  CreateDigitalTwinResult,
  CreateNewSessionParams,
  GetHistorySessionsListParams,
  GetSessionMessageHistoryParams,
  GetSessionMessageParams,
  GetWeAgentDetailsParams,
  GetWeAgentListParams,
  HWH5EXT,
  HistorySessionsListResult,
  NotifyAssistantDetailUpdatedParams,
  NotifyAssistantDetailUpdatedResult,
  OpenWeAgentCUIParams,
  OpenWeAgentCUIResult,
  RegisterSessionListenerParams,
  ReplyPermissionParams,
  SendMessageParams,
  SendMessageToIMParams,
  SkillSession,
  StopSkillParams,
  UnregisterSessionListenerParams,
  UpdateWeAgentParams,
  UpdateWeAgentResult,
  WeAgentDetails,
  WeAgentDetailsArrayResult,
  WeAgentListResult,
  WeAgentUriResult,
} from '../types/bridge';
import type { CreateDigitalTwinParams, InternalAssistantOption } from '../types/digitalTwin';

interface OpenCodeBridgeConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  assistantAccount: string;
  assistantName: string;
  assistantDescription: string;
  assistantAvatar: string;
  appKey: string;
  userId: string;
  userNameZH: string;
  userNameEN: string;
  corpUserId: string;
}

interface ApiEnvelope<T> {
  code: number;
  errormsg: string;
  data: T;
}

type SessionListenerSet = Map<string, Set<RegisterSessionListenerParams>>;

function createSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createAssistantAvatar(label: string): string {
  const displayLabel = label.trim().slice(0, 2) || 'AI';
  return createSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="24" fill="#0D94FF" />
      <circle cx="40" cy="28" r="13" fill="#D8EEFF" fill-opacity="0.9" />
      <rect x="22" y="47" width="36" height="16" rx="8" fill="#D8EEFF" fill-opacity="0.9" />
      <text x="40" y="18" text-anchor="middle" font-size="12" fill="#ffffff">${displayLabel}</text>
    </svg>
  `);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) {
    return path;
  }
  return `${trimTrailingSlash(baseUrl)}${path}`;
}

function toWsBaseUrl(apiBaseUrl: string): string {
  if (!apiBaseUrl) {
    if (typeof window === 'undefined') {
      return 'ws://localhost:8082';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  if (apiBaseUrl.startsWith('https://')) {
    return apiBaseUrl.replace(/^https:\/\//, 'wss://');
  }

  if (apiBaseUrl.startsWith('http://')) {
    return apiBaseUrl.replace(/^http:\/\//, 'ws://');
  }

  return apiBaseUrl;
}

function parseUrlSearch(search: string): URLSearchParams {
  return new URLSearchParams(search.replace(/^[?#]/, ''));
}

function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const directValue = parseUrlSearch(window.location.search).get(name);
  if (directValue !== null) {
    return directValue;
  }

  const hashValue = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hashValue) {
    return null;
  }

  const questionIndex = hashValue.indexOf('?');
  if (questionIndex < 0) {
    return null;
  }

  return parseUrlSearch(hashValue.slice(questionIndex)).get(name);
}

function normalizeSession(rawSession: Record<string, unknown>): SkillSession {
  const welinkSessionId = String(rawSession.welinkSessionId ?? rawSession.id ?? '');
  const createdAt = typeof rawSession.createdAt === 'string'
    ? rawSession.createdAt
    : new Date().toISOString();
  const updatedAt = typeof rawSession.updatedAt === 'string'
    ? rawSession.updatedAt
    : createdAt;

  return {
    welinkSessionId,
    userId: typeof rawSession.userId === 'string' ? rawSession.userId : '',
    ak: typeof rawSession.ak === 'string' ? rawSession.ak : null,
    title: typeof rawSession.title === 'string' ? rawSession.title : null,
    bussinessDomain: typeof rawSession.bussinessDomain === 'string'
      ? rawSession.bussinessDomain
      : typeof rawSession.businessSessionDomain === 'string'
        ? rawSession.businessSessionDomain
        : null,
    bussinessType: typeof rawSession.bussinessType === 'string'
      ? rawSession.bussinessType
      : typeof rawSession.businessSessionType === 'string'
        ? rawSession.businessSessionType
        : null,
    bussinessId: typeof rawSession.bussinessId === 'string'
      ? rawSession.bussinessId
      : typeof rawSession.businessSessionId === 'string'
        ? rawSession.businessSessionId
        : null,
    assistantAccount: typeof rawSession.assistantAccount === 'string' ? rawSession.assistantAccount : null,
    status: typeof rawSession.status === 'string' ? rawSession.status : 'ACTIVE',
    toolSessionId: typeof rawSession.toolSessionId === 'string' ? rawSession.toolSessionId : null,
    createdAt,
    updatedAt,
  };
}

function normalizeProtocolMessage<T>(rawMessage: T): T {
  return rawMessage;
}

async function requestJson<T>(
  config: OpenCodeBridgeConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(joinUrl(config.apiBaseUrl, path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = await response.json() as ApiEnvelope<T> | T;
  if (!response.ok) {
    const message = typeof payload === 'object'
      && payload !== null
      && 'errormsg' in payload
      && typeof (payload as ApiEnvelope<T>).errormsg === 'string'
      ? (payload as ApiEnvelope<T>).errormsg
      : response.statusText;
    throw new Error(message || 'Request failed');
  }

  if (
    typeof payload === 'object'
    && payload !== null
    && 'code' in payload
    && 'data' in payload
  ) {
    const wrappedPayload = payload as ApiEnvelope<T>;
    if (wrappedPayload.code !== 0) {
      throw new Error(wrappedPayload.errormsg || 'Request failed');
    }
    return wrappedPayload.data;
  }

  return payload as T;
}

class SkillStreamSocket {
  private socket: WebSocket | null = null;
  private listeners: SessionListenerSet = new Map();
  private reconnectTimer: number | null = null;
  private connecting = false;

  constructor(private readonly config: OpenCodeBridgeConfig) {}

  register(params: RegisterSessionListenerParams): void {
    const sessionId = String(params.welinkSessionId);
    const sessionListeners = this.listeners.get(sessionId) ?? new Set<RegisterSessionListenerParams>();
    sessionListeners.add(params);
    this.listeners.set(sessionId, sessionListeners);
    this.ensureConnected();
  }

  unregister(params: UnregisterSessionListenerParams): void {
    const sessionId = String(params.welinkSessionId);
    this.listeners.delete(sessionId);
    if (this.listeners.size === 0) {
      this.close();
    }
  }

  private ensureConnected(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.connecting) {
      return;
    }

    this.connecting = true;
    const socketUrl = `${trimTrailingSlash(this.config.wsBaseUrl)}/ws/skill/stream`;
    const nextSocket = new WebSocket(socketUrl);

    nextSocket.onopen = () => {
      this.connecting = false;
    };

    nextSocket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch (error) {
        this.notifyError(`Invalid stream payload: ${String(error)}`);
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const message = parsed as Record<string, unknown>;
      const sessionId = typeof message.welinkSessionId === 'string' || typeof message.welinkSessionId === 'number'
        ? String(message.welinkSessionId)
        : '';

      if (sessionId) {
        const sessionListeners = this.listeners.get(sessionId);
        sessionListeners?.forEach((listener) => {
          listener.onMessage(message as any);
        });
        return;
      }

      this.listeners.forEach((sessionListeners) => {
        sessionListeners.forEach((listener) => {
          listener.onMessage(message as any);
        });
      });
    };

    nextSocket.onerror = () => {
      this.notifyError('Skill stream connection error');
    };

    nextSocket.onclose = (event) => {
      this.connecting = false;
      this.socket = null;
      this.listeners.forEach((sessionListeners) => {
        sessionListeners.forEach((listener) => {
          listener.onClose?.(event.reason || 'socket closed');
        });
      });
      if (this.listeners.size > 0) {
        this.scheduleReconnect();
      }
    };

    this.socket = nextSocket;
  }

  private notifyError(message: string): void {
    this.listeners.forEach((sessionListeners) => {
      sessionListeners.forEach((listener) => {
        listener.onError?.({ message });
      });
    });
  }

  private scheduleReconnect(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, 1000);
  }

  private close(): void {
    if (typeof window !== 'undefined' && this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connecting = false;
  }
}

function buildAssistantDetail(config: OpenCodeBridgeConfig): WeAgentDetails {
  return {
    name: config.assistantName,
    icon: config.assistantAvatar,
    desc: config.assistantDescription,
    moduleId: 'opencode-local-module',
    appKey: config.appKey,
    appSecret: 'opencode-local-secret',
    partnerAccount: config.assistantAccount,
    createdBy: config.userId,
    creatorName: config.userNameZH,
    creatorWorkId: '',
    creatorW3Account: '',
    creatorNameEn: config.userNameEN,
    ownerWelinkId: config.userId,
    ownerW3Account: '',
    ownerName: config.userNameZH,
    ownerNameEn: config.userNameEN,
    ownerDeptName: 'Local',
    ownerDeptNameEn: 'Local',
    id: '',
    bizRobotId: '',
    bizRobotTag: '',
    bizRobotName: config.assistantName,
    bizRobotNameEn: config.assistantName,
    weCodeUrl: '',
  };
}

export function resolveOpenCodeBridgeConfig(): OpenCodeBridgeConfig {
  const assistantAccount = (getQueryParam('assistantAccount') || getQueryParam('opencodeAssistantAccount') || 'opencode_local').trim();
  const assistantName = (getQueryParam('opencodeAssistantName') || 'OpenCode').trim();
  const assistantDescription = (getQueryParam('opencodeAssistantDesc') || 'Local OpenCode assistant bridge').trim();
  const apiBaseUrl = (getQueryParam('opencodeBaseUrl') || '').trim();
  const userId = (getQueryParam('opencodeUserId') || '10001').trim();

  return {
    apiBaseUrl,
    wsBaseUrl: (getQueryParam('opencodeWsBaseUrl') || toWsBaseUrl(apiBaseUrl)).trim(),
    assistantAccount,
    assistantName,
    assistantDescription,
    assistantAvatar: createAssistantAvatar(assistantName),
    appKey: (getQueryParam('opencodeAk') || 'opencode-local-ak').trim(),
    userId,
    userNameZH: (getQueryParam('opencodeUserName') || '本地用户').trim(),
    userNameEN: (getQueryParam('opencodeUserNameEn') || 'Local User').trim(),
    corpUserId: (getQueryParam('opencodeCorpUserId') || '').trim(),
  };
}

export function createOpenCodeHwh5ext(config: OpenCodeBridgeConfig): HWH5EXT {
  const socket = new SkillStreamSocket(config);
  let assistantDetail = buildAssistantDetail(config);

  return {
    async regenerateAnswer(params: { welinkSessionId: string }): Promise<RegenerateAnswerResponse> {
      return requestJson<RegenerateAnswerResponse>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/regenerate`,
        { method: 'POST' },
      );
    },

    async sendMessageToIM(params: SendMessageToIMParams) {
      const result = await requestJson<{ success?: boolean }>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/send-to-im`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: params.messageId ?? '',
            chatId: params.chatId ?? '',
          }),
        },
      );
      return { success: result.success !== false };
    },

    async getSessionMessage(params: GetSessionMessageParams): Promise<GetSessionMessageResponse> {
      const page = params.page ?? 0;
      const size = params.size ?? 20;
      const result = await requestJson<GetSessionMessageResponse>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/messages?page=${page}&size=${size}`,
      );
      return {
        ...result,
        content: Array.isArray(result.content)
          ? result.content.map((message) => normalizeProtocolMessage(message))
          : [],
      };
    },

    async getSessionMessageHistory(params: GetSessionMessageHistoryParams): Promise<GetSessionMessageHistoryResponse> {
      const searchParams = new URLSearchParams({
        size: String(params.size ?? 20),
      });
      if (params.beforeSeq !== undefined) {
        searchParams.set('beforeSeq', String(params.beforeSeq));
      }
      const result = await requestJson<GetSessionMessageHistoryResponse>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/messages/history?${searchParams.toString()}`,
      );
      return {
        ...result,
        content: Array.isArray(result.content)
          ? result.content.map((message) => normalizeProtocolMessage(message))
          : [],
      };
    },

    registerSessionListener(params: RegisterSessionListenerParams): void {
      socket.register(params);
    },

    unregisterSessionListener(params: UnregisterSessionListenerParams): void {
      socket.unregister(params);
    },

    async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
      const result = await requestJson<SendMessageResponse>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: params.content,
            ...(params.toolCallId ? { toolCallId: params.toolCallId } : {}),
          }),
        },
      );
      return normalizeProtocolMessage(result);
    },

    async stopSkill(params: StopSkillParams): Promise<StopSkillResponse> {
      return requestJson<StopSkillResponse>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/abort`,
        { method: 'POST' },
      );
    },

    async replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResponse> {
      return requestJson<ReplyPermissionResponse>(
        config,
        `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/permissions/${encodeURIComponent(params.permId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ response: params.response }),
        },
      );
    },

    async controlSkillWeCode(): Promise<{ status: 'success' | 'failed' }> {
      return { status: 'success' };
    },

    async createNewSession(params: CreateNewSessionParams): Promise<SkillSession> {
      const session = await requestJson<Record<string, unknown>>(
        config,
        '/api/skill/sessions',
        {
          method: 'POST',
          body: JSON.stringify({
            ak: params.ak,
            title: params.title,
            businessSessionDomain: params.bussinessDomain,
            businessSessionType: params.bussinessType,
            businessSessionId: params.bussinessId,
            assistantAccount: params.assistantAccount,
          }),
        },
      );
      return normalizeSession(session);
    },

    async createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult> {
      return {
        partnerAccount: `${config.assistantAccount}_custom`,
        robotId: params.bizRobotId ?? '',
        message: 'Local OpenCode mode does not persist digital twins yet.',
      };
    },

    async getAgentType(): Promise<AgentTypeListResult> {
      const content: InternalAssistantOption[] = [
        {
          name: config.assistantName,
          icon: config.assistantAvatar,
          bizRobotId: '',
        },
      ];
      return { content };
    },

    async getWeAgentList(_params: GetWeAgentListParams): Promise<WeAgentListResult> {
      return {
        content: [
          {
            name: config.assistantName,
            icon: config.assistantAvatar,
            description: config.assistantDescription,
            partnerAccount: config.assistantAccount,
            bizRobotName: config.assistantName,
            bizRobotNameEn: config.assistantName,
            robotId: '',
          },
        ],
      };
    },

    async getWeAgentDetails(params: GetWeAgentDetailsParams): Promise<WeAgentDetailsArrayResult> {
      const requestedAccounts = 'partnerAccount' in params
        ? [params.partnerAccount]
        : params.partnerAccounts;
      const details = requestedAccounts
        .filter((partnerAccount) => partnerAccount === config.assistantAccount)
        .map(() => assistantDetail);
      return {
        weAgentDetailsArray: details.length > 0 ? details : [assistantDetail],
      };
    },

    async updateWeAgent(params: UpdateWeAgentParams): Promise<UpdateWeAgentResult> {
      assistantDetail = {
        ...assistantDetail,
        name: params.name,
        icon: params.icon,
        desc: params.description,
      };
      return {
        updateResult: 'success',
      };
    },

    async notifyAssistantDetailUpdated(
      _params: NotifyAssistantDetailUpdatedParams,
    ): Promise<NotifyAssistantDetailUpdatedResult> {
      return {
        status: 'success',
      };
    },

    async getHistorySessionsList(params: GetHistorySessionsListParams): Promise<HistorySessionsListResult> {
      const searchParams = new URLSearchParams({
        page: String(params.page ?? 0),
        size: String(params.size ?? 20),
      });
      if (params.assistantAccount) {
        searchParams.set('assistantAccount', params.assistantAccount);
      }
      if (params.status) {
        searchParams.set('status', params.status);
      }
      if (params.ak) {
        searchParams.set('ak', params.ak);
      }
      if (params.bussinessId) {
        searchParams.set('businessSessionId', params.bussinessId);
      }
      if (params.businessSessionDomain) {
        searchParams.set('businessSessionDomain', params.businessSessionDomain);
      }

      const result = await requestJson<HistorySessionsListResult & { content?: Array<Record<string, unknown>> }>(
        config,
        `/api/skill/sessions?${searchParams.toString()}`,
      );

        return {
          ...result,
          content: Array.isArray(result.content)
          ? result.content.map((session) => normalizeSession(session as unknown as Record<string, unknown>))
          : [],
      };
    },

    async getWeAgentUri(): Promise<WeAgentUriResult> {
      const routeBase = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
      const query = `assistantAccount=${encodeURIComponent(config.assistantAccount)}&adapter=opencode`;
      return {
        weAgentUri: `${routeBase}#/weAgentCUI?${query}`,
        assistantDetailUri: `${routeBase}#/assistantDetail?partnerAccount=${encodeURIComponent(config.assistantAccount)}&adapter=opencode`,
        switchAssistantUri: `${routeBase}#/switchAssistant?partnerAccount=${encodeURIComponent(config.assistantAccount)}&adapter=opencode`,
      };
    },

    async openWeAgentCUI(params: OpenWeAgentCUIParams): Promise<OpenWeAgentCUIResult> {
      if (typeof window !== 'undefined') {
        const hashIndex = params.weAgentUri.indexOf('#');
        if (hashIndex >= 0) {
          window.location.hash = params.weAgentUri.slice(hashIndex + 1);
        }
      }
      return { status: 'success' };
    },
  };
}
