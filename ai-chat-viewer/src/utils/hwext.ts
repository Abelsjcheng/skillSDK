import type {
  SendMessageResponse,
  GetSessionMessageResponse,
  GetSessionMessageHistoryResponse,
  StopSkillResponse,
  SendMessageToIMResponse,
  ReplyPermissionResponse,
  RegenerateAnswerResponse,
  ControlSkillWeCodeResponse,
} from '../types';
import type { CreateDigitalTwinParams } from '../types/digitalTwin';
import type {
  AgentTypeListResult,
  BuildOpenWeAgentCUIOptions,
  ChooseImageParams,
  ControlSkillWeCodeParams,
  CreateDigitalTwinResult,
  CreateNewSessionParams,
  GetHistorySessionsListParams,
  GetSessionMessageHistoryParams,
  GetSessionMessageParams,
  GetWeAgentDetailsParams,
  GetWeAgentListParams,
  HWH5AppInfo,
  HWH5DeviceInfo,
  HWH5EXT,
  HWH5UserInfo,
  HistorySessionsListResult,
  NotifyAssistantDetailUpdatedParams,
  NotifyAssistantDetailUpdatedResult,
  OpenWeAgentCUIParams,
  OpenWeAgentCUIResult,
  Pedestal,
  RegisterSessionListenerParams,
  RegenerateAnswerParams,
  ReplyPermissionParams,
  ResolveRobotIdOptions,
  SendMessageParams,
  SendMessageToIMParams,
  SkillSession,
  StopSkillParams,
  UnregisterSessionListenerParams,
  UpdateWeAgentParams,
  UpdateWeAgentResult,
  UploadFileParams,
  WeAgentDetails,
  WeAgentDetailsArrayResult,
  WeAgentListResult,
  WeAgentUriResult,
} from '../types/bridge';
import { APP_ID, isPcMiniApp } from '../constants';
import { WeLog } from './logger';

const PEDESTAL_METHOD = 'method://agentSkills/handleSdk';
export const WE_AGENT_BASE_URI = `h5://${APP_ID}/index.html#weAgentCUI`;
export const ASSISTANT_PAGE_BASE_URI = `h5://${APP_ID}/index.html`;
export const CUSTOMER_SERVICE_WEBVIEW_URI = 'h5://123456/html/index.html';
export const MOCK_CUSTOMER_SERVICE_SOURCE_URL = 'https://mock.example.com/customer-service';
const URL_PARSE_BASE = 'https://ai-chat-viewer.local';

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
    getSessionMessageHistory: (params) => call<GetSessionMessageHistoryResponse>('getSessionMessageHistory', params),
    registerSessionListener: (params) => {
      window.addEventListener('agentSkills_registerSessionListener_onMessage', (e: any) => {
        const msg = e.detail.msg;
        params.onMessage(msg);
      });
      void call<void>('registerSessionListener', { welinkSessionId: params.welinkSessionId }).catch((err) => {
        WeLog(`hwext registerSessionListener failed | extra=${JSON.stringify({ welinkSessionId: params.welinkSessionId })} | error=${JSON.stringify(err)}`);
      });
    },
    unregisterSessionListener: (params) => {
      void call<void>('unregisterSessionListener', params).catch((err) => {
        WeLog(`hwext unregisterSessionListener failed | extra=${JSON.stringify({ welinkSessionId: params.welinkSessionId })} | error=${JSON.stringify(err)}`);
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
    createNewSession: (params) => call<SkillSession>('createNewSession', params),
    createDigitalTwin: (params) => call<CreateDigitalTwinResult>('createDigitalTwin', params),
    getAgentType: () => call<AgentTypeListResult>('getAgentType', {}),
    getWeAgentList: (params) => call<WeAgentListResult>('getWeAgentList', params),
    getWeAgentDetails: (params) => call<WeAgentDetailsArrayResult>('getWeAgentDetails', params),
    updateWeAgent: (params) => call<UpdateWeAgentResult>('updateWeAgent', params),
    notifyAssistantDetailUpdated: (params) => call<NotifyAssistantDetailUpdatedResult>('notifyAssistantDetailUpdated', params),
    getHistorySessionsList: (params) => call<HistorySessionsListResult>('getHistorySessionsList', params),
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

export function getQueryParam(key: string, routeSearch = ''): string | null {
  const normalizedRouteSearch = routeSearch.replace(/^[?#]/, '');
  if (normalizedRouteSearch) {
    const routeValue = new URLSearchParams(normalizedRouteSearch).get(key);
    if (routeValue !== null) {
      return routeValue;
    }
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const currentUrl = parseUrl(window.location.href);
  if (!currentUrl) {
    return null;
  }

  const directValue = currentUrl.searchParams.get(key);
  if (directValue !== null) {
    return directValue;
  }

  const hashValue = currentUrl.hash.startsWith('#') ? currentUrl.hash.slice(1) : currentUrl.hash;
  if (!hashValue) {
    return null;
  }

  const hashUrl = parseUrl(hashValue);
  return hashUrl?.searchParams.get(key) ?? null;
}

export function appendQueryParam(uri: string, key: string, value: string): string {
  if (!uri) return uri;

  const parsed = parseUrl(uri);
  if (!parsed) return uri;
  parsed.searchParams.set(key, value);
  if (isAbsoluteUrl(uri)) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function normalizeString(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getUrlHost(value: string): string {
  const normalizedValue = normalizeString(value);
  if (!normalizedValue) {
    return '';
  }

  const matched = normalizedValue.match(/^[a-zA-Z][a-zA-Z\d+.-]*:\/\/([^/?#]+)/);
  return matched?.[1]?.trim() ?? '';
}

function buildAssistantPageUri(partnerAccount: string, hash: 'assistantDetail' | 'switchAssistant'): string {
  const parsed = parseUrl(ASSISTANT_PAGE_BASE_URI);
  if (!parsed) return ASSISTANT_PAGE_BASE_URI;
  parsed.searchParams.set('partnerAccount', partnerAccount);
  parsed.hash = hash;
  return parsed.toString();
}

export function resolveWeCodeUrlForOpenWeAgentCUI(
  detail: Pick<WeAgentDetails, 'bizRobotId' | 'weCodeUrl'>,
  _partnerAccount: string,
): string {
  const normalizedWeCodeUrl = normalizeString(detail.weCodeUrl);

  if (detail.bizRobotId?.trim()) {
    return normalizedWeCodeUrl || WE_AGENT_BASE_URI;
  }

  return normalizedWeCodeUrl || WE_AGENT_BASE_URI;
}

export function resolveRobotIdForOpenWeAgentCUI(options: ResolveRobotIdOptions): string {
  return normalizeString(options.detailId)
    || normalizeString(options.listRobotId)
    || normalizeString(options.createRobotId);
}

export function buildOpenWeAgentCUIParams(
  weCodeUrl: string,
  partnerAccount: string,
  options?: BuildOpenWeAgentCUIOptions,
): OpenWeAgentCUIParams {
  const normalizedPartnerAccount = partnerAccount?.trim() ?? '';
  const normalizedWeCodeUrl = normalizeString(weCodeUrl) || WE_AGENT_BASE_URI;
  const weCodeUrlHost = getUrlHost(normalizedWeCodeUrl);
  const isSameAppIdHost = weCodeUrlHost === APP_ID;
  const normalizedRobotId = normalizeString(options?.robotId);
  let weAgentUri = appendQueryParam(normalizedWeCodeUrl, 'wecodePlace', 'weAgent');

  if (!weCodeUrlHost || isSameAppIdHost) {
    weAgentUri = appendQueryParam(weAgentUri, 'assistantAccount', normalizedPartnerAccount);
  }

  if (weCodeUrlHost && !isSameAppIdHost && normalizedRobotId) {
    weAgentUri = appendQueryParam(weAgentUri, 'robotId', normalizedRobotId);
  }

  return {
    weAgentUri,
    assistantDetailUri: buildAssistantPageUri(normalizedPartnerAccount, 'assistantDetail'),
    switchAssistantUri: buildAssistantPageUri(normalizedPartnerAccount, 'switchAssistant'),
  };
}

export function openH5Webview(payload: { uri: string }): void {
  if (isPcMiniApp()) {
    getPedestalOrThrow().callMethod('method://pedestal/openUrl', payload.uri);
  } else {
    window.HWH5?.openWebview(payload);
  }
}

export function buildCustomerServiceWebviewUri(sourceUrl: string, timestamp = Date.now()): string {
  const normalizedSourceUrl = normalizeString(sourceUrl);
  return `${CUSTOMER_SERVICE_WEBVIEW_URI}?sourceURL=${encodeURIComponent(normalizedSourceUrl)}&rt=${timestamp}`;
}

function toPositiveNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toAppLanguage(value: string): 'zh' | 'en' {
  if (isPcMiniApp()) {
    return value === '1033' ? 'en' : 'zh'
  } else {
    return value === 'en' ? 'en' : 'zh'
  }
}

export async function getDeviceInfo(): Promise<HWH5DeviceInfo> {
  if (isPcMiniApp()) {
    return { statusBarHeight: 0, safeAreaInsetBottom: 0 };
  }

  const result = await window.HWH5?.getDeviceInfo?.();
  const deviceInfo = (result && typeof result === 'object' ? result : {}) as HWH5DeviceInfo;
  return {
    ...deviceInfo,
    statusBarHeight: toPositiveNumber(deviceInfo.statusBarHeight),
  };
}

export async function getStatusBarHeight(): Promise<number> {
  return (await getDeviceInfo()).statusBarHeight;
}

export async function getAppInfo(): Promise<HWH5AppInfo> {
  try {
    if (isPcMiniApp()) {
      const language = window?.localStorage?.getItem('language') || '';
      return {
        language: toAppLanguage(language),
      };
    }

    const result = await window.HWH5?.getAppInfo?.();
    const appInfo = (result && typeof result === 'object' ? result : {}) as HWH5AppInfo;

    return {
      language: toAppLanguage(appInfo.language),
    };
  } catch (error) {
    return {
      language: 'zh',
    };
  }
}

export function registerAppLanguageListener(listener: (language: 'zh' | 'en') => void): void {
  if (isPcMiniApp()) {
    window.onReceive = (schema: string, payload: string) => {
      if (schema === '') {
        const language = toAppLanguage(payload);
        if (!language) {
          return;
        }
        listener(language);
      }
    };
    return;
  }
}

export async function getUserInfo(): Promise<HWH5UserInfo> {
  if (isPcMiniApp()) {
    return {
      uid: '',
      userNameZH: '',
      userNameEN: '',
      corpUserId: '',
    };
  }

  const result = await Promise.resolve(window.HWH5?.getUserInfo?.());
  const userInfo = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;

  return {
    ...userInfo,
    uid: toTrimmedString(userInfo.uid),
    userNameZH: toTrimmedString(userInfo.userNameZH),
    userNameEN: toTrimmedString(userInfo.userNameEN),
    corpUserId: toTrimmedString(userInfo.corpUserId),
  };
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

export async function getSessionMessageHistory(
  params: GetSessionMessageHistoryParams,
): Promise<GetSessionMessageHistoryResponse> {
  return getJsApiOrThrow().getSessionMessageHistory(params);
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

export async function createNewSession(params: CreateNewSessionParams): Promise<SkillSession> {
  return getJsApiOrThrow().createNewSession(params);
}

export async function getAccountInfoUid(): Promise<string> {
  return (await getUserInfo()).uid;
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

export async function updateWeAgent(params: UpdateWeAgentParams): Promise<UpdateWeAgentResult> {
  return getJsApiOrThrow().updateWeAgent(params);
}

export async function notifyAssistantDetailUpdated(
  params: NotifyAssistantDetailUpdatedParams,
): Promise<NotifyAssistantDetailUpdatedResult> {
  return getJsApiOrThrow().notifyAssistantDetailUpdated(params);
}

export async function getHistorySessionsList(
  params: GetHistorySessionsListParams,
): Promise<HistorySessionsListResult> {
  return getJsApiOrThrow().getHistorySessionsList(params);
}

export async function getWeAgentUri(): Promise<WeAgentUriResult> {
  return getJsApiOrThrow().getWeAgentUri();
}

export async function openWeAgentCUI(params: OpenWeAgentCUIParams): Promise<OpenWeAgentCUIResult> {
  return getJsApiOrThrow().openWeAgentCUI(params);
}

export async function uploadFile(params: UploadFileParams): Promise<unknown> {
  if (isPcMiniApp()) {
    throw new Error('HWH5.uploadFile is not available in PC miniapp environment.');
  }

  if (typeof window === 'undefined' || typeof window.HWH5?.uploadFile !== 'function') {
    throw new Error('HWH5.uploadFile is not available.');
  }

  return Promise.resolve(window.HWH5.uploadFile(params));
}

export async function chooseImage(params: ChooseImageParams): Promise<unknown> {
  if (isPcMiniApp()) {
    throw new Error('HWH5.chooseImage is not available in PC miniapp environment.');
  }

  if (typeof window === 'undefined' || typeof window.HWH5?.chooseImage !== 'function') {
    throw new Error('HWH5.chooseImage is not available.');
  }

  return Promise.resolve(window.HWH5.chooseImage(params));
}

export function parseWelinkSessionId(): string | null {
  const sessionId = getQueryParam('welinkSessionId');
  if (!sessionId) return null;
  const normalized = sessionId.trim();
  return normalized.length > 0 ? normalized : null;
}
