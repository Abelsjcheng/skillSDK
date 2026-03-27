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
import type { CreateDigitalTwinParams, InternalAssistantOption } from '../types/digitalTwin';

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
  isFirst?: boolean;
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

export interface GetWeAgentListParams {
  pageSize: number;
  pageNumber: number;
}

export interface WeAgentListItem {
  name: string;
  icon: string;
  description: string;
  partnerAccount: string;
  bizRobotName?: string;
  bizRobotNameEn?: string;
  robotId?: string;
}

export interface GetWeAgentDetailsMobileParams {
  partnerAccount: string;
}

export interface GetWeAgentDetailsPcParams {
  partnerAccounts: string[];
}

export type GetWeAgentDetailsParams = GetWeAgentDetailsMobileParams | GetWeAgentDetailsPcParams;

export interface WeAgentDetails {
  name: string;
  icon: string;
  desc: string;
  moduleId: string;
  appKey: string;
  appSecret: string;
  partnerAccount: string;
  createdBy: string;
  creatorName: string;
  creatorNameEn: string;
  ownerWelinkId: string;
  ownerName: string;
  ownerNameEn: string;
  ownerDeptName: string;
  ownerDeptNameEn: string;
  bizRobotId: string;
  bizRobotName?: string;
  bizRobotNameEn?: string;
  weCodeUrl: string;
}

export interface AgentTypeListResult {
  content: InternalAssistantOption[];
}

export interface WeAgentListResult {
  content: WeAgentListItem[];
}

export interface WeAgentDetailsArrayResult {
  WeAgentDetailsArray: WeAgentDetails[];
}

export interface CreateDigitalTwinResult {
  robotId?: string;
  partnerAccount?: string;
  message?: string;
  [key: string]: unknown;
}

export interface OpenWeAgentCUIParams {
  weAgentUri: string;
  assistantDetailUri: string;
  switchAssistantUri: string;
}

export interface OpenWeAgentCUIResult {
  status: 'success' | string;
}

export interface WeAgentUriResult {
  weAgentUri: string;
  assistantDetailUri: string;
  switchAssistantUri: string;
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
  createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult> | CreateDigitalTwinResult;
  getAgentType(): Promise<AgentTypeListResult> | AgentTypeListResult;
  getWeAgentList(params: GetWeAgentListParams): Promise<WeAgentListResult> | WeAgentListResult;
  getWeAgentDetails(params: GetWeAgentDetailsParams): Promise<WeAgentDetailsArrayResult> | WeAgentDetailsArrayResult;
  getWeAgentUri(): Promise<WeAgentUriResult> | WeAgentUriResult;
  openWeAgentCUI(params: OpenWeAgentCUIParams): Promise<OpenWeAgentCUIResult> | OpenWeAgentCUIResult;
}

interface Pedestal {
  callMethod: (method: string, payload: { funName: string; params: unknown }) => Promise<unknown> | unknown;
}

interface HWH5Bridge {
  openWebview?: (payload: { uri: string }) => void;
  getDeviceInfo?: () => Promise<unknown> | unknown;
  close?: () => void;
}

export interface HWH5DeviceInfo {
  statusBarHeight: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    HWH5EXT?: HWH5EXT;
    Pedestal?: Pedestal;
    HWH5?: HWH5Bridge;
  }
}

const PEDESTAL_METHOD = 'method://agentSkills/handleSdk';
export const WE_AGENT_BASE_URI = 'h5://123456/html/index.html';
export const ASSISTANT_DETAIL_BASE_URI = 'h5://123456/index.html#assistantDetail';
export const SWITCH_ASSISTANT_BASE_URI = 'h5://123456/index.html#switchAssistant';
const URL_PARSE_BASE = 'https://ai-chat-viewer.local';

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
      window.addEventListener('agentSkills_registerSessionListener_onMessage', (e: any) => {
        const msg = e.detail.msg;
        params.onMessage(msg);
      });
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
        detail: { action: params.action },
      }));
      return call<ControlSkillWeCodeResponse>('controlSkillWeCode', params);
    },
    createDigitalTwin: (params) => call<CreateDigitalTwinResult>('createDigitalTwin', params),
    getAgentType: () => call<AgentTypeListResult>('getAgentType', {}),
    getWeAgentList: (params) => call<WeAgentListResult>('getWeAgentList', params),
    getWeAgentDetails: (params) => call<WeAgentDetailsArrayResult>('getWeAgentDetails', params),
    getWeAgentUri: () => call<WeAgentUriResult>('getWeAgentUri', {}),
    openWeAgentCUI: (params) => call<OpenWeAgentCUIResult>('openWeAgentCUI', params),
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

function normalizeGetWeAgentDetailsParams(params: GetWeAgentDetailsParams): GetWeAgentDetailsParams {
  if (isPcMiniApp()) {
    if ('partnerAccounts' in params) {
      return { partnerAccounts: params.partnerAccounts };
    }
    return { partnerAccounts: [params.partnerAccount] };
  }

  if ('partnerAccount' in params) {
    return { partnerAccount: params.partnerAccount };
  }

  return { partnerAccount: params.partnerAccounts[0] ?? '' };
}

function parseUrl(value: string, base = URL_PARSE_BASE): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function normalizeSearchInput(routeSearch: string): string {
  if (!routeSearch) return routeSearch;
  if (
    routeSearch.startsWith('?') ||
    routeSearch.startsWith('#') ||
    routeSearch.startsWith('/') ||
    isAbsoluteUrl(routeSearch)
  ) {
    return routeSearch;
  }
  return `?${routeSearch}`;
}

