import { uri } from '@kit.ArkTS';
import { HttpClient } from './core/HttpClient';
import { WebSocketManager } from './core/WebSocketManager';
import { SessionStateManager } from './managers/SessionStateManager';
import { WeCodeStateManager } from './managers/WeCodeStateManager';
import { Logger } from './utils/Logger';
import { TypeConverter } from './utils/TypeConverter';
import { Validator } from './utils/Validator';
import { WeAgentStore } from './utils/WeAgentStore';
import {
  AgentType,
  AgentTypeList,
  AssistantDetailUpdatedPayload,
  CloseSkillResult,
  ControlSkillWeCodeParams,
  ControlSkillWeCodeResult,
  CreateDigitalTwinParams,
  CreateDigitalTwinResult,
  CreateNewSessionParams,
  CreateSessionParams,
  CursorResult,
  DeleteWeAgentParams,
  DeleteWeAgentResult,
  GetSessionMessageParams,
  GetSessionMessageHistoryParams,
  HistorySessionsParams,
  NotifyAssistantDetailUpdatedParams,
  NotifyAssistantDetailUpdatedResult,
  OnSessionStatusChangeParams,
  OnSkillWecodeStatusChangeParams,
  OpenAssistantEditPageParams,
  OpenAssistantEditPageResult,
  PageParams,
  PageResult,
  QrcodeInfo,
  QueryWeAgentParams,
  QueryQrcodeInfoParams,
  RegisterSessionListenerParams,
  RegisterSessionListenerResult,
  RegenerateAnswerParams,
  ReplyPermissionParams,
  ReplyPermissionResult,
  SendMessageParams,
  SendMessageResult,
  SendMessageToIMParams,
  SendMessageToIMResult,
  SessionMessage,
  SessionStatus,
  SkillSDKConfig,
  SkillSdkException,
  SkillSession,
  SkillWecodeStatus,
  SkillWeCodeAction,
  StopSkillParams,
  StopSkillResult,
  StreamMessage,
  UpdateQrcodeInfoParams,
  UpdateQrcodeInfoResult,
  UpdateWeAgentParams,
  UpdateWeAgentResult,
  WeAgent,
  WeAgentDetailsArray,
  WeAgentDetails,
  WeAgentList,
  WeAgentUriResult,
  UnregisterSessionListenerParams,
  UnregisterSessionListenerResult
} from './types';

interface DeleteTransitionPlan {
  updatedList: WeAgent[];
  nextPartnerAccount?: string;
}

interface DeleteWeAgentContext {
  partnerAccount?: string;
  robotId?: string;
  deletingCurrentWeAgent: boolean;
  hasListCache: boolean;
  transitionPlan?: DeleteTransitionPlan;
}

/**
 * Singleton SDK entry.
 * Exposes public interfaces aligned with SkillClientSdkInterfaceV1.md.
 */
export class SkillSDK {
  private static instance: SkillSDK | null = null;
  private static readonly ASSISTANT_H5_URI = 'h5://S008623/index.html';
  private static readonly WE_AGENT_CUI_APPID = 'S008623';
  private static readonly DEFAULT_WE_AGENT_LIST_PAGE_SIZE = 100;
  private static readonly DEFAULT_WE_AGENT_LIST_PAGE_NUMBER = 1;

  private config: SkillSDKConfig;
  private readonly logger: Logger;
  private readonly httpClient: HttpClient;
  private readonly wsManager: WebSocketManager;
  private readonly sessionStateManager: SessionStateManager;
  private readonly weCodeStateManager: WeCodeStateManager;
  private readonly weAgentStore: WeAgentStore;
  private readonly assistantDetailUpdatedCallbacks: Map<string, (payload: AssistantDetailUpdatedPayload) => void>;

  private constructor(config: SkillSDKConfig) {
    this.validateConfig(config);
    this.config = {
      ...config,
      timeout: config.timeout ?? 30_000,
      enableLog: config.enableLog ?? false
    };
    this.logger = new Logger('SkillSDK', this.config.enableLog);

    this.httpClient = new HttpClient(this.config);
    this.wsManager = WebSocketManager.getInstance(this.config);
    this.sessionStateManager = new SessionStateManager(this.config.enableLog);
    this.weCodeStateManager = new WeCodeStateManager(this.config.enableLog);
    this.weAgentStore = new WeAgentStore(this.config.context);
    this.assistantDetailUpdatedCallbacks = new Map();

    this.wsManager.setMessageHandler((message: StreamMessage) => {
      this.sessionStateManager.onStreamMessage(message);
    });
  }

  static getInstance(config?: SkillSDKConfig): SkillSDK {
    if (SkillSDK.instance === null) {
      if (config === undefined) {
        throw new SkillSdkException(1000, 'SkillSDK config is required on first initialization');
      }
      SkillSDK.instance = new SkillSDK(config);
    }
    return SkillSDK.instance;
  }

  static async destroyInstance(): Promise<void> {
    if (SkillSDK.instance === null) {
      return;
    }
    try {
      await SkillSDK.instance.wsManager.disconnect();
      SkillSDK.instance.wsManager.clearAllListeners();
      SkillSDK.instance.sessionStateManager.clearAll();
      SkillSDK.instance.weCodeStateManager.clearAll();
      SkillSDK.instance.assistantDetailUpdatedCallbacks.clear();
      WebSocketManager.destroyInstance();
    } finally {
      SkillSDK.instance = null;
    }
  }

  updateConfig(nextConfig: Partial<SkillSDKConfig>): void {
    this.config = {
      ...this.config,
      ...nextConfig
    };
    this.httpClient.updateConfig(nextConfig);
    this.wsManager.updateConfig(nextConfig);
    if (nextConfig.context !== undefined) {
      this.weAgentStore.updateContext(nextConfig.context);
    }
    if (nextConfig.enableLog !== undefined) {
      this.logger.setEnabled(nextConfig.enableLog);
      this.sessionStateManager.setEnableLog(nextConfig.enableLog);
      this.weCodeStateManager.setEnableLog(nextConfig.enableLog);
    }
  }

  // 1. createSession
  async createSession(params: CreateSessionParams): Promise<SkillSession> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.imGroupId, 'imGroupId');
      const ak = this.normalizeOptionalString(params.ak);
      const imGroupId = params.imGroupId.trim();
      if (params.ak !== undefined && ak === undefined) {
        throw new SkillSdkException(1000, 'ak must be a non-empty string');
      }
      if (params.title !== undefined) {
        Validator.requireString(params.title, 'title');
      }

      await this.wsManager.connect();

      const query: Record<string, string | number> = {
        imGroupId,
        status: 'ACTIVE',
        page: 0,
        size: 20
      };
      if (ak !== undefined) {
        query.ak = ak;
      }
      const sessionList = await this.httpClient.get<PageResult<SkillSession>>('/api/skill/sessions', query);
      const active = sessionList.content ?? [];
      if (active.length > 0) {
        return this.pickLatestSession(active);
      }

      const payload: Record<string, Object> = {};
      if (ak !== undefined) {
        payload.ak = ak;
      }
      if (params.title !== undefined) {
        payload.title = params.title;
      }
      payload.imGroupId = imGroupId;
      return await this.httpClient.post<SkillSession>('/api/skill/sessions', payload);
    } catch (error) {
      throw this.normalizeError('createSession', error);
    }
  }

  // 2. closeSkill
  async closeSkill(): Promise<CloseSkillResult> {
    try {
      if (!this.wsManager.isConnected()) {
        throw new SkillSdkException(3000, 'WebSocket is not connected');
      }
      await this.wsManager.disconnect();
      this.wsManager.clearAllListeners();
      this.sessionStateManager.clearAll();
      this.weCodeStateManager.clearAll();
      this.assistantDetailUpdatedCallbacks.clear();
      return { status: 'success' };
    } catch (error) {
      throw this.normalizeError('closeSkill', error);
    }
  }

  // 3. stopSkill
  async stopSkill(params: StopSkillParams): Promise<StopSkillResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.welinkSessionId, 'welinkSessionId');
      await this.ensureWebSocketConnected();

      const result = await this.httpClient.post<StopSkillResult>(
        `/api/skill/sessions/${params.welinkSessionId}/abort`
      );
      this.sessionStateManager.forceStatus(params.welinkSessionId, SessionStatus.STOPPED);
      return result;
    } catch (error) {
      throw this.normalizeError('stopSkill', error);
    }
  }

  // 4. onSessionStatusChange
  onSessionStatusChange(params: OnSessionStatusChangeParams): void {
    Validator.requireObject(params, 'params');
    Validator.requireString(params.welinkSessionId, 'welinkSessionId');
    Validator.requireFunction(params.callback, 'callback');
    this.sessionStateManager.register(params);
  }

  // 5. onSkillWecodeStatusChange
  onSkillWecodeStatusChange(params: OnSkillWecodeStatusChangeParams): void {
    Validator.requireObject(params, 'params');
    Validator.requireFunction(params.callback, 'callback');
    this.weCodeStateManager.register(params);
  }

  // 6. regenerateAnswer
  async regenerateAnswer(params: RegenerateAnswerParams): Promise<SendMessageResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.welinkSessionId, 'welinkSessionId');
      await this.ensureWebSocketConnected();

      const history = await this.fetchServerMessages(params.welinkSessionId, 0, 200);
      const content = this.findLatestUserMessageContent(history.content);

      if (content === null || content.trim() === '') {
        throw new SkillSdkException(4002, 'No user message available for regenerate');
      }

      return await this.sendMessage({
        welinkSessionId: params.welinkSessionId,
        content
      });
    } catch (error) {
      throw this.normalizeError('regenerateAnswer', error);
    }
  }

  // 7. sendMessageToIM
  async sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.welinkSessionId, 'welinkSessionId');
      if (params.messageId !== undefined) {
        if (typeof params.messageId !== 'string') {
          throw new SkillSdkException(1000, 'messageId must be a string');
        }
      }
      if (params.chatId !== undefined) {
        if (typeof params.chatId !== 'string') {
          throw new SkillSdkException(1000, 'chatId must be a string');
        }
      }
      const messageId = this.normalizeOptionalString(params.messageId);
      const chatId = this.normalizeOptionalString(params.chatId);
      await this.ensureWebSocketConnected();
      const history = await this.fetchServerMessages(params.welinkSessionId, 0, 100);
      const resolvedContent = this.resolveSendToImContent(history.content, messageId);
      if (resolvedContent === null) {
        if (messageId !== undefined) {
          const exists = this.containsMessageId(history.content, messageId);
          if (!exists) {
            throw new SkillSdkException(4003, 'Message not found in server messages');
          }
        }
        throw new SkillSdkException(4005, 'No completed message found in server messages');
      }

      const payload: Record<string, Object> = { content: resolvedContent };
      if (chatId !== undefined) {
        payload.chatId = chatId;
      }

      await this.ensureWebSocketConnected();

      let raw: Record<string, Object>;
      try {
        raw = await this.httpClient.post<Record<string, Object>>(
          `/api/skill/sessions/${params.welinkSessionId}/send-to-im`,
          payload,
          { expectEnvelope: false }
        );
      } catch (error) {
        const normalized = this.normalizeError('sendMessageToIM', error);
        if (normalized.errorCode === 7000 && normalized.errorMessage.includes('404')) {
          throw new SkillSdkException(7002, 'send-to-im API is not implemented on server');
        }
        throw normalized;
      }

      return this.normalizeSendToImResult(raw);
    } catch (error) {
      throw this.normalizeError('sendMessageToIM', error);
    }
  }

  // 8. getSessionMessage
  async getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<SessionMessage>> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.welinkSessionId, 'welinkSessionId');
      Validator.optionalNonNegativeInteger(params.page, 'page');
      Validator.optionalPositiveInteger(params.size, 'size');
      if (params.isFirst !== undefined && typeof params.isFirst !== 'boolean') {
        throw new SkillSdkException(1000, 'isFirst must be a boolean');
      }
      await this.ensureWebSocketConnected();

      const page = params.page ?? 0;
      const size = params.size ?? 50;
      const history = await this.fetchServerMessages(params.welinkSessionId, page, size);
      return history;
    } catch (error) {
      throw this.normalizeError('getSessionMessage', error);
    }
  }

  // 8.1 getSessionMessageHistory
  async getSessionMessageHistory(params: GetSessionMessageHistoryParams): Promise<CursorResult<SessionMessage>> {
    try {
      Validator.requireObject(params, 'params');
      const welinkSessionId = TypeConverter.toRequiredString(params.welinkSessionId, 'welinkSessionId');
      const beforeSeq = TypeConverter.toOptionalInteger(params.beforeSeq, 'beforeSeq');
      if (beforeSeq !== undefined && beforeSeq < 0) {
        throw new SkillSdkException(1000, 'beforeSeq must be greater than or equal to 0');
      }
      const size = TypeConverter.toPositiveInt(params.size, 50, 'size');
      await this.ensureWebSocketConnected();

      return await this.fetchServerMessageHistory(welinkSessionId, beforeSeq, size);
    } catch (error) {
      throw this.normalizeError('getSessionMessageHistory', error);
    }
  }

  // 9. registerSessionListener
  registerSessionListener(params: RegisterSessionListenerParams): RegisterSessionListenerResult {
    Validator.requireObject(params, 'params');
    Validator.requireString(params.welinkSessionId, 'welinkSessionId');
    Validator.requireFunction(params.onMessage, 'onMessage');
    Validator.optionalFunction(params.onError, 'onError');
    Validator.optionalFunction(params.onClose, 'onClose');

    this.wsManager.registerSessionListener(params.welinkSessionId, {
      onMessage: params.onMessage,
      onError: params.onError,
      onClose: params.onClose
    });
    return { status: 'success' };
  }

  // 10. unregisterSessionListener
  unregisterSessionListener(params: UnregisterSessionListenerParams): UnregisterSessionListenerResult {
    Validator.requireObject(params, 'params');
    Validator.requireString(params.welinkSessionId, 'welinkSessionId');
    this.wsManager.unregisterSessionListener(params.welinkSessionId);
    return { status: 'success' };
  }

  // 11. sendMessage
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.welinkSessionId, 'welinkSessionId');
      Validator.requireString(params.content, 'content');
      if (params.toolCallId !== undefined) {
        Validator.requireString(params.toolCallId, 'toolCallId');
      }

      if (!this.wsManager.isConnected()) {
        await this.wsManager.connect();
      }
      this.sessionStateManager.markSendMessageTriggered(params.welinkSessionId);

      const payload: Record<string, Object> = {
        content: params.content
      };
      if (params.toolCallId !== undefined) {
        payload.toolCallId = params.toolCallId;
      }

      const result = await this.httpClient.post<SendMessageResult>(
        `/api/skill/sessions/${params.welinkSessionId}/messages`,
        payload
      );

      return result;
    } catch (error) {
      if (typeof params.welinkSessionId === 'string' && params.welinkSessionId.trim() !== '') {
        this.sessionStateManager.clearSendMessageTrigger(params.welinkSessionId);
      }
      throw this.normalizeError('sendMessage', error);
    }
  }

  // 12. replyPermission
  async replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireString(params.welinkSessionId, 'welinkSessionId');
      Validator.requireString(params.permId, 'permId');
      Validator.requireEnum(params.response, ['once', 'always', 'reject'], 'response');
      await this.ensureWebSocketConnected();

      return await this.httpClient.post<ReplyPermissionResult>(
        `/api/skill/sessions/${params.welinkSessionId}/permissions/${params.permId}`,
        {
          response: params.response
        }
      );
    } catch (error) {
      throw this.normalizeError('replyPermission', error);
    }
  }

  // 13. controlSkillWeCode
  async controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireEnum(
        params.action,
        [SkillWeCodeAction.CLOSE, SkillWeCodeAction.MINIMIZE],
        'action'
      );

      if (params.action === SkillWeCodeAction.CLOSE) {
        this.weCodeStateManager.notify(SkillWecodeStatus.CLOSED, 'miniapp closed');
      } else {
        this.weCodeStateManager.notify(SkillWecodeStatus.MINIMIZED, 'miniapp minimized');
      }

      return { status: 'success' };
    } catch (error) {
      throw this.normalizeError('controlSkillWeCode', error);
    }
  }

  // 14. createNewSession
  async createNewSession(params: CreateNewSessionParams): Promise<SkillSession> {
    try {
      Validator.requireObject(params, 'params');
      const ak = TypeConverter.toRequiredString(params.ak, 'ak');
      const bussinessDomain = TypeConverter.toRequiredString(params.bussinessDomain, 'bussinessDomain');
      const bussinessType = TypeConverter.toRequiredString(params.bussinessType, 'bussinessType');
      const bussinessId = TypeConverter.toRequiredString(params.bussinessId, 'bussinessId');
      const assistantAccount = TypeConverter.toRequiredString(params.assistantAccount, 'assistantAccount');
      const title = TypeConverter.toOptionalString(params.title, 'title');

      await this.ensureWebSocketConnected();

      const payload: Record<string, Object> = {
        ak,
        bussinessDomain,
        bussinessType,
        bussinessId,
        assistantAccount
      };
      if (title !== undefined) {
        payload.title = title;
      }

      return await this.httpClient.post<SkillSession>('/api/skill/sessions', payload);
    } catch (error) {
      throw this.normalizeError('createNewSession', error);
    }
  }

  // 15. getHistorySessionsList
  async getHistorySessionsList(params: HistorySessionsParams): Promise<PageResult<SkillSession>> {
    try {
      Validator.requireObject(params, 'params');
      const page = TypeConverter.toNonNegativeInt(params.page, 0, 'page');
      const size = TypeConverter.toPositiveInt(params.size, 50, 'size');

      let status: string | undefined;
      if (params.status !== undefined) {
        status = TypeConverter.toOptionalString(params.status, 'status');
        if (status !== undefined) {
          status = status.toUpperCase();
          Validator.requireEnum(status, ['ACTIVE', 'IDLE', 'CLOSED'], 'status');
        }
      }

      const ak = TypeConverter.toOptionalString(params.ak, 'ak');
      const bussinessId = TypeConverter.toOptionalString(params.bussinessId, 'bussinessId');
      const assistantAccount = TypeConverter.toOptionalString(params.assistantAccount, 'assistantAccount');
      let businessSessionDomain = TypeConverter.toOptionalString(
        params.businessSessionDomain,
        'businessSessionDomain'
      );
      if (businessSessionDomain !== undefined) {
        businessSessionDomain = businessSessionDomain.toLowerCase();
        Validator.requireEnum(businessSessionDomain, ['miniapp', 'im'], 'businessSessionDomain');
      }

      await this.ensureWebSocketConnected();

      const query: Record<string, string | number> = {
        page,
        size
      };
      if (status !== undefined) {
        query.status = status;
      }
      if (ak !== undefined) {
        query.ak = ak;
      }
      if (bussinessId !== undefined) {
        query.bussinessId = bussinessId;
      }
      if (assistantAccount !== undefined) {
        query.assistantAccount = assistantAccount;
      }
      if (businessSessionDomain !== undefined) {
        query.businessSessionDomain = businessSessionDomain;
      }

      return await this.fetchServerSessions(query, page, size);
    } catch (error) {
      throw this.normalizeError('getHistorySessionsList', error);
    }
  }

  // 16. createDigitalTwin
  async createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult> {
    try {
      Validator.requireObject(params, 'params');
      const name = TypeConverter.toRequiredString(params.name, 'name');
      const icon = TypeConverter.toRequiredString(params.icon, 'icon');
      const description = TypeConverter.toRequiredString(params.description, 'description');
      const weCrewType = TypeConverter.toOptionalInteger(params.weCrewType, 'weCrewType');
      if (weCrewType !== undefined && weCrewType !== 0 && weCrewType !== 1) {
        throw new SkillSdkException(1000, 'weCrewType must be 0 or 1');
      }
      const bizRobotId = TypeConverter.toOptionalString(params.bizRobotId, 'bizRobotId');
      const qrcode = TypeConverter.toOptionalString(params.qrcode, 'qrcode');

      const payload: Record<string, Object> = {
        name,
        icon,
        description
      };
      if (weCrewType !== undefined) {
        payload.weCrewType = weCrewType;
      }
      if (bizRobotId !== undefined) {
        payload.bizRobotId = bizRobotId;
      }
      if (qrcode !== undefined) {
        payload.qrcode = qrcode;
      }

      const result = await this.httpClient.post<Record<string, Object>>(
        '/v4-1/we-crew/im-register',
        payload,
        { useAssistantBaseUrl: true }
      );
      return this.normalizeCreateDigitalTwinResult(result);
    } catch (error) {
      throw this.normalizeError('createDigitalTwin', error);
    }
  }

  // 17. getAgentType
  async getAgentType(): Promise<AgentTypeList> {
    try {
      const payload = await this.httpClient.get<Object>(
        '/v4-1/we-crew/inner-assistant/list',
        undefined,
        { useAssistantBaseUrl: true }
      );
      return {
        content: this.parseAgentTypeList(payload)
      };
    } catch (error) {
      throw this.normalizeError('getAgentType', error);
    }
  }

  // 18. getWeAgentList
  async getWeAgentList(params: PageParams): Promise<WeAgentList> {
    try {
      Validator.requireObject(params, 'params');
      const rawPageSize = TypeConverter.requireInteger(params.pageSize, 'pageSize');
      const rawPageNumber = TypeConverter.requireInteger(params.pageNumber, 'pageNumber');
      if (rawPageSize <= 0 || rawPageNumber <= 0) {
        throw new SkillSdkException(1000, 'pageSize and pageNumber must be positive integers');
      }
      const pageSize = this.clamp(rawPageSize, 1, 100);
      const pageNumber = this.clamp(rawPageNumber, 1, 1000);

      const payload = await this.httpClient.get<Object>(
        '/v4-1/we-crew/list',
        { pageSize, pageNumber },
        { useAssistantBaseUrl: true }
      );
      const list = this.parseWeAgentList(payload);
      this.weAgentStore.saveList(list);
      return {
        content: list
      };
    } catch (error) {
      throw this.normalizeError('getWeAgentList', error);
    }
  }

  // 19. getWeAgentDetails
  async getWeAgentDetails(params: QueryWeAgentParams): Promise<WeAgentDetailsArray> {
    try {
      Validator.requireObject(params, 'params');
      const partnerAccount = TypeConverter.toRequiredString(params.partnerAccount, 'partnerAccount');
      return await this.fetchAndCacheWeAgentDetails(partnerAccount);
    } catch (error) {
      throw this.normalizeError('getWeAgentDetails', error);
    }
  }

  // 19.1. getAssistantDetails
  async getAssistantDetails(params: QueryWeAgentParams): Promise<WeAgentDetailsArray> {
    try {
      Validator.requireObject(params, 'params');
      const partnerAccount = TypeConverter.toRequiredString(params.partnerAccount, 'partnerAccount');
      const cached = this.weAgentStore.loadDetailsByPartnerAccount(partnerAccount);
      if (cached !== null) {
        const cachedResult = this.wrapWeAgentDetail(cached);
        void this.refreshAssistantDetailsCache(partnerAccount);
        return cachedResult;
      }
      return await this.fetchAndCacheWeAgentDetails(partnerAccount, false);
    } catch (error) {
      throw this.normalizeError('getAssistantDetails', error);
    }
  }

  // 20. getWeAgentUri
  getWeAgentUri(): WeAgentUriResult {
    try {
      return this.buildWeAgentUriResult(this.weAgentStore.loadCurrentDetail());
    } catch (error) {
      throw this.normalizeError('getWeAgentUri', error);
    }
  }

  // 21. updateWeAgent
  async updateWeAgent(params: UpdateWeAgentParams): Promise<UpdateWeAgentResult> {
    try {
      Validator.requireObject(params, 'params');
      const partnerAccount = this.normalizeOptionalString(params.partnerAccount);
      const robotId = this.normalizeOptionalString(params.robotId);
      this.resolveAssistantIdentityKey(partnerAccount, robotId);
      const name = TypeConverter.toRequiredString(params.name, 'name');
      const icon = TypeConverter.toRequiredString(params.icon, 'icon');
      const description = TypeConverter.toRequiredString(params.description, 'description');

      const payload: Record<string, Object> = {
        name,
        icon,
        description
      };
      if (partnerAccount !== undefined) {
        payload.partnerAccount = partnerAccount;
      }
      if (robotId !== undefined) {
        payload.robotId = robotId;
      }

      const result = await this.httpClient.put<Record<string, Object>>(
        '/v4-1/we-crew',
        payload,
        { expectEnvelope: false, useAssistantBaseUrl: true }
      );
      const updateResult = this.resolveSuccessResult(result, 'updateWeAgent');
      this.weAgentStore.updateCachedDetails(partnerAccount, robotId, name, icon, description);
      return {
        updateResult
      };
    } catch (error) {
      throw this.normalizeError('updateWeAgent', error);
    }
  }

  // 22. deleteWeAgent
  async deleteWeAgent(params: DeleteWeAgentParams): Promise<DeleteWeAgentResult> {
    try {
      Validator.requireObject(params, 'params');
      const partnerAccount = this.normalizeOptionalString(params.partnerAccount);
      const robotId = this.normalizeOptionalString(params.robotId);
      this.resolveAssistantIdentityKey(partnerAccount, robotId);

      const context = await this.prepareDeleteWeAgentContext(
        this.buildDeleteWeAgentContext(partnerAccount, robotId)
      );
      const deleteResult = await this.requestDeleteWeAgent(context);
      await this.handleDeleteWeAgentResult(context, deleteResult);
      return { deleteResult };
    } catch (error) {
      throw this.normalizeError('deleteWeAgent', error);
    }
  }

  // 23. openAssistantEditPage
  async openAssistantEditPage(params: OpenAssistantEditPageParams): Promise<OpenAssistantEditPageResult> {
    try {
      Validator.requireObject(params, 'params');
      Validator.requireFunction(params.onUpdated, 'onUpdated');
      const partnerAccount = this.normalizeOptionalString(params.partnerAccount);
      const robotId = this.normalizeOptionalString(params.robotId);
      const identityKey = this.resolveAssistantIdentityKey(partnerAccount, robotId);
      const context = this.config.context;
      if (context === undefined) {
        throw new SkillSdkException(5000, 'context is required');
      }

      this.assistantDetailUpdatedCallbacks.set(identityKey, params.onUpdated);
      await context.startAbility({
        uri: this.buildAssistantEditPageUri(partnerAccount, robotId)
      });
      return {
        status: 'success'
      };
    } catch (error) {
      throw this.normalizeError('openAssistantEditPage', error);
    }
  }

  // 24. notifyAssistantDetailUpdated
  async notifyAssistantDetailUpdated(
    params: NotifyAssistantDetailUpdatedParams
  ): Promise<NotifyAssistantDetailUpdatedResult> {
    try {
      Validator.requireObject(params, 'params');
      const name = TypeConverter.toRequiredString(params.name, 'name');
      const icon = TypeConverter.toRequiredString(params.icon, 'icon');
      const description = TypeConverter.toRequiredString(params.description, 'description');
      const partnerAccount = this.normalizeOptionalString(params.partnerAccount);
      const robotId = this.normalizeOptionalString(params.robotId);
      const identityKey = this.resolveAssistantIdentityKey(partnerAccount, robotId);

      const callback = this.assistantDetailUpdatedCallbacks.get(identityKey);
      if (callback !== undefined) {
        callback({
          name,
          icon,
          description
        });
      }
      return {
        status: 'success'
      };
    } catch (error) {
      throw this.normalizeError('notifyAssistantDetailUpdated', error);
    }
  }

  // 25. queryQrcodeInfo
  async queryQrcodeInfo(params: QueryQrcodeInfoParams): Promise<QrcodeInfo> {
    try {
      Validator.requireObject(params, 'params');
      const qrcode = TypeConverter.toRequiredString(params.qrcode, 'qrcode');
      return await this.httpClient.get<QrcodeInfo>(
        `/v4-1/we-crew/im-register/qrcode/${qrcode}`,
        undefined,
        { useAssistantBaseUrl: true }
      );
    } catch (error) {
      throw this.normalizeError('queryQrcodeInfo', error);
    }
  }

  // 26. updateQrcodeInfo
  async updateQrcodeInfo(params: UpdateQrcodeInfoParams): Promise<UpdateQrcodeInfoResult> {
    try {
      Validator.requireObject(params, 'params');
      const qrcode = TypeConverter.toRequiredString(params.qrcode, 'qrcode');
      const status = TypeConverter.requireInteger(params.status, 'status');
      const robotId = this.normalizeOptionalString(params.robotId);
      const payload: Record<string, Object> = {
        qrcode,
        status
      };
      if (robotId !== undefined) {
        payload.robotId = robotId;
      }

      const result = await this.httpClient.put<Record<string, Object>>(
        '/v4-1/we-crew/im-register/qrcode',
        payload,
        { expectEnvelope: false, useAssistantBaseUrl: true }
      );
      return this.resolveUpdateQrcodeInfoResult(result);
    } catch (error) {
      throw this.normalizeError('updateQrcodeInfo', error);
    }
  }

  private async fetchServerMessages(
    welinkSessionId: string,
    page: number,
    size: number
  ): Promise<PageResult<SessionMessage>> {
    const result = await this.httpClient.get<Record<string, Object>>(
      `/api/skill/sessions/${welinkSessionId}/messages`,
      { page, size }
    );
    const content = Array.isArray(result.content) ? (result.content as SessionMessage[]) : [];
    const resolvedPage = Number(result.page ?? result.number ?? page);
    const resolvedSize = Number(result.size ?? size);
    const resolvedTotal = Number(result.total ?? result.totalElements ?? content.length);
    const resolvedTotalPages = Number(result.totalPages);

    return {
      content,
      page: Number.isFinite(resolvedPage) ? resolvedPage : page,
      size: Number.isFinite(resolvedSize) && resolvedSize > 0 ? resolvedSize : size,
      total: Number.isFinite(resolvedTotal) && resolvedTotal >= 0 ? resolvedTotal : content.length,
      totalPages: Number.isFinite(resolvedTotalPages) && resolvedTotalPages >= 0
        ? resolvedTotalPages
        : 0
    };
  }

  private async fetchAndCacheWeAgentDetails(
    partnerAccount: string,
    updateCurrentDetail: boolean = true
  ): Promise<WeAgentDetailsArray> {
    const payload = await this.httpClient.get<Object>(
      `/v1/robot-partners/${partnerAccount}`,
      undefined,
      { useAssistantBaseUrl: true }
    );
    const result = {
      weAgentDetailsArray: this.parseWeAgentDetailsList(payload)
    };
    this.cacheWeAgentDetailsResult(partnerAccount, result, updateCurrentDetail);
    return result;
  }

  private cacheWeAgentDetailsResult(
    partnerAccount: string,
    result: WeAgentDetailsArray,
    updateCurrentDetail: boolean = true
  ): void {
    if (result.weAgentDetailsArray.length === 0) {
      return;
    }
    const detail = result.weAgentDetailsArray[0];
    this.weAgentStore.saveDetailsByPartnerAccount(partnerAccount, detail);
    if (updateCurrentDetail) {
      this.weAgentStore.saveCurrentDetail(detail);
    }
  }

  private async refreshAssistantDetailsCache(partnerAccount: string): Promise<void> {
    try {
      await this.fetchAndCacheWeAgentDetails(partnerAccount, false);
    } catch (error) {
      this.logger.warn('getAssistantDetails background refresh failed');
    }
  }

  private wrapWeAgentDetail(detail: WeAgentDetails): WeAgentDetailsArray {
    return {
      weAgentDetailsArray: [detail]
    };
  }

  private async prepareDeleteWeAgentTransition(
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): Promise<DeleteTransitionPlan> {
    let list = this.weAgentStore.loadList();
    if (list.length === 0) {
      const listResult = await this.getWeAgentList({
        pageSize: SkillSDK.DEFAULT_WE_AGENT_LIST_PAGE_SIZE,
        pageNumber: SkillSDK.DEFAULT_WE_AGENT_LIST_PAGE_NUMBER
      });
      list = listResult.content;
    }
    return this.buildDeleteTransitionPlan(list, partnerAccount, robotId);
  }

  private buildDeleteTransitionPlan(
    snapshot: WeAgent[],
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): DeleteTransitionPlan {
    const updatedList = [ ...snapshot ];
    const deletedIndex = this.findWeAgentIndex(updatedList, partnerAccount, robotId);
    if (deletedIndex < 0) {
      return { updatedList };
    }

    updatedList.splice(deletedIndex, 1);
    if (updatedList.length === 0) {
      return { updatedList };
    }

    const nextIndex = deletedIndex < updatedList.length ? deletedIndex : 0;
    const nextPartnerAccount = this.normalizeOptionalString(updatedList[nextIndex].partnerAccount);
    return { updatedList, nextPartnerAccount };
  }

  private findWeAgentIndex(
    list: WeAgent[],
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): number {
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index];
      if (partnerAccount !== undefined && this.normalizeOptionalString(item.partnerAccount) === partnerAccount) {
        return index;
      }
      if (partnerAccount === undefined && robotId !== undefined
        && this.normalizeOptionalString(item.robotId) === robotId) {
        return index;
      }
    }
    return -1;
  }

  private async resolveDeleteNextDetail(partnerAccount: string): Promise<WeAgentDetails | null> {
    const cachedDetail = this.weAgentStore.loadDetailsByPartnerAccount(partnerAccount);
    if (cachedDetail !== null) {
      return cachedDetail;
    }
    const result = await this.fetchAndCacheWeAgentDetails(partnerAccount, false);
    return result.weAgentDetailsArray.length > 0 ? result.weAgentDetailsArray[0] : null;
  }

  private buildDeleteWeAgentContext(
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): DeleteWeAgentContext {
    return {
      partnerAccount,
      robotId,
      deletingCurrentWeAgent: this.isCurrentWeAgent(partnerAccount, robotId),
      hasListCache: this.weAgentStore.hasListCache()
    };
  }

  private async requestDeleteWeAgent(context: DeleteWeAgentContext): Promise<string> {
    const query = this.resolveAssistantIdentityQuery(context.partnerAccount, context.robotId);
    const result = await this.httpClient.delete<Record<string, Object>>(
      '/v4-1/we-crew',
      query,
      { expectEnvelope: false, useAssistantBaseUrl: true }
    );
    return this.resolveSuccessResult(result, 'deleteWeAgent');
  }

  private async prepareDeleteWeAgentContext(context: DeleteWeAgentContext): Promise<DeleteWeAgentContext> {
    if (!context.deletingCurrentWeAgent) {
      return context;
    }
    return {
      ...context,
      transitionPlan: await this.prepareDeleteWeAgentTransition(context.partnerAccount, context.robotId)
    };
  }

  private async handleDeleteWeAgentResult(
    context: DeleteWeAgentContext,
    deleteResult: string
  ): Promise<void> {
    if (!context.deletingCurrentWeAgent) {
      this.handleDeleteNonCurrentWeAgentSuccess(context);
      return;
    }
    await this.handleDeleteCurrentWeAgentSuccess(context, deleteResult);
  }

  private async handleDeleteCurrentWeAgentSuccess(
    context: DeleteWeAgentContext,
    deleteResult: string
  ): Promise<void> {
    const deletePlan = context.transitionPlan ?? { updatedList: [] };
    this.weAgentStore.saveList(deletePlan.updatedList);

    let nextUris: WeAgentUriResult;
    if (deletePlan.nextPartnerAccount === undefined) {
      this.weAgentStore.clearCurrentDetail();
      nextUris = this.buildWeAgentUriResult(null);
    } else {
      const nextDetail = await this.resolveDeleteNextDetail(deletePlan.nextPartnerAccount);
      if (nextDetail === null) {
        this.weAgentStore.clearCurrentDetail();
        nextUris = this.buildWeAgentUriResult(null);
      } else {
        this.weAgentStore.saveCurrentDetail(nextDetail);
        nextUris = this.buildWeAgentUriResult(nextDetail);
      }
    }
    void deleteResult;
    void nextUris;
    // TODO: call openWeAgentCUI with nextUris.weAgentUri, nextUris.assistantDetailUri and nextUris.switchAssistantUri.
  }

  private handleDeleteNonCurrentWeAgentSuccess(context: DeleteWeAgentContext): void {
    if (!context.hasListCache) {
      return;
    }
    const cachedList = this.weAgentStore.loadList();
    const deletePlan = this.buildDeleteTransitionPlan(cachedList, context.partnerAccount, context.robotId);
    this.weAgentStore.saveList(deletePlan.updatedList);
  }

  private isCurrentWeAgent(
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): boolean {
    return this.matchesWeAgentDetail(this.weAgentStore.loadCurrentDetail(), partnerAccount, robotId);
  }

  private matchesWeAgentDetail(
    detail: WeAgentDetails | null,
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): boolean {
    if (detail === null) {
      return false;
    }
    if (partnerAccount !== undefined) {
      return this.normalizeOptionalString(detail.partnerAccount) === partnerAccount;
    }
    return robotId !== undefined && this.normalizeOptionalString(detail.id) === robotId;
  }

  private buildWeAgentUriResult(details: WeAgentDetails | null): WeAgentUriResult {
    if (details === null) {
      const weAgentUri = this.appendHashFragment(
        this.appendQueryParam(SkillSDK.ASSISTANT_H5_URI, 'wecodePlace', 'weAgent'),
        'activateAssistant'
      );
      return {
        weAgentUri,
        assistantDetailUri: '',
        switchAssistantUri: ''
      };
    }

    const partnerAccount = details.partnerAccount ?? '';
    const weCodeUrl = details.weCodeUrl ?? '';
    const detailId = details.id ?? '';
    const weCodeUrlHost = this.extractUriHost(weCodeUrl);

    const baseWeAgentUri = this.appendQueryParam(weCodeUrl, 'wecodePlace', 'weAgent');
    let weAgentUri = '';
    if (weCodeUrlHost.toUpperCase() === SkillSDK.WE_AGENT_CUI_APPID) {
      weAgentUri = this.appendQueryParam(baseWeAgentUri, 'assistantAccount', partnerAccount);
    } else {
      weAgentUri = this.appendQueryParam(baseWeAgentUri, 'robotId', detailId);
    }

    const assistantDetailUri = this.appendHashFragment(
      this.appendQueryParam(SkillSDK.ASSISTANT_H5_URI, 'partnerAccount', partnerAccount),
      'assistantDetail'
    );
    const switchAssistantUri = this.appendHashFragment(
      this.appendQueryParam(SkillSDK.ASSISTANT_H5_URI, 'partnerAccount', partnerAccount),
      'switchAssistant'
    );

    return {
      weAgentUri,
      assistantDetailUri,
      switchAssistantUri
    };
  }

  private async fetchServerMessageHistory(
    welinkSessionId: string,
    beforeSeq: number | undefined,
    size: number
  ): Promise<CursorResult<SessionMessage>> {
    const query: Record<string, string | number> = { size };
    if (beforeSeq !== undefined) {
      query.beforeSeq = beforeSeq;
    }
    const result = await this.httpClient.get<Record<string, Object>>(
      `/api/skill/sessions/${welinkSessionId}/messages/history`,
      query
    );
    const content = Array.isArray(result.content) ? (result.content as SessionMessage[]) : [];
    const resolvedSize = Number(result.size ?? size);
    const hasMore = this.resolveBooleanValue(result.hasMore, false);
    const nextBeforeSeq = this.resolveOptionalNumberValue(result.nextBeforeSeq);

    return {
      content,
      size: Number.isFinite(resolvedSize) && resolvedSize > 0 ? resolvedSize : size,
      hasMore,
      nextBeforeSeq
    };
  }

  private async fetchServerSessions(
    query: Record<string, string | number>,
    page: number,
    size: number
  ): Promise<PageResult<SkillSession>> {
    const result = await this.httpClient.get<Record<string, Object>>('/api/skill/sessions', query);
    const content = Array.isArray(result.content) ? (result.content as SkillSession[]) : [];
    const resolvedPage = Number(result.page ?? result.number ?? page);
    const resolvedSize = Number(result.size ?? size);
    const resolvedTotal = Number(result.total ?? result.totalElements ?? content.length);
    const resolvedTotalPages = Number(result.totalPages);

    return {
      content,
      page: Number.isFinite(resolvedPage) ? resolvedPage : page,
      size: Number.isFinite(resolvedSize) && resolvedSize > 0 ? resolvedSize : size,
      total: Number.isFinite(resolvedTotal) && resolvedTotal >= 0 ? resolvedTotal : content.length,
      totalPages: Number.isFinite(resolvedTotalPages) && resolvedTotalPages >= 0
        ? resolvedTotalPages
        : 0
    };
  }

  private normalizeCreateDigitalTwinResult(result: Record<string, Object>): CreateDigitalTwinResult {
    const robotId = TypeConverter.toOptionalString(result.robotId, 'robotId') ?? '';
    const partnerAccount = TypeConverter.toOptionalString(result.partnerAccount, 'partnerAccount') ?? '';
    const messageRaw = TypeConverter.toOptionalString(result.message, 'message')
      ?? TypeConverter.toOptionalString(result.status, 'status');
    const message = messageRaw === undefined ? 'success' : messageRaw;
    return {
      robotId,
      partnerAccount,
      message
    };
  }

  private resolveBooleanValue(value: Object | undefined, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }
    return fallback;
  }

  private resolveOptionalNumberValue(value: Object | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private parseAgentTypeList(payload: Object): AgentType[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    const result: AgentType[] = [];
    for (const item of payload) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const row = item as Record<string, Object>;
      result.push({
        name: TypeConverter.toOptionalString(row.name, 'name') ?? '',
        icon: TypeConverter.toOptionalString(row.icon, 'icon') ?? '',
        bizRobotId: TypeConverter.toOptionalString(row.bizRobotId, 'bizRobotId') ?? ''
      });
    }
    return result;
  }

  private parseWeAgentList(payload: Object): WeAgent[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    const result: WeAgent[] = [];
    for (const item of payload) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const row = item as Record<string, Object>;
      result.push({
        name: TypeConverter.toOptionalString(row.name, 'name') ?? '',
        icon: TypeConverter.toOptionalString(row.icon, 'icon') ?? '',
        description: TypeConverter.toOptionalString(row.description, 'description')
          ?? TypeConverter.toOptionalString(row.desc, 'desc')
          ?? '',
        partnerAccount: TypeConverter.toOptionalString(row.partnerAccount, 'partnerAccount') ?? '',
        bizRobotName: TypeConverter.toOptionalString(row.bizRobotName, 'bizRobotName') ?? '',
        bizRobotNameEn: TypeConverter.toOptionalString(row.bizRobotNameEn, 'bizRobotNameEn') ?? '',
        robotId: TypeConverter.toOptionalString(row.robotId, 'robotId') ?? ''
      });
    }
    return result;
  }

  private parseWeAgentDetailsList(payload: Object): WeAgentDetails[] {
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      return [this.normalizeWeAgentDetails(payload as Record<string, Object>)];
    }
    if (!Array.isArray(payload)) {
      return [];
    }
    const result: WeAgentDetails[] = [];
    for (const item of payload) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      result.push(this.normalizeWeAgentDetails(item as Record<string, Object>));
    }
    return result;
  }

  private normalizeWeAgentDetails(payload: Record<string, Object>): WeAgentDetails {
    return {
      name: TypeConverter.toOptionalString(payload.name, 'name') ?? '',
      icon: TypeConverter.toOptionalString(payload.icon, 'icon') ?? '',
      desc: TypeConverter.toOptionalString(payload.desc, 'desc')
        ?? TypeConverter.toOptionalString(payload.description, 'description')
        ?? '',
      moduleId: TypeConverter.toOptionalString(payload.moduleId, 'moduleId') ?? '',
      appKey: TypeConverter.toOptionalString(payload.appKey, 'appKey') ?? '',
      appSecret: TypeConverter.toOptionalString(payload.appSecret, 'appSecret') ?? '',
      partnerAccount: TypeConverter.toOptionalString(payload.partnerAccount, 'partnerAccount') ?? '',
      createdBy: TypeConverter.toOptionalString(payload.createdBy, 'createdBy') ?? '',
      creatorWorkId: TypeConverter.toOptionalString(payload.creatorWorkId, 'creatorWorkId') ?? '',
      creatorW3Account: TypeConverter.toOptionalString(payload.creatorW3Account, 'creatorW3Account') ?? '',
      creatorName: TypeConverter.toOptionalString(payload.creatorName, 'creatorName') ?? '',
      creatorNameEn: TypeConverter.toOptionalString(payload.creatorNameEn, 'creatorNameEn') ?? '',
      ownerWelinkId: TypeConverter.toOptionalString(payload.ownerWelinkId, 'ownerWelinkId') ?? '',
      ownerW3Account: TypeConverter.toOptionalString(payload.ownerW3Account, 'ownerW3Account') ?? '',
      ownerName: TypeConverter.toOptionalString(payload.ownerName, 'ownerName') ?? '',
      ownerNameEn: TypeConverter.toOptionalString(payload.ownerNameEn, 'ownerNameEn') ?? '',
      ownerDeptName: TypeConverter.toOptionalString(payload.ownerDeptName, 'ownerDeptName') ?? '',
      ownerDeptNameEn: TypeConverter.toOptionalString(payload.ownerDeptNameEn, 'ownerDeptNameEn') ?? '',
      id: TypeConverter.toOptionalString(payload.id, 'id') ?? '',
      bizRobotName: TypeConverter.toOptionalString(payload.bizRobotName, 'bizRobotName') ?? '',
      bizRobotNameEn: TypeConverter.toOptionalString(payload.bizRobotNameEn, 'bizRobotNameEn') ?? '',
      bizRobotTag: TypeConverter.toOptionalString(payload.bizRobotTag, 'bizRobotTag') ?? '',
      bizRobotId: TypeConverter.toOptionalString(payload.bizRobotId, 'bizRobotId') ?? '',
      weCodeUrl: TypeConverter.toOptionalString(payload.weCodeUrl, 'weCodeUrl') ?? ''
    };
  }

  private resolveSuccessResult(result: Record<string, Object>, method: string): string {
    const code = TypeConverter.toOptionalInteger(result.code, 'code');
    if (code === undefined) {
      throw new SkillSdkException(7000, `Unexpected ${method} response schema`);
    }
    if (code === 200) {
      return 'success';
    }
    const message = TypeConverter.toOptionalString(result.message, 'message') ?? `${method} failed`;
    throw new SkillSdkException(code, message);
  }

  private resolveUpdateQrcodeInfoResult(result: Record<string, Object>): UpdateQrcodeInfoResult {
    const code = TypeConverter.toOptionalString(result.code, 'code');
    if (code !== '200') {
      throw new SkillSdkException(7000, 'updateQrcodeInfo did not return code 200');
    }
    return {
      status: 'success'
    };
  }

  private resolveAssistantIdentityKey(partnerAccount?: string, robotId?: string): string {
    if (partnerAccount !== undefined) {
      return partnerAccount;
    }
    if (robotId !== undefined) {
      return robotId;
    }
    throw new SkillSdkException(1000, 'partnerAccount or robotId is required');
  }

  private resolveAssistantIdentityQuery(
    partnerAccount?: string,
    robotId?: string
  ): Record<string, string> {
    const query: Record<string, string> = {};
    if (partnerAccount !== undefined) {
      query.partnerAccount = partnerAccount;
    }
    if (robotId !== undefined) {
      query.robotId = robotId;
    }
    if (Object.keys(query).length > 0) {
      return query;
    }
    throw new SkillSdkException(1000, 'partnerAccount or robotId is required');
  }

  private buildAssistantEditPageUri(partnerAccount?: string, robotId?: string): string {
    const baseUri = this.appendHashFragment(SkillSDK.ASSISTANT_H5_URI, 'editAssistant');
    if (partnerAccount !== undefined) {
      return this.appendQueryParam(baseUri, 'partnerAccount', partnerAccount);
    }
    if (robotId !== undefined) {
      return this.appendQueryParam(baseUri, 'robotId', robotId);
    }
    throw new SkillSdkException(1000, 'partnerAccount or robotId is required');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  private appendQueryParam(baseUrl: string, key: string, value: string): string {
    const normalizedBase = TypeConverter.toOptionalString(baseUrl, 'baseUrl') ?? '';
    if (normalizedBase === '') {
      return '';
    }
    const hashIndex = normalizedBase.indexOf('#');
    const fragment = hashIndex >= 0 ? normalizedBase.slice(hashIndex + 1) : '';
    const baseWithoutHash = hashIndex >= 0 ? normalizedBase.slice(0, hashIndex) : normalizedBase;
    const connector = baseWithoutHash.includes('?')
      ? (baseWithoutHash.endsWith('?') || baseWithoutHash.endsWith('&') ? '' : '&')
      : '?';
    const encoded = encodeURIComponent(value ?? '');
    const result = `${baseWithoutHash}${connector}${encodeURIComponent(key)}=${encoded}`;
    if (fragment === '') {
      return result;
    }
    return `${result}#${fragment}`;
  }

  private appendHashFragment(baseUrl: string, hash: string): string {
    const normalizedBase = TypeConverter.toOptionalString(baseUrl, 'baseUrl') ?? '';
    if (normalizedBase === '') {
      return '';
    }
    const normalizedHash = TypeConverter.toOptionalString(hash, 'hash') ?? '';
    if (normalizedHash === '') {
      return normalizedBase;
    }
    const hashIndex = normalizedBase.indexOf('#');
    const baseWithoutHash = hashIndex >= 0 ? normalizedBase.slice(0, hashIndex) : normalizedBase;
    return `${baseWithoutHash}#${normalizedHash}`;
  }

  private extractUriHost(uri: string): string {
    const normalizedUri = TypeConverter.toOptionalString(uri, 'uri') ?? '';
    if (normalizedUri === '') {
      return '';
    }
    try {
      const parsed: uri.URI = new uri.URI(normalizedUri).normalize();
      return parsed.host ?? '';
    } catch {
      return '';
    }
  }

  private findLatestUserMessageContent(messages: SessionMessage[]): string | null {
    for (const message of messages) {
      if (message.role !== 'user') {
        continue;
      }
      const content = this.normalizeOptionalString(message.content ?? undefined);
      if (content !== undefined) {
        return content;
      }
    }
    return null;
  }

  private resolveSendToImContent(messages: SessionMessage[], messageId?: string): string | null {
    const normalizedMessageId = this.normalizeOptionalString(messageId);
    if (normalizedMessageId !== undefined) {
      for (const message of messages) {
        if (this.normalizeOptionalString(message.id) !== normalizedMessageId) {
          continue;
        }
        return this.normalizeOptionalString(message.content ?? undefined) ?? null;
      }
      return null;
    }

    for (const message of messages) {
      const content = this.normalizeOptionalString(message.content ?? undefined);
      if (content !== undefined) {
        return content;
      }
    }
    return null;
  }

  private containsMessageId(messages: SessionMessage[], messageId: string): boolean {
    const normalizedMessageId = this.normalizeOptionalString(messageId);
    if (normalizedMessageId === undefined) {
      return false;
    }
    return messages.some((message: SessionMessage) => this.normalizeOptionalString(message.id) === normalizedMessageId);
  }

  private normalizeSendToImResult(raw: Record<string, Object>): SendMessageToIMResult {
    if (typeof raw !== 'object' || raw === null) {
      throw new SkillSdkException(7000, 'Unexpected send-to-im response schema');
    }
    const payload = raw as Record<string, Object>;

    if ('success' in payload) {
      return { success: Boolean(payload.success) };
    }

    if ('status' in payload) {
      return { success: String(payload.status) === 'success' };
    }

    if ('data' in payload && typeof payload.data === 'object' && payload.data !== null) {
      const data = payload.data as Record<string, Object>;
      if ('success' in data) {
        return { success: Boolean(data.success) };
      }
      if ('status' in data) {
        return { success: String(data.status) === 'success' };
      }
    }

    return { success: false };
  }

  private pickLatestSession(sessions: SkillSession[]): SkillSession {
    const sorted = [...sessions].sort((a: SkillSession, b: SkillSession) => {
      const left = Number.isNaN(Date.parse(a.updatedAt)) ? 0 : Date.parse(a.updatedAt);
      const right = Number.isNaN(Date.parse(b.updatedAt)) ? 0 : Date.parse(b.updatedAt);
      return right - left;
    });
    return sorted[0];
  }

  private async ensureWebSocketConnected(): Promise<void> {
    if (!this.wsManager.isConnected()) {
      await this.wsManager.connect();
    }
  }

  private normalizeOptionalString(value?: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private validateConfig(config: SkillSDKConfig): void {
    Validator.requireObject(config, 'config');
    Validator.requireHttpUrl(config.baseUrl, 'baseUrl');
    if (config.assistantBaseUrl !== undefined) {
      Validator.requireHttpUrl(config.assistantBaseUrl, 'assistantBaseUrl');
    }
    if (config.wsUrl !== undefined) {
      Validator.requireWebSocketUrl(config.wsUrl, 'wsUrl');
    }
  }

  private normalizeError(method: string, error: Object): SkillSdkException {
    if (error instanceof SkillSdkException) {
      this.logger.warn(`${method} failed: [${error.errorCode}] ${error.errorMessage}`);
      return error;
    }
    if (error instanceof Error) {
      this.logger.warn(`${method} failed: ${error.message}`);
      if (error.message.includes('must be')) {
        return new SkillSdkException(1000, error.message);
      }
      return new SkillSdkException(5000, error.message);
    }
    this.logger.warn(`${method} failed with unexpected error`, error);
    return new SkillSdkException(5000, 'Unexpected SDK error');
  }
}
