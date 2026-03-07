/**
 * Skill SDK 鸿蒙平台核心API模块
 * 提供技能执行、会话管理、消息发送等核心功能
 * 
 * @author OpenCode Team
 * @version 2.0.0
 * @since 2026-03-07
 */
import { common, window } from '@kit.AbilityKit';
import {
  SkillSDKConfig,
  SkillSession,
  ChatMessage,
  PageResult,
  StreamMessage,
  SessionStatus,
  SessionStatusCallback,
  SkillWecodeStatus,
  SkillWecodeStatusCallback,
  SkillWeCodeAction,
  StreamMessageCallback,
  SessionError,
  SessionState,
  ExecuteSkillParams,
  ExecuteSkillResult,
  CloseSkillParams,
  CloseSkillResult,
  StopSkillParams,
  StopSkillResult,
  OnSessionStatusChangeParams,
  OnSkillWecodeStatusChangeParams,
  RegenerateAnswerParams,
  AnswerResult,
  SendMessageToIMParams,
  SendMessageToIMResult,
  GetSessionMessageParams,
  SendMessageParams,
  SendMessageResult,
  ReplyPermissionParams,
  ReplyPermissionResult,
  ControlSkillWeCodeParams,
  ControlSkillWeCodeResult,
  RegisterSessionListenerParams,
  UnregisterSessionListenerParams,
  SessionStatusResult,
  SkillWecodeStatusResult
} from '../types';
import { SessionManager } from '../utils/sessionManager';
import { WebSocketManager } from '../websocket/webSocketManager';

// ==================== 模块级变量 ====================

/** 会话管理器实例 */
let sessionManager: SessionManager | null = null;

/** SDK配置信息 */
let config: SkillSDKConfig | null = null;

/** 会话状态回调映射表 */
const sessionStatusCallbacks: Map<string, SessionStatusCallback> = new Map();

/** 小程序状态回调 */
let skillWeCodeStatusCallback: SkillWecodeStatusCallback | null = null;

/** 会话监听器映射表 */
const sessionListeners: Map<string, Set<{
  onMessage: StreamMessageCallback;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}>> = new Map();

/** 暂存的监听器（用于时序安全保障） */
const pendingListeners: Map<string, Set<{
  onMessage: StreamMessageCallback;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}>> = new Map();

// ==================== 内部工具函数 ====================

/**
 * 获取会话管理器实例
 */
function getSessionManager(): SessionManager {
  if (!sessionManager || !config) {
    throw new Error('Skill SDK not initialized. Call init() first.');
  }
  return sessionManager;
}

/**
 * 获取应用上下文
 */
function getContext(): common.UIAbilityContext {
  return globalThis.getContext() as common.UIAbilityContext;
}

/**
 * 触发会话状态回调
 */
function triggerSessionStatusCallback(sessionId: string, status: SessionStatus): void {
  const callback = sessionStatusCallbacks.get(sessionId);
  if (callback) {
    callback({ status });
  }
}

/**
 * 触发小程序状态回调
 */
function triggerSkillWeCodeStatusCallback(status: SkillWecodeStatus, message?: string): void {
  if (skillWeCodeStatusCallback) {
    const result: SkillWecodeStatusResult = {
      status,
      timestamp: Date.now(),
      message
    };
    skillWeCodeStatusCallback(result);
  }
}

/**
 * 分发WebSocket消息到所有监听器
 */
function dispatchMessageToListeners(sessionId: string, message: StreamMessage): void {
  const listeners = sessionListeners.get(sessionId);
  if (listeners) {
    listeners.forEach(listener => {
      listener.onMessage(message);
    });
  }
}

/**
 * 分发错误到所有监听器
 */
function dispatchErrorToListeners(sessionId: string, error: SessionError): void {
  const listeners = sessionListeners.get(sessionId);
  if (listeners) {
    listeners.forEach(listener => {
      if (listener.onError) {
        listener.onError(error);
      }
    });
  }
}

/**
 * 分发关闭事件到所有监听器
 */
function dispatchCloseToListeners(sessionId: string, reason: string): void {
  const listeners = sessionListeners.get(sessionId);
  if (listeners) {
    listeners.forEach(listener => {
      if (listener.onClose) {
        listener.onClose(reason);
      }
    });
  }
}

// ==================== 公共API ====================

/**
 * 初始化Skill SDK
 * @param sdkConfig SDK配置信息
 */
export function init(sdkConfig: SkillSDKConfig): void {
  config = sdkConfig;
  sessionManager = SessionManager.getInstance(sdkConfig);
}

/**
 * 执行技能
 * 与Skill服务端建立WebSocket会话连接，并发送用户消息到服务端触发AI处理
 * 
 * @param params 执行技能参数
 * @returns 执行结果，包含会话ID和状态信息
 */
