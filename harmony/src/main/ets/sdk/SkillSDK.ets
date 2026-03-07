/**
 * Skill SDK - Main Entry
 * Skill SDK主入口类（单例模式）
 * 提供所有13个公共接口
 */

import { HttpClient } from './core/HttpClient';
import { WebSocketManager } from './core/WebSocketManager';
import { MessageCacheManager } from './managers/MessageCacheManager';
import { SessionStateManager } from './managers/SessionStateManager';
import { WeCodeStateManager } from './managers/WeCodeStateManager';
import {
  SkillSDKConfig,
  ExecuteSkillParams,
  CloseSkillParams,
  StopSkillParams,
  OnSessionStatusChangeParams,
  OnSkillWecodeStatusChangeParams,
  RegenerateAnswerParams,
  SendMessageToIMParams,
  GetSessionMessageParams,
  RegisterSessionListenerParams,
  UnregisterSessionListenerParams,
  SendMessageParams,
  ReplyPermissionParams,
  ControlSkillWeCodeParams,
  SkillSession,
  CloseSkillResult,
  StopSkillResult,
  AnswerResult,
  SendMessageToIMResult,
  PageResult,
  ChatMessage,
  SendMessageResult,
  ReplyPermissionResult,
  ControlSkillWeCodeResult,
  SkillWecodeStatus,
  SkillWeCodeAction,
  StreamMessage,
  SessionStatus
} from './types';

export class SkillSDK {
  private static instance: SkillSDK | null = null;
  
  // 核心组件
  private httpClient: HttpClient;
  private wsManager: WebSocketManager;
  private messageCacheManager: MessageCacheManager;
  private sessionStateManager: SessionStateManager;
  private wecodeStateManager: WeCodeStateManager;
  
  // 配置
  private config: SkillSDKConfig;
  
  // 当前活跃会话ID（用于stopSkill）
  private activeSessionId: string | null = null;

  private constructor(config: SkillSDKConfig) {
    this.config = config;
    
    // 初始化核心组件
    this.httpClient = new HttpClient(config);
    this.wsManager = WebSocketManager.getInstance(config);
    this.messageCacheManager = new MessageCacheManager(config.enableLog);
    this.sessionStateManager = new SessionStateManager(config.enableLog);
    this.wecodeStateManager = new WeCodeStateManager(config.enableLog);
    
    // 设置WebSocket内部缓存监听器
    this.wsManager.setInternalCacheListener((message: StreamMessage) => {
      this.handleInternalCacheMessage(message);
    });
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: SkillSDKConfig): SkillSDK {
    if (!SkillSDK.instance) {
      if (!config) {
        throw new Error('SkillSDK config is required for first initialization');
      }
      SkillSDK.instance = new SkillSDK(config);
    }
    return SkillSDK.instance;
  }

  /**
   * 销毁单例实例
   */
  static destroyInstance(): void {
    if (SkillSDK.instance) {
      SkillSDK.instance.cleanup();
      SkillSDK.instance = null;
    }
  }

  /**
   * 处理内部缓存消息
   */
  private handleInternalCacheMessage(message: StreamMessage): void {
    // 更新消息缓存
    this.messageCacheManager.updateStreamingCache(message);
    
    // 更新会话状态
    this.sessionStateManager.updateStatusFromMessage(message);
  }

  // ==================== 1. 执行技能接口 ====================
  
  /**
   * 执行技能
   * 与Skill服务端建立WebSocket会话连接，并发送用户消息到服务端触发AI处理
   */
  async executeSkill(params: ExecuteSkillParams): Promise<SkillSession> {
    try {
      // 1. 调用服务端REST API创建会话
      const sessionData = {
        userId: parseInt(params.userId),
        skillDefinitionId: params.skillDefinitionId,
        agentId: params.agentId,
        title: params.title,
        imChatId: params.imChatId
      };
      
      const session = await this.httpClient.post<SkillSession>('/api/skill/sessions', sessionData);
      
      // 2. 建立WebSocket流式连接（单例模式）
      await this.wsManager.connect();
      
      // 3. 发送首条用户消息触发AI处理
      await this.httpClient.post(`/api/skill/sessions/${session.id}/messages`, {
        content: params.skillContent
      });
      
      // 记录活跃会话
      this.activeSessionId = String(session.id);
      
      return session;
    } catch (error) {
      throw this.handleError('executeSkill', error);
    }
  }