function getQueryParamFromHash(hashValue: string, key: string): string | null {
  if (!hashValue) return null;
  const normalizedHash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
  if (!normalizedHash) return null;
  const hashUrl = parseUrl(normalizedHash);
  return hashUrl?.searchParams.get(key) ?? null;
}

function getQueryParamFromUrl(url: URL, key: string): string | null {
  const directValue = url.searchParams.get(key);
  if (directValue !== null) {
    return directValue;
  }
  return getQueryParamFromHash(url.hash, key);
}

export function getQueryParam(key: string, routeSearch = ''): string | null {
  const candidates: URL[] = [];
  if (routeSearch) {
    const routeUrl = parseUrl(normalizeSearchInput(routeSearch));
    if (routeUrl) {
      candidates.push(routeUrl);
    }
  }

  if (typeof window !== 'undefined') {
    const currentUrl = parseUrl(window.location.href);
    if (currentUrl) {
      candidates.push(currentUrl);
    }
  }

  for (const candidate of candidates) {
    const value = getQueryParamFromUrl(candidate, key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function appendQueryParam(uri: string, key: string, value: string): string {
  if (!uri) return uri;
  if (uri.startsWith('#')) {
    const hashUrl = parseUrl(uri.slice(1));
    if (!hashUrl) return uri;
    hashUrl.searchParams.set(key, value);
    const hashPath = hashUrl.pathname.startsWith('/') ? hashUrl.pathname : `/${hashUrl.pathname}`;
    return `#${hashPath}${hashUrl.search}${hashUrl.hash}`;
  }

  const parsed = parseUrl(uri);
  if (!parsed) return uri;
  parsed.searchParams.set(key, value);
  if (isAbsoluteUrl(uri)) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function appendHashRouteQueryParam(uri: string, key: string, value: string): string {
  if (!uri) return uri;
  const parsed = parseUrl(uri);
  if (!parsed) return uri;

  const hashValue = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  if (!hashValue) {
    return appendQueryParam(uri, key, value);
  }

  const hashUrl = parseUrl(hashValue);
  if (!hashUrl) {
    return appendQueryParam(uri, key, value);
  }

  hashUrl.searchParams.set(key, value);
  const hashPath = hashUrl.pathname.startsWith('/') ? hashUrl.pathname : `/${hashUrl.pathname}`;
  parsed.hash = `${hashPath}${hashUrl.search}`;

  if (isAbsoluteUrl(uri)) {
    return parsed.toString();
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildOpenWeAgentCUIParams(weCodeUrl: string, partnerAccount: string): OpenWeAgentCUIParams {
  const normalizedPartnerAccount = partnerAccount?.trim() ?? '';
  return {
    weAgentUri: appendQueryParam(weCodeUrl || WE_AGENT_BASE_URI, 'wecodePlace', 'weAgent'),
    assistantDetailUri: appendHashRouteQueryParam(
      ASSISTANT_DETAIL_BASE_URI,
      'partnerAccount',
      normalizedPartnerAccount,
    ),
    switchAssistantUri: appendHashRouteQueryParam(
      SWITCH_ASSISTANT_BASE_URI,
      'partnerAccount',
      normalizedPartnerAccount,
    ),
  };
}

export function openH5Webview(payload: { uri: string }): void {
  if (typeof window === 'undefined') return;

  if (typeof window.HWH5?.openWebview === 'function') {
    window.HWH5.openWebview(payload);
    return;
  }

  const { uri } = payload;
  const targetUrl = parseUrl(uri, window.location.href);
  if (!targetUrl) {
    window.location.href = uri;
    return;
  }

  if (targetUrl.hash) {
    const hashUrl = parseUrl(targetUrl.hash.slice(1));
    if (hashUrl) {
      const hashPath = hashUrl.pathname.startsWith('/') ? hashUrl.pathname : `/${hashUrl.pathname}`;
      const hashSearch = hashUrl.search || targetUrl.search;
      window.location.hash = `${hashPath}${hashSearch}`;
      return;
    }
  }

  if (isAbsoluteUrl(uri)) {
    window.location.href = targetUrl.toString();
  } else {
    window.location.href = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  }
}

function toPositiveNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export async function getDeviceInfo(): Promise<HWH5DeviceInfo> {
  if (isPcMiniApp()) {
    return { statusBarHeight: 0 };
  }

  const result = await Promise.resolve(window.HWH5?.getDeviceInfo?.());
  const deviceInfo = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
  return {
    ...deviceInfo,
    statusBarHeight: toPositiveNumber(deviceInfo.statusBarHeight),
  };
}

export async function getStatusBarHeight(): Promise<number> {
  return (await getDeviceInfo()).statusBarHeight;
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

export async function getAgentType(): Promise<AgentTypeListResult> {
  return getJsApiOrThrow().getAgentType();
}

export async function createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult> {
  return getJsApiOrThrow().createDigitalTwin(params);
}

export async function getWeAgentList(params: GetWeAgentListParams): Promise<WeAgentListResult> {
  return getJsApiOrThrow().getWeAgentList(params);
}

export async function getWeAgentDetails(params: GetWeAgentDetailsParams): Promise<WeAgentDetailsArrayResult> {
  return getJsApiOrThrow().getWeAgentDetails(normalizeGetWeAgentDetailsParams(params));
}

export async function getWeAgentUri(): Promise<WeAgentUriResult> {
  return getJsApiOrThrow().getWeAgentUri();
}

export async function openWeAgentCUI(params: OpenWeAgentCUIParams): Promise<OpenWeAgentCUIResult> {
  return getJsApiOrThrow().openWeAgentCUI(params);
}

export function parseWelinkSessionId(): string | null {
  const sessionId = getQueryParam('welinkSessionId');
  if (!sessionId) return null;
  const normalized = sessionId.trim();
  return normalized.length > 0 ? normalized : null;
}
