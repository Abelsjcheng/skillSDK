/**
 * Skill SDK 鸿蒙平台核心API模块
 * 提供技能执行、会话管理、消息发送等核心功能
 * 
 * @author OpenCode Team
 * @version 1.0.0
 * @since 2026-03-06
 */
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';
import { window } from '@kit.UIKit';
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
  CloseSessionResponse,
  SendToIMResponse,
  PermissionResponse,
  CreateSessionRequest,
  SendMessageRequest,
  ReplyPermissionRequest,
  SessionState,
  ExecuteSkillResult,
  CloseSkillResult,
  StopSkillResult,
  AnswerResult,
  SendMessageToIMResult,
  SendMessageResult,
  ReplyPermissionResult,
  ControlSkillWeCodeResult
} from '../types';
import { SessionManager } from '../utils/sessionManager';
import { WebSocketManager } from '../websocket/webSocketManager';

// 会话管理器实例
let sessionManager: SessionManager | null = null;
// SDK配置信息
let config: SkillSDKConfig | null = null;
// 会话状态回调映射表
let sessionStatusCallbacks: Map<string, SessionStatusCallback> = new Map();
// 小程序状态回调
let skillWeCodeStatusCallback: SkillWecodeStatusCallback | null = null;

/**
 * 获取会话管理器实例
 * 如果实例未初始化，抛出错误
 * 
 * @returns 会话管理器实例
 * @throws Error 如果SDK未初始化
 */
function getSessionManager(): SessionManager {
  if (!sessionManager || !config) {
    throw new Error('Skill SDK not initialized. Call init() first.');
  }
  return sessionManager;
}

/**
 * 初始化Skill SDK
 * 
 * @param sdkConfig SDK配置信息
 */
export function init(sdkConfig: SkillSDKConfig): void {
  config = sdkConfig;
  sessionManager = SessionManager.getInstance(sdkConfig);
}

/**
 * 执行技能，创建会话并发送用户消息
 * 
 * @param imChatId IM聊天ID
 * @param userId 用户ID
 * @param skillContent 用户输入的技能指令
 * @param agentId PCAgent ID，可选
 * @param title 会话标题，可选
 * @returns 执行结果，包含会话ID和状态信息
 */
export async function executeSkill(
  imChatId: string,
  userId: string,
  skillContent: string,
  agentId?: number,
  title?: string
): Promise<ExecuteSkillResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const createSessionRequest: CreateSessionRequest = {
    userId: parseInt(userId),
    skillDefinitionId: manager.getSkillDefinitionId(),
    agentId: agentId,
    title: title,
    imChatId: imChatId
  };

  const session = await httpClient.post<SkillSession>('/api/skill/sessions', createSessionRequest);
  const sessionId = String(session.id);

  const wsManager = new WebSocketManager();

  const callback: StreamMessageCallback = (message: StreamMessage) => {
    const statusCallback = sessionStatusCallbacks.get(sessionId);
    if (statusCallback) {
      if (message.type === 'delta') {
        statusCallback(SessionStatus.EXECUTING);
      } else if (message.type === 'done') {
        statusCallback(SessionStatus.COMPLETED);
      } else if (message.type === 'error') {
        statusCallback(SessionStatus.STOPPED);
      } else if (message.type === 'agent_offline') {
        statusCallback(SessionStatus.STOPPED);
      }
    }
  };

  await wsManager.connect(sessionId, manager.getWebSocketHost(), callback);
  manager.addSession(sessionId, wsManager);

  const sendRequest: SendMessageRequest = { content: skillContent };
  await httpClient.post<ChatMessage>(`/api/skill/sessions/${sessionId}/messages`, sendRequest);

  return {
    sessionId: sessionId,
    status: session.status,
    toolSessionId: session.toolSessionId,
    createdAt: new Date(session.createdAt).getTime()
  };
}

/**
 * 关闭技能会话
 * 调用服务端API关闭会话，移除会话并删除状态回调
 * 
 * @param sessionId 会话ID
 * @returns 关闭会话结果
 */
export async function closeSkill(sessionId: string): Promise<CloseSkillResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  // 调用服务端API关闭会话
  await httpClient.delete<CloseSessionResponse>(`/api/skill/sessions/${sessionId}`);

  // 移除会话并删除状态回调
  manager.removeSession(sessionId);
  sessionStatusCallbacks.delete(sessionId);

  return { success: true };
}

/**
 * 停止技能生成
 * 关闭WebSocket连接，更新会话状态为IDLE，并删除状态回调
 * 
 * @param sessionId 会话ID
 * @returns 停止技能结果
 */
export async function stopSkill(sessionId: string): Promise<StopSkillResult> {
  const manager = getSessionManager();
  const session = manager.getSession(sessionId);

  if (session) {
    // 关闭WebSocket连接
    session.wsManager.close();
    // 更新会话状态为IDLE
    manager.updateSessionState(sessionId, SessionState.IDLE);
    // 删除状态回调
    sessionStatusCallbacks.delete(sessionId);
  }

  return { success: true };
}

/**
 * 注册会话状态回调
 * 监听会话状态变化，如执行中、已完成、已停止等
 * 
 * @param sessionId 会话ID
 * @param callback 状态变化回调函数
 */
export function onSessionStatus(sessionId: string, callback: SessionStatusCallback): void {
  const manager = getSessionManager();

  // 保存状态回调
  sessionStatusCallbacks.set(sessionId, callback);

  // 如果会话已存在，设置WebSocket状态回调
  const session = manager.getSession(sessionId);
  if (session) {
    session.wsManager.setStatusCallback(callback);
  }
}