  // ==================== 2. 关闭技能接口 ====================
  
  /**
   * 关闭技能
   * 关闭与Skill服务端的WebSocket会话连接，释放资源
   */
  async closeSkill(params: CloseSkillParams): Promise<CloseSkillResult> {
    try {
      // 1. 调用服务端REST API关闭会话
      await this.httpClient.delete(`/api/skill/sessions/${params.sessionId}`);
      
      // 2. 清理缓存和状态
      this.messageCacheManager.clearCache(params.sessionId);
      this.sessionStateManager.unregisterCallback(params.sessionId);
      
      // 清除活跃会话记录
      if (this.activeSessionId === params.sessionId) {
        this.activeSessionId = null;
      }
      
      return { status: 'success' };
    } catch (error) {
      throw this.handleError('closeSkill', error);
    }
  }

  // ==================== 3. 停止技能接口 ====================
  
  /**
   * 停止技能
   * 停止Skill服务端WebSocket会话的持续回调，但保持会话连接
   */
  async stopSkill(params: StopSkillParams): Promise<StopSkillResult> {
    try {
      // 断开WebSocket连接（但保持会话）
      if (this.wsManager.isActive()) {
        await this.wsManager.disconnect();
      }
      
      // 更新会话状态为stopped
      this.sessionStateManager.setStatus(params.sessionId, SessionStatus.STOPPED);
      
      // 清除活跃会话记录
      if (this.activeSessionId === params.sessionId) {
        this.activeSessionId = null;
      }
      
      return { status: 'success' };
    } catch (error) {
      throw this.handleError('stopSkill', error);
    }
  }

  // ==================== 4. 会话状态变更回调接口 ====================
  
  /**
   * 会话状态变更回调
   * 监听会话消息状态变更的回调接口
   */
  onSessionStatusChange(params: OnSessionStatusChangeParams): void {
    this.sessionStateManager.registerCallback(params.sessionId, params.callback);
  }

  // ==================== 5. 小程序状态变更回调接口 ====================
  
  /**
   * 小程序状态变更回调
   * 监听小程序的状态变化
   */
  onSkillWecodeStatusChange(params: OnSkillWecodeStatusChangeParams): void {
    this.wecodeStateManager.registerCallback(params.callback);
  }

  // ==================== 6. 重新生成问答接口 ====================
  
  /**
   * 重新生成问答
   * 根据提供的内容重新生成回答
   */
  async regenerateAnswer(params: RegenerateAnswerParams): Promise<AnswerResult> {
    try {
      // 确保WebSocket连接
      if (!this.wsManager.isActive()) {
        await this.wsManager.connect();
      }
      
      // 发送消息
      const result = await this.httpClient.post<{ id: number }>(
        `/api/skill/sessions/${params.sessionId}/messages`,
        { content: params.content }
      );
      
      return { messageId: String(result.id) };
    } catch (error) {
      throw this.handleError('regenerateAnswer', error);
    }
  }

  // ==================== 7. 发送AI生成消息结果接口 ====================
  
  /**
   * 发送消息到IM
   * 将AI生成的消息结果发送到IM客户端
   */
  async sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult> {
    try {
      const result = await this.httpClient.post<SendMessageToIMResult>(
        `/api/skill/sessions/${params.sessionId}/send-to-im`,
        { content: params.content }
      );
      
      return result;
    } catch (error) {
      throw this.handleError('sendMessageToIM', error);
    }
  }

  // ==================== 8. 获取当前会话的消息列表接口 ====================
  
  /**
   * 获取会话消息列表
   * 获取当前会话的消息列表，将数据持久化存储到本地
   */
  async getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<ChatMessage>> {
    try {
      const page = params.page || 0;
      const size = params.size || 50;
      
      // 1. 获取服务端历史消息
      const historicalMessages = await this.httpClient.get<PageResult<ChatMessage>>(
        `/api/skill/sessions/${params.sessionId}/messages`,
        { page, size }
      );
      
      // 2. 合并流式消息缓存
      const mergedContent = this.messageCacheManager.mergeMessages(
        historicalMessages.content,
        params.sessionId
      );
      
      return {
        ...historicalMessages,
        content: mergedContent
      };
    } catch (error) {
      throw this.handleError('getSessionMessage', error);
    }
  }

