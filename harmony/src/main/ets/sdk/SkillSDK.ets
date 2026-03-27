import { HttpClient } from './core/HttpClient';
import { WebSocketManager } from './core/WebSocketManager';
import { MessageCacheManager } from './managers/MessageCacheManager';
import { SessionStateManager } from './managers/SessionStateManager';
import { WeCodeStateManager } from './managers/WeCodeStateManager';
import { Logger } from './utils/Logger';
import { TypeConverter } from './utils/TypeConverter';
import { Validator } from './utils/Validator';
import { WeAgentStore } from './utils/WeAgentStore';
import {
  AgentType,
  AgentTypeList,
  CloseSkillResult,
  ControlSkillWeCodeParams,
  ControlSkillWeCodeResult,
  CreateDigitalTwinParams,
  CreateDigitalTwinResult,
  CreateNewSessionParams,
  CreateSessionParams,
  GetSessionMessageParams,
  HistorySessionsParams,
  OnSessionStatusChangeParams,
  OnSkillWecodeStatusChangeParams,
  PageParams,
  PageResult,
  QueryWeAgentParams,
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
  WeAgent,
  WeAgentDetailsArray,
  WeAgentDetails,
  WeAgentList,
  WeAgentUriResult,
  UnregisterSessionListenerParams,
  UnregisterSessionListenerResult
} from './types';

/**
 * Singleton SDK entry.
 * Exposes public interfaces aligned with SkillClientSdkInterfaceV1.md.
 */
export class SkillSDK {
  private static instance: SkillSDK | null = null;
  private static readonly ASSISTANT_H5_URI = 'h5://123456/html/index.html';

  private config: SkillSDKConfig;
  private readonly logger: Logger;
  private readonly httpClient: HttpClient;
  private readonly wsManager: WebSocketManager;
  private readonly messageCacheManager: MessageCacheManager;
  private readonly sessionStateManager: SessionStateManager;
  private readonly weCodeStateManager: WeCodeStateManager;
  private readonly weAgentStore: WeAgentStore;

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
    this.messageCacheManager = new MessageCacheManager(this.config.enableLog);
    this.sessionStateManager = new SessionStateManager(this.config.enableLog);
    this.weCodeStateManager = new WeCodeStateManager(this.config.enableLog);
    this.weAgentStore = new WeAgentStore(this.config.context);

    this.wsManager.setMessageHandler((message: StreamMessage) => {
      this.messageCacheManager.onStreamMessage(message);
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
      SkillSDK.instance.messageCacheManager.clearAll();
      SkillSDK.instance.sessionStateManager.clearAll();
      SkillSDK.instance.weCodeStateManager.clearAll();
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
      this.messageCacheManager.setEnableLog(nextConfig.enableLog);
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
      this.messageCacheManager.clearAll();
      this.sessionStateManager.clearAll();
      this.weCodeStateManager.clearAll();
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

      let content = this.messageCacheManager.getLastUserMessageContent(params.welinkSessionId);
      if (content === null) {
        const history = await this.fetchServerMessages(params.welinkSessionId, 0, 200);
        this.messageCacheManager.cacheHistory(params.welinkSessionId, history.content);
        content = this.messageCacheManager.getLastUserMessageContent(params.welinkSessionId);
      }

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

      const content = this.messageCacheManager.getFinalMessageContent(
        params.welinkSessionId,
        messageId
      );
      let resolvedContent = content;
      if (resolvedContent === null) {
        await this.ensureWebSocketConnected();
        const history = await this.fetchServerMessages(params.welinkSessionId, 0, 100);
        this.messageCacheManager.cacheHistory(params.welinkSessionId, history.content);
        resolvedContent = this.messageCacheManager.getFinalMessageContent(
          params.welinkSessionId,
          messageId
        );
      }
      if (resolvedContent === null) {
        if (messageId !== undefined) {
          const exists = this.messageCacheManager.hasMessage(params.welinkSessionId, messageId);
          if (!exists) {
            throw new SkillSdkException(4003, 'Message not found in local cache');
          }
          const completed = this.messageCacheManager.isMessageCompleted(
            params.welinkSessionId,
            messageId
          );
          if (!completed) {
            throw new SkillSdkException(4004, 'Message is not completed');
          }
        }
        throw new SkillSdkException(4005, 'No finalized message in local cache');
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
      this.messageCacheManager.cacheHistory(params.welinkSessionId, history.content);
      const isFirst = params.isFirst ?? false;
      if (!isFirst) {
        return history;
      }

      const localLatest = this.messageCacheManager.getLatestLocalMessageNotInHistory(
        params.welinkSessionId,
        history.content
      );
      if (localLatest === null) {
        return history;
      }

      const dedupedHistory = history.content.filter((item: SessionMessage) => !this.isSameMessage(item, localLatest));
      return {
        ...history,
        content: [localLatest, ...dedupedHistory]
      };
    } catch (error) {
      throw this.normalizeError('getSessionMessage', error);
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

      this.messageCacheManager.cacheSentUserMessage(result);
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
      const weCrewType = TypeConverter.requireInteger(params.weCrewType, 'weCrewType');
      if (weCrewType !== 0 && weCrewType !== 1) {
        throw new SkillSdkException(1000, 'weCrewType must be 0 or 1');
      }
      const bizRobotId = TypeConverter.toOptionalString(params.bizRobotId, 'bizRobotId');

      const payload: Record<string, Object> = {
        name,
        icon,
        description,
        weCrewType
      };
      if (bizRobotId !== undefined) {
        payload.bizRobotId = bizRobotId;
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
      const payload = await this.httpClient.get<Object>(
        `/v1/robot-partners/${partnerAccount}`,
        undefined,
        { useAssistantBaseUrl: true }
      );
      const list = this.parseWeAgentDetailsList(payload);
      if (list.length > 0) {
        this.weAgentStore.saveCurrentDetail(list[0]);
      }
      return {
        WeAgentDetailsArray: list
      };
    } catch (error) {
      throw this.normalizeError('getWeAgentDetails', error);
    }
  }

  // 20. getWeAgentUri
  getWeAgentUri(): WeAgentUriResult {
    try {
      const details = this.weAgentStore.loadCurrentDetail();
      const partnerAccount = details?.partnerAccount ?? '';
      const weCodeUrl = details?.weCodeUrl ?? '';

      return {
        weAgentUri: this.appendQueryParam(weCodeUrl, 'wecodePlace', 'weAgent'),
        assistantDetailUri: this.appendQueryParam(SkillSDK.ASSISTANT_H5_URI, 'partnerAccount', partnerAccount),
        switchAssistantUri: this.appendQueryParam(SkillSDK.ASSISTANT_H5_URI, 'partnerAccount', partnerAccount)
      };
    } catch (error) {
      throw this.normalizeError('getWeAgentUri', error);
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
      creatorName: TypeConverter.toOptionalString(payload.creatorName, 'creatorName') ?? '',
      creatorNameEn: TypeConverter.toOptionalString(payload.creatorNameEn, 'creatorNameEn') ?? '',
      ownerWelinkId: TypeConverter.toOptionalString(payload.ownerWelinkId, 'ownerWelinkId') ?? '',
      ownerName: TypeConverter.toOptionalString(payload.ownerName, 'ownerName') ?? '',
      ownerNameEn: TypeConverter.toOptionalString(payload.ownerNameEn, 'ownerNameEn') ?? '',
      ownerDeptName: TypeConverter.toOptionalString(payload.ownerDeptName, 'ownerDeptName') ?? '',
      ownerDeptNameEn: TypeConverter.toOptionalString(payload.ownerDeptNameEn, 'ownerDeptNameEn') ?? '',
      bizRobotId: TypeConverter.toOptionalString(payload.bizRobotId, 'bizRobotId') ?? '',
      weCodeUrl: TypeConverter.toOptionalString(payload.weCodeUrl, 'weCodeUrl') ?? ''
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  private appendQueryParam(baseUrl: string, key: string, value: string): string {
    const normalizedBase = TypeConverter.toOptionalString(baseUrl, 'baseUrl') ?? '';
    if (normalizedBase === '') {
      return '';
    }
    const connector = normalizedBase.includes('?')
      ? (normalizedBase.endsWith('?') || normalizedBase.endsWith('&') ? '' : '&')
      : '?';
    const encoded = encodeURIComponent(value ?? '');
    return `${normalizedBase}${connector}${encodeURIComponent(key)}=${encoded}`;
  }

  private isSameMessage(left: SessionMessage, right: SessionMessage): boolean {
    if (left.id.trim() !== '' && right.id.trim() !== '' && left.id === right.id) {
      return true;
    }
    return left.messageSeq !== undefined
      && left.messageSeq !== null
      && right.messageSeq !== undefined
      && right.messageSeq !== null
      && left.messageSeq === right.messageSeq;
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
