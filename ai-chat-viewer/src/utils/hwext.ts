import type {
  StreamMessage,
  SendMessageResponse,
  GetSessionMessageResponse,
  StopSkillResponse,
  SendMessageToIMResponse,
  ReplyPermissionResponse,
  RegenerateAnswerResponse,
  ControlSkillWeCodeResponse,
} from '../types';

export interface HWH5EXTError {
  code?: string;
  message?: string;
  timestamp?: number;
  errorCode?: number;
  errorMessage?: string;
}

export interface RegisterSessionListenerParams {
  welinkSessionId: string;
  onMessage: (message: StreamMessage) => void;
  onError?: (error: HWH5EXTError) => void;
  onClose?: (reason: string) => void;
}

export interface UnregisterSessionListenerParams {
  welinkSessionId: string;
}

export interface SendMessageParams {
  welinkSessionId: string;
  content: string;
  toolCallId?: string;
}

export interface GetSessionMessageParams {
  welinkSessionId: string;
  page?: number;
  size?: number;
}

export interface StopSkillParams {
  welinkSessionId: string;
}

export interface SendMessageToIMParams {
  welinkSessionId: string;
  messageId?: string;
  chatId?: string;
}

export interface ReplyPermissionParams {
  welinkSessionId: string;
  permId: string;
  response: 'once' | 'always' | 'reject';
}

export interface RegenerateAnswerParams {
  welinkSessionId: string;
}

export interface ControlSkillWeCodeParams {
  action: 'close' | 'minimize';
}

export interface HWH5EXT {
  regenerateAnswer(params: RegenerateAnswerParams): Promise<RegenerateAnswerResponse>;
  sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResponse>;
  getSessionMessage(params: GetSessionMessageParams): Promise<GetSessionMessageResponse>;
  registerSessionListener(params: RegisterSessionListenerParams): void;
  unregisterSessionListener(params: UnregisterSessionListenerParams): void;
  sendMessage(params: SendMessageParams): Promise<SendMessageResponse>;
  stopSkill(params: StopSkillParams): Promise<StopSkillResponse>;
  replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResponse>;
  controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResponse>;
}

interface Pedestal {
  callMethod: (method: string, payload: { funName: string; params: unknown }) => Promise<unknown> | unknown;
}

declare global {
  interface Window {
    HWH5EXT?: HWH5EXT;
    Pedestal?: Pedestal;
  }
}

const PEDESTAL_METHOD = 'method://agentSkills/handleSdk';

export function isPcMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.Pedestal?.callMethod === 'function';
}

function tryGetPedestal(): Pedestal | null {
  if (typeof window === 'undefined') return null;
  if (window.Pedestal && typeof window.Pedestal.callMethod === 'function') {
    return window.Pedestal;
  }
  return null;
}

function getPedestalOrThrow(): Pedestal {
  const pedestal = tryGetPedestal();
  if (pedestal) return pedestal;
  throw new Error('Pedestal.callMethod is not available. This code must run in PC miniapp environment.');
}

function createPedestalAdapter(pedestal: Pedestal): HWH5EXT {
  const call = <T>(funName: string, params: unknown) =>
    Promise.resolve(pedestal.callMethod(PEDESTAL_METHOD, { funName, params }) as T);

  return {
    regenerateAnswer: (params) => call<RegenerateAnswerResponse>('regenerateAnswer', params),
    sendMessageToIM: (params) => call<SendMessageToIMResponse>('sendMessageToIM', params),
    getSessionMessage: (params) => call<GetSessionMessageResponse>('getSessionMessage', params),
    registerSessionListener: (params) => {
      window.addEventListener("agentSkills_registerSessionListener_onMessage", (e: any) => {
        const msg = e.detail.msg;
        params.onMessage(msg);
      })
      void call<void>('registerSessionListener', { welinkSessionId: params.welinkSessionId }).catch((err) => {
        console.error('registerSessionListener failed:', err);
      });
    },
    unregisterSessionListener: (params) => {
      void call<void>('unregisterSessionListener', params).catch((err) => {
        console.error('unregisterSessionListener failed:', err);
      });
    },
    sendMessage: (params) => call<SendMessageResponse>('sendMessage', params),
    stopSkill: (params) => call<StopSkillResponse>('stopSkill', params),
    replyPermission: (params) => call<ReplyPermissionResponse>('replyPermission', params),
    controlSkillWeCode: (params) => {
      window.dispatchEvent(new CustomEvent('agentSkills_controlSkillWecode', {
        detail: { action: params.action }
      }))
      return call<ControlSkillWeCodeResponse>('controlSkillWeCode', params)
    },
  };
}

function getHWH5EXT(): HWH5EXT {
  if (typeof window !== 'undefined' && window.HWH5EXT) {
    return window.HWH5EXT;
  }
  throw new Error('HWH5EXT is not available. This code must run in WeLink miniapp environment.');
}

export function resolveJsApi(): HWH5EXT | null {
  if (typeof window === 'undefined') return null;
  if (isPcMiniApp()) {
    const pedestal = tryGetPedestal();
    return pedestal ? createPedestalAdapter(pedestal) : null;
  }
  return window.HWH5EXT ?? null;
}

function getJsApiOrThrow(): HWH5EXT {
  if (isPcMiniApp()) {
    return createPedestalAdapter(getPedestalOrThrow());
  }
  return getHWH5EXT();
}

export async function regenerateAnswer(params: RegenerateAnswerParams): Promise<RegenerateAnswerResponse> {
  return getJsApiOrThrow().regenerateAnswer(params);
}

export async function sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResponse> {
  return getJsApiOrThrow().sendMessageToIM(params);
}

export async function getSessionMessage(params: GetSessionMessageParams): Promise<GetSessionMessageResponse> {
  return getJsApiOrThrow().getSessionMessage(params);
}

export function registerSessionListener(params: RegisterSessionListenerParams): void {
  return getJsApiOrThrow().registerSessionListener(params);
}

export function unregisterSessionListener(params: UnregisterSessionListenerParams): void {
  return getJsApiOrThrow().unregisterSessionListener(params);
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
  return getJsApiOrThrow().sendMessage(params);
}

export async function stopSkill(params: StopSkillParams): Promise<StopSkillResponse> {
  return getJsApiOrThrow().stopSkill(params);
}

export async function replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResponse> {
  return getJsApiOrThrow().replyPermission(params);
}

export async function controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResponse> {
  return getJsApiOrThrow().controlSkillWeCode(params);
}

export function parseWelinkSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('welinkSessionId');
  if (!sessionId) return null;
  const normalized = sessionId.trim();
  return normalized.length > 0 ? normalized : null;
}