  // ==================== 9. 注册会话监听器接口 ====================
  
  /**
   * 注册会话监听器
   * 注册会话监听器，用于接收WebSocket推送的AI响应流
   */
  registerSessionListener(params: RegisterSessionListenerParams): void {
    const listener = {
      onMessage: params.onMessage,
      onError: params.onError,
      onClose: params.onClose
    };
    
    this.wsManager.registerSessionListener(params.sessionId, listener);
  }

  // ==================== 10. 移除会话监听器接口 ====================
  
  /**
   * 移除会话监听器
   * 移除已注册的会话监听器
   */
  unregisterSessionListener(params: UnregisterSessionListenerParams): void {
    this.wsManager.unregisterSessionListener(params.sessionId, {
      onMessage: params.onMessage,
      onError: params.onError,
      onClose: params.onClose
    });
  }

  // ==================== 11. 发送消息内容接口 ====================
  
  /**
   * 发送消息
   * 发送用户输入的内容，触发会话的持续回答
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      // 确保WebSocket连接
      if (!this.wsManager.isActive()) {
        await this.wsManager.connect();
      }
      
      // 发送消息
      const message = await this.httpClient.post<{
        id: number;
        seq: number;
        createdAt: string;
      }>(`/api/skill/sessions/${params.sessionId}/messages`, {
        content: params.content
      });
      
      // 更新活跃会话
      this.activeSessionId = params.sessionId;
      
      return {
        messageId: message.id,
        seq: message.seq,
        createdAt: message.createdAt
      };
    } catch (error) {
      throw this.handleError('sendMessage', error);
    }
  }

  // ==================== 12. 权限确认接口 ====================
  
  /**
   * 权限确认
   * 对AI发起的权限确认请求进行批准或拒绝
   */
  async replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResult> {
    try {
      const result = await this.httpClient.post<ReplyPermissionResult>(
        `/api/skill/sessions/${params.sessionId}/permissions/${params.permissionId}`,
        { approved: params.approved }
      );
      
      return result;
    } catch (error) {
      throw this.handleError('replyPermission', error);
    }
  }

  // ==================== 13. 小程序控制接口 ====================
  
  /**
   * 控制小程序
   * 执行小程序的关闭或最小化操作
   * 注意：该接口仅通过 onSkillWecodeStatusChange 回调通知上层应用，不处理 WebSocket 连接
   */
  async controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResult> {
    try {
      switch (params.action) {
        case SkillWeCodeAction.CLOSE:
          // 关闭小程序 - 仅通知状态，由上层应用决定是否调用 closeSkill
          this.wecodeStateManager.notifyStatusChange(SkillWecodeStatus.CLOSED, 'User closed the miniapp');
          break;
          
        case SkillWeCodeAction.MINIMIZE:
          // 最小化小程序 - 仅通知状态，由上层应用决定是否调用 stopSkill
          this.wecodeStateManager.notifyStatusChange(SkillWecodeStatus.MINIMIZED, 'User minimized the miniapp');
          break;
          
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
      
      return { status: 'success' };
    } catch (error) {
      throw this.handleError('controlSkillWeCode', error);
    }
  }

  // ==================== 辅助方法 ====================
  
  /**
   * 错误处理
   */
  private handleError(method: string, error: unknown): Error {
    if (this.config.enableLog) {
      console.error(`[SkillSDK] ${method} error:`, error);
    }
    
    if (error instanceof Error) {
      return error;
    }
    
    return new Error(`Unknown error in ${method}`);
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      await this.wsManager.disconnect();
      this.wsManager.clearAllListeners();
      this.messageCacheManager.clearAllCache();
      this.sessionStateManager.clearAllCallbacks();
      this.wecodeStateManager.clearAllCallbacks();
    } catch (error) {
      if (this.config.enableLog) {
        console.error('[SkillSDK] Cleanup error:', error);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SkillSDKConfig>): void {
    if (config.baseUrl) {
      this.config.baseUrl = config.baseUrl;
      this.httpClient.updateConfig(config);
    }
    if (config.enableLog !== undefined) {
      this.config.enableLog = config.enableLog;
      this.messageCacheManager.setEnableLog(config.enableLog);
      this.sessionStateManager.setEnableLog(config.enableLog);
      this.wecodeStateManager.setEnableLog(config.enableLog);
    }
  }
}