export async function executeSkill(params: ExecuteSkillParams): Promise<ExecuteSkillResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  // 1. 调用服务端REST API创建会话
  const createSessionRequest = {
    userId: parseInt(params.userId),
    skillDefinitionId: params.skillDefinitionId,
    agentId: params.agentId,
    title: params.title,
    imChatId: params.imChatId
  };

  const session = await httpClient.post<SkillSession>('/api/skill/sessions', createSessionRequest);
  const sessionId = String(session.id);

  // 2. 建立WebSocket流式连接
  const wsManager = new WebSocketManager();

  // 创建消息处理回调
  const messageCallback: StreamMessageCallback = (message: StreamMessage) => {
    // 分发消息到所有监听器
    dispatchMessageToListeners(sessionId, message);

    // 更新会话状态
    if (message.type === 'delta') {
      triggerSessionStatusCallback(sessionId, SessionStatus.EXECUTING);
    } else if (message.type === 'done') {
      triggerSessionStatusCallback(sessionId, SessionStatus.COMPLETED);
    } else if (message.type === 'error') {
      triggerSessionStatusCallback(sessionId, SessionStatus.STOPPED);
    } else if (message.type === 'agent_offline') {
      triggerSessionStatusCallback(sessionId, SessionStatus.STOPPED);
    } else if (message.type === 'agent_online') {
      triggerSessionStatusCallback(sessionId, SessionStatus.EXECUTING);
    }
  };

  await wsManager.connect(sessionId, manager.getWebSocketHost(), messageCallback);
  manager.addSession(sessionId, wsManager);

  // 3. 处理暂存的监听器（时序安全保障）
  const pending = pendingListeners.get(sessionId);
  if (pending) {
    if (!sessionListeners.has(sessionId)) {
      sessionListeners.set(sessionId, new Set());
    }
    pending.forEach(listener => {
      sessionListeners.get(sessionId)!.add(listener);
    });
    pendingListeners.delete(sessionId);
  }

  // 4. 发送首条用户消息触发AI处理
  await httpClient.post<ChatMessage>(`/api/skill/sessions/${sessionId}/messages`, {
    content: params.skillContent
  });

  return {
    sessionId,
    status: session.status,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt
  };
}

/**
 * 关闭技能
 * 关闭与Skill服务端的WebSocket会话连接，释放资源
 * 
 * @param params 关闭技能参数
 * @returns 关闭结果
 */
export async function closeSkill(params: CloseSkillParams): Promise<CloseSkillResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  // 1. 调用服务端REST API关闭会话
  await httpClient.delete(`/api/skill/sessions/${params.sessionId}`);

  // 2. 关闭WebSocket连接并移除会话
  manager.removeSession(params.sessionId);

  // 3. 清理回调
  sessionStatusCallbacks.delete(params.sessionId);
  sessionListeners.delete(params.sessionId);
  pendingListeners.delete(params.sessionId);

  return { status: 'success' };
}

/**
 * 停止技能
 * 停止Skill服务端WebSocket会话的持续回调，中断当前正在进行的回答生成
 * 
 * @param params 停止技能参数
 * @returns 停止结果
 */
export async function stopSkill(params: StopSkillParams): Promise<StopSkillResult> {
  const manager = getSessionManager();
  const session = manager.getSession(params.sessionId);

  if (session) {
    // 断开WebSocket连接
    session.wsManager.close();

    // 更新会话状态为IDLE
    manager.updateSessionState(params.sessionId, SessionState.IDLE);

    // 删除状态回调
    sessionStatusCallbacks.delete(params.sessionId);
  }

  return { status: 'success' };
}

/**
 * 会话状态变更回调
 * 监听会话消息状态变更的回调接口
 * 
 * @param params 回调参数
 */
export function onSessionStatusChange(params: OnSessionStatusChangeParams): void {
  sessionStatusCallbacks.set(params.sessionId, params.callback);
}

/**
 * 小程序状态变更回调
 * 监听小程序的状态变化
 * 
 * @param params 回调参数
 */
export function onSkillWecodeStatusChange(params: OnSkillWecodeStatusChangeParams): void {
  skillWeCodeStatusCallback = params.callback;
}

/**
 * 重新生成问答
 * 根据提供的内容重新生成回答
 * 
 * @param params 重新生成参数
 * @returns 重新生成结果
 */
export async function regenerateAnswer(params: RegenerateAnswerParams): Promise<AnswerResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  // 发送用户消息
  const message = await httpClient.post<ChatMessage>(
    `/api/skill/sessions/${params.sessionId}/messages`,
    { content: params.content }
  );

  return {
    messageId: String(message.id)
  };
}

/**
 * 发送消息到IM
 * 将AI生成的消息结果发送到IM客户端
 * 
 * @param params 发送参数
 * @returns 发送结果
 */
export async function sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const response = await httpClient.post<{
    success: boolean;
    chatId?: string;
    contentLength?: number;
    errorMessage?: string;
  }>(
    `/api/skill/sessions/${params.sessionId}/send-to-im`,
    { content: params.content }
  );

  return {
    success: response.success,
    chatId: response.chatId,
    contentLength: response.contentLength,
    errorMessage: response.errorMessage
  };
}

/**
 * 获取当前会话的消息列表
 * 分页查询指定会话的消息历史记录
 * 
 * @param params 查询参数
 * @returns 分页消息结果
 */
export async function getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<ChatMessage>> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const page = params.page ?? 0;
  const size = params.size ?? 50;

  const response = await httpClient.get<PageResult<ChatMessage>>(
    `/api/skill/sessions/${params.sessionId}/messages`,
    { page, size }
  );

  const mergedContent = manager.mergeStreamingMessage(params.sessionId, response.content);
  
  const hasStreaming = manager.hasStreamingMessage(params.sessionId);
  const totalElements = hasStreaming ? response.totalElements + 1 : response.totalElements;

  return {
    content: mergedContent,
    totalElements: totalElements,
    totalPages: response.totalPages,
    number: response.number,
    size: response.size
  };
}

/**
 * 注册会话监听器
 * 用于接收WebSocket推送的AI响应流、错误信息和连接关闭事件
 * 
 * @param params 监听器参数
 */
export function registerSessionListener(params: RegisterSessionListenerParams): void {
  const listener = {
    onMessage: params.onMessage,
    onError: params.onError,
    onClose: params.onClose
  };

  const manager = getSessionManager();
  const session = manager.getSession(params.sessionId);

  if (session && session.wsManager.isActive()) {
    if (!sessionListeners.has(params.sessionId)) {
      sessionListeners.set(params.sessionId, new Set());
    }
    sessionListeners.get(params.sessionId)!.add(listener);
  } else {
    if (!pendingListeners.has(params.sessionId)) {
      pendingListeners.set(params.sessionId, new Set());
    }
    pendingListeners.get(params.sessionId)!.add(listener);
  }
}

/**
 * 移除会话监听器
 * 当监听器不再需要接收消息时调用
 * 
 * @param params 移除参数
 */
export function unregisterSessionListener(params: UnregisterSessionListenerParams): void {
  const listener = {
    onMessage: params.onMessage,
    onError: params.onError,
    onClose: params.onClose
  };

  // 从会话监听器中移除
  const listeners = sessionListeners.get(params.sessionId);
  if (listeners) {
    listeners.delete(listener);
    if (listeners.size === 0) {
      sessionListeners.delete(params.sessionId);
    }
  }

  // 从暂存监听器中移除
  const pending = pendingListeners.get(params.sessionId);
  if (pending) {
    pending.delete(listener);
    if (pending.size === 0) {
      pendingListeners.delete(params.sessionId);
    }
  }
}

/**
 * 发送消息
 * 发送用户输入的内容，触发会话的持续回答
 * 
 * @param params 发送参数
 * @returns 发送结果
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const message = await httpClient.post<{
    id: number;
    sessionId: number;
    seq: number;
    createdAt: string;
  }>(
    `/api/skill/sessions/${params.sessionId}/messages`,
    { content: params.content }
  );

  return {
    messageId: message.id,
    seq: message.seq,
    createdAt: message.createdAt
  };
}

/**
 * 权限确认
 * 对AI发起的权限确认请求进行批准或拒绝
 * 
 * @param params 权限回复参数
 * @returns 权限回复结果
 */
export async function replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const response = await httpClient.post<{
    success: boolean;
    permissionId: string;
    approved: boolean;
  }>(
    `/api/skill/sessions/${params.sessionId}/permissions/${params.permissionId}`,
    { approved: params.approved }
  );

  return {
    success: response.success,
    permissionId: response.permissionId,
    approved: response.approved
  };
}

/**
 * 小程序控制
 * 执行小程序的关闭或最小化操作
 * 
 * @param params 控制参数
 * @returns 控制结果
 */
export async function controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResult> {
  const context = getContext();
  const windowManager = window.getLastWindow(context);
  const win = await windowManager;

  if (params.action === SkillWeCodeAction.CLOSE) {
    // 关闭所有会话
    const manager = getSessionManager();
    const allSessions = manager.getAllSessions();
    for (const [sessionId] of allSessions) {
      await closeSkill({ sessionId });
    }

    // 触发小程序关闭回调
    triggerSkillWeCodeStatusCallback(SkillWecodeStatus.CLOSED, 'User closed the mini program');

    return { status: 'success' };
  } else if (params.action === SkillWeCodeAction.MINIMIZE) {
    // 调用鸿蒙原生API最小化窗口
    await win.minimize();

    // 触发小程序最小化回调
    triggerSkillWeCodeStatusCallback(SkillWecodeStatus.MINIMIZED, 'User minimized the mini program');

    return { status: 'success' };
  }

  return { status: 'failed' };
}