/**
 * 注册小程序状态回调
 * 监听小程序状态变化，如已关闭、已最小化等
 * 
 * @param callback 小程序状态变化回调函数
 */
export function onSkillWecodeStatus(callback: SkillWecodeStatusCallback): void {
  skillWeCodeStatusCallback = callback;
}

/**
 * 重新生成回答
 * 获取会话中最后一条用户消息，重新发送到服务端触发AI重新生成回答
 * 
 * @param sessionId 会话ID
 * @returns 重新生成结果
 */
export async function regenerateAnswer(sessionId: string): Promise<AnswerResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  // 获取会话消息列表
  const messagesResponse = await httpClient.get<PageResult<ChatMessage>>(
    `/api/skill/sessions/${sessionId}/messages`,
    { page: 0, size: 50 }
  );

  // 过滤出用户消息
  const userMessages = messagesResponse.content.filter(msg => msg.role === 'USER');

  // 如果没有用户消息，返回失败
  if (userMessages.length === 0) {
    return {
      messageId: '',
      success: false
    };
  }

  // 获取最后一条用户消息，重新发送
  const lastUserMessage = userMessages[userMessages.length - 1];
  const sendRequest: SendMessageRequest = { content: lastUserMessage.content };

  const message = await httpClient.post<ChatMessage>(
    `/api/skill/sessions/${sessionId}/messages`,
    sendRequest
  );

  return {
    messageId: String(message.id),
    success: true
  };
}

/**
 * 发送消息到IM
 * 将消息内容转发到会话关联的IM聊天中
 * 
 * @param sessionId 会话ID
 * @param content 要发送的消息内容
 * @returns 发送结果
 */
export async function sendMessageToIM(sessionId: string, content: string): Promise<SendMessageToIMResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const response = await httpClient.post<SendToIMResponse>(
    `/api/skill/sessions/${sessionId}/send-to-im`,
    { content }
  );

  return { success: response.success };
}

/**
 * 获取会话消息列表
 * 分页查询指定会话的消息历史记录
 * 
 * @param sessionId 会话ID
 * @param page 页码，默认为0
 * @param size 每页大小，默认为50
 * @returns 分页消息结果
 */
export async function getSessionMessage(
  sessionId: string,
  page: number = 0,
  size: number = 50
): Promise<PageResult<ChatMessage>> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const response = await httpClient.get<PageResult<ChatMessage>>(
    `/api/skill/sessions/${sessionId}/messages`,
    { page, size }
  );

  return response;
}

/**
 * 发送消息
 * 向服务端发送用户消息，触发AI生成回答
 * 
 * @param sessionId 会话ID
 * @param content 消息内容
 * @param onMessage 消息回调函数，可选，用于接收AI生成的流式消息
 * @returns 发送结果
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  onMessage?: (message: StreamMessage) => void
): Promise<SendMessageResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();
  const session = manager.getSession(sessionId);

  // 调用服务端API发送消息
  await httpClient.post<ChatMessage>(
    `/api/skill/sessions/${sessionId}/messages`,
    { content }
  );

  // 如果会话存在且提供了回调，设置WebSocket消息回调
  if (session && onMessage) {
    session.wsManager.setMessageCallback(onMessage);
  }

  return { success: true };
}

/**
 * 回复权限请求
 * 对AI发起的权限确认请求进行批准或拒绝
 * 
 * @param sessionId 会话ID
 * @param permissionId 权限请求ID
 * @param approved 是否批准权限请求
 * @returns 权限回复结果
 */
export async function replyPermission(
  sessionId: string,
  permissionId: string,
  approved: boolean
): Promise<ReplyPermissionResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  // 调用服务端API回复权限请求
  const response = await httpClient.post<PermissionResponse>(
    `/api/skill/sessions/${sessionId}/permissions/${permissionId}`,
    { approved } as ReplyPermissionRequest
  );

  return { success: response.success };
}

/**
 * 控制小程序
 * 执行小程序的关闭或最小化操作，并触发相应的状态回调
 * 
 * @param action 操作类型：close（关闭）或minimize（最小化）
 * @returns 控制操作结果
 */
export async function controlSkillWeCode(action: SkillWeCodeAction): Promise<ControlSkillWeCodeResult> {
  const context = getContext() as common.UIAbilityContext;

  const windowManager = window.getLastWindow(context);
  const win = await windowManager;

  // 关闭小程序
  if (action === SkillWeCodeAction.CLOSE) {
    // 关闭所有会话
    const allSessions = getSessionManager().getAllSessions();
    for (const [sessionId, _] of allSessions) {
      await closeSkill(sessionId);
    }

    // 触发小程序关闭回调
    if (skillWeCodeStatusCallback) {
      skillWeCodeStatusCallback(SkillWecodeStatus.CLOSED);
    }

    return { success: true };
  } 
  // 最小化小程序
  else if (action === SkillWeCodeAction.MINIMIZE) {
    // 调用鸿蒙原生API最小化窗口
    await win.minimize();

    // 触发小程序最小化回调
    if (skillWeCodeStatusCallback) {
      skillWeCodeStatusCallback(SkillWecodeStatus.MINIMIZED);
    }

    return { success: true };
  }

  return { success: false };
}

/**
 * 获取应用上下文
 * 用于调用鸿蒙原生API
 * 
 * @returns 应用上下文对象
 */
function getContext(): Object {
  return globalThis.getContext();
}