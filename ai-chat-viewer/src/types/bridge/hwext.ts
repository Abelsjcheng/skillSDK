import type {
  ControlSkillWeCodeResponse,
  GetSessionMessageHistoryResponse,
  GetSessionMessageResponse,
  RegenerateAnswerResponse,
  ReplyPermissionResponse,
  SendMessageResponse,
  SendMessageToIMResponse,
  StopSkillResponse,
  StreamMessage,
} from '../index';
import type { CreateDigitalTwinParams, InternalAssistantOption } from '../digitalTwin';

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

export interface GetSessionMessageHistoryParams {
  welinkSessionId: string;
  beforeSeq?: number;
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

export interface CreateNewSessionParams {
  ak: string;
  title?: string;
  bussinessDomain: string;
  bussinessId: string;
  bussinessType: string;
  assistantAccount: string;
}

export interface GetWeAgentListParams {
  pageSize: number;
  pageNumber: number;
}

export interface GetHistorySessionsListParams {
  page?: number;
  size?: number;
  status?: string;
  ak?: string;
  bussinessId?: string;
  assistantAccount?: string;
  businessSessionDomain?: 'miniapp' | 'im' | string;
}

export interface SkillSession {
  welinkSessionId: string;
  userId: string;
  ak: string | null;
  title: string | null;
  bussinessDomain: string | null;
  bussinessType: string | null;
  bussinessId: string | null;
  assistantAccount: string | null;
  status: string;
  toolSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistorySessionsListResult {
  content: SkillSession[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
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

export interface UpdateWeAgentParams {
  partnerAccount?: string;
  robotId?: string;
  name: string;
  icon: string;
  description: string;
}

export interface UpdateWeAgentResult {
  updateResult: string;
}

export interface DeleteWeAgentParams {
  partnerAccount?: string;
  robotId?: string;
}

export interface DeleteWeAgentResult {
  deleteResult: string;
}

export interface QueryQrcodeInfoParams {
  qrcode: string;
}

export interface QueryQrcodeInfoResult {
  qrcode: string;
  weUrl: string;
  pcUrl: string;
  expireTime: string;
  status: number;
  expired: boolean;
}

export interface UpdateQrcodeInfoParams {
  qrcode: string;
  robotId?: string;
  status: number;
}

export interface UpdateQrcodeInfoResult {
  status: string;
}

export interface NotifyAssistantDetailUpdatedParams {
  name: string;
  icon: string;
  description: string;
  partnerAccount?: string;
  robotId?: string;
}

export interface NotifyAssistantDetailUpdatedResult {
  status: string;
}

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
  creatorWorkId: string;
  creatorW3Account: string;
  creatorNameEn: string;
  ownerWelinkId: string;
  ownerW3Account: string;
  ownerName: string;
  ownerNameEn: string;
  ownerDeptName: string;
  ownerDeptNameEn: string;
  id: string;
  bizRobotId: string;
  bizRobotTag: string;
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
  weAgentDetailsArray: WeAgentDetails[];
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

export interface OpenIMChatParams {
  chatID?: string,
  chatType?: string
}

export interface BuildOpenWeAgentCUIOptions {
  bizRobotId?: string;
  robotId?: string;
}

export interface ResolveRobotIdOptions {
  detailId?: string;
  listRobotId?: string;
  createRobotId?: string;
}

export interface OpenWeAgentCUIResult {
  status: 'success' | string;
}

export interface UploadFileParams {
  serverlUrl: string;
  filePath: string;
  name: string;
  formData: object;
}

export interface ChooseImageParams {
  flag: number;
  imagePickerMode: string;
  maxSelectedCount: number;
  showOrigin: boolean;
  type: number;
}

export interface HWH5AddEventListenerParams {
  type: string;
  func: Function;
}

export interface FetchFullOptions {
  method: string;
  headers: Record<string, string>;
}

export interface FetchFullResponse<T = unknown> {
  json: () => Promise<T>;
}

export interface CreateAssistantWhitelistResponse {
  code: number;
  data?: {
    IMPersonalAssistant?: {
      enable?: number;
    };
    [key: string]: unknown;
  };
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
  getSessionMessageHistory(params: GetSessionMessageHistoryParams): Promise<GetSessionMessageHistoryResponse>;
  onTabForUpdate?: (callback: () => void) => void;
  registerSessionListener(params: RegisterSessionListenerParams): void;
  unregisterSessionListener(params: UnregisterSessionListenerParams): void;
  sendMessage(params: SendMessageParams): Promise<SendMessageResponse>;
  stopSkill(params: StopSkillParams): Promise<StopSkillResponse>;
  replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResponse>;
  controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResponse>;
  createNewSession(params: CreateNewSessionParams): Promise<SkillSession> | SkillSession;
  createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult> | CreateDigitalTwinResult;
  getAgentType(): Promise<AgentTypeListResult> | AgentTypeListResult;
  getWeAgentList(params: GetWeAgentListParams): Promise<WeAgentListResult> | WeAgentListResult;
  getWeAgentDetails(params: GetWeAgentDetailsParams): Promise<WeAgentDetailsArrayResult> | WeAgentDetailsArrayResult;
  updateWeAgent(params: UpdateWeAgentParams): Promise<UpdateWeAgentResult> | UpdateWeAgentResult;
  deleteWeAgent(params: DeleteWeAgentParams): Promise<DeleteWeAgentResult> | DeleteWeAgentResult;
  queryQrcodeInfo(params: QueryQrcodeInfoParams): Promise<QueryQrcodeInfoResult> | QueryQrcodeInfoResult;
  updateQrcodeInfo(params: UpdateQrcodeInfoParams): Promise<UpdateQrcodeInfoResult> | UpdateQrcodeInfoResult;
  notifyAssistantDetailUpdated(
    params: NotifyAssistantDetailUpdatedParams,
  ): Promise<NotifyAssistantDetailUpdatedResult> | NotifyAssistantDetailUpdatedResult;
  getHistorySessionsList(params: GetHistorySessionsListParams): Promise<HistorySessionsListResult> | HistorySessionsListResult;
  getWeAgentUri(): Promise<WeAgentUriResult> | WeAgentUriResult;
  openWeAgentCUI(params: OpenWeAgentCUIParams): Promise<OpenWeAgentCUIResult> | OpenWeAgentCUIResult;
}

export interface Pedestal {
  callMethod: (method: string, payload?: unknown) => Promise<unknown> | unknown;
}

export interface HWH5Bridge {
  openWebview: (payload: { uri: string }) => void;
  log?: (payload: { content: string; type: 'i' }) => Promise<unknown> | unknown;
  uem?: (
    eventName: string,
    payload: {
      type: 'info';
      code: string;
      name: string;
      result: boolean;
      msg: string;
      duration: number;
      data: Record<string, unknown>;
    },
  ) => Promise<unknown> | unknown;
  showToast?: (payload: { msg: string; type: 'w' }) => Promise<unknown> | unknown;
  reboot?: () => Promise<unknown> | unknown;
  addEventListener?: (params: HWH5AddEventListenerParams) => Promise<unknown> | unknown;
  uploadFile?: (params: UploadFileParams) => Promise<unknown> | unknown;
  chooseImage?: (params: ChooseImageParams) => Promise<unknown> | unknown;
  getDeviceInfo?: () => Promise<unknown> | unknown;
  getAppInfo?: () => Promise<unknown> | unknown;
  getUserInfo?: () => Promise<unknown> | unknown;
  getAccountInfo?: () => Promise<unknown> | unknown;
  fetchFull: <T = unknown>(
    url: string,
    options: FetchFullOptions,
  ) => Promise<FetchFullResponse<T>> | FetchFullResponse<T>;
  onKeyboardHeightChange?: (listener: (res: { height: number }) => void) => void;
  offKeyboardHeightChange?: () => void;
  disableAutoPushUpPage?: (payload: { status: boolean }) => Promise<unknown> | unknown;
  navigateBack: () => void;
  close: () => void;
  openIMChat?: (params: OpenIMChatParams) => Promise<unknown> | unknown;
}

export interface HWH5DeviceInfo {
  statusBarHeight: number;
  safeAreaInsetBottom: number;
  [key: string]: unknown;
}

export interface HWH5AppInfo {
  language: string;
  [key: string]: unknown;
}

export interface HWH5UserInfo {
  uid: string;
  userNameZH: string;
  userNameEN: string;
  corpUserId: string;
  [key: string]: unknown;
}
