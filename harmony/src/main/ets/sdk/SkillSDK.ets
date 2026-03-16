import { HttpClient } from './core/HttpClient';
import { WebSocketManager } from './core/WebSocketManager';
import { MessageCacheManager } from './managers/MessageCacheManager';
import { SessionStateManager } from './managers/SessionStateManager';
import { WeCodeStateManager } from './managers/WeCodeStateManager';
import { Logger } from './utils/Logger';
import { Validator } from './utils/Validator';
import {
  CloseSkillResult,
  ControlSkillWeCodeParams,
  ControlSkillWeCodeResult,
  CreateSessionParams,
  GetSessionMessageParams,
  OnSessionStatusChangeParams,
  OnSkillWecodeStatusChangeParams,
  PageResult,
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
  UnregisterSessionListenerParams,
  UnregisterSessionListenerResult
} from './types';

/**
 * Singleton SDK entry.
 * Exposes 13 public interfaces aligned with SkillClientSdkInterfaceV1.md.
 */
export class SkillSDK {
  private static instance: SkillSDK | null = null;

  private config: SkillSDKConfig;
  private readonly logger: Logger;
  private readonly httpClient: HttpClient;
  private readonly wsManager: WebSocketManager;
  private readonly messageCacheManager: MessageCacheManager;
  private readonly sessionStateManager: SessionStateManager;
  private readonly weCodeStateManager: WeCodeStateManager;

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

      const payload: Record<string, unknown> = {};
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

      const payload: Record<string, unknown> = { content: resolvedContent };
      if (chatId !== undefined) {
        payload.chatId = chatId;
      }

      await this.ensureWebSocketConnected();

      let raw: Record<string, unknown>;
      try {
        raw = await this.httpClient.post<Record<string, unknown>>(
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

      const payload: Record<string, unknown> = {
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

  private async fetchServerMessages(
    welinkSessionId: string,
    page: number,
    size: number
  ): Promise<PageResult<SessionMessage>> {
    const result = await this.httpClient.get<Record<string, unknown>>(
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

  private normalizeSendToImResult(raw: Record<string, unknown>): SendMessageToIMResult {
    if (typeof raw !== 'object' || raw === null) {
      throw new SkillSdkException(7000, 'Unexpected send-to-im response schema');
    }
    const payload = raw as Record<string, unknown>;

    if ('code' in payload && 'data' in payload) {
      const code = Number(payload.code);
      const errormsg = String(payload.errormsg ?? '');
      if (code !== 0) {
        throw new SkillSdkException(code, errormsg || 'send-to-im failed');
      }
      const data = (typeof payload.data === 'object' && payload.data !== null)
        ? (payload.data as Record<string, unknown>)
        : {};
      const success = ('success' in data)
        ? Boolean(data.success)
        : ('status' in data ? String(data.status) === 'success' : true);
      return { success };
    }

    if ('success' in payload) {
      return { success: Boolean(payload.success) };
    }

    if ('status' in payload) {
      return { success: String(payload.status) === 'success' };
    }

    throw new SkillSdkException(7000, 'Unexpected send-to-im response schema');
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
    if (config.wsUrl !== undefined) {
      Validator.requireWebSocketUrl(config.wsUrl, 'wsUrl');
    }
  }

  private normalizeError(method: string, error: unknown): SkillSdkException {
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
    this.logger.warn(`${method} failed with unknown error`, error);
    return new SkillSdkException(5000, 'Unknown SDK error');
  }
}
