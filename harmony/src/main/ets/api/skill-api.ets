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

let sessionManager: SessionManager | null = null;
let config: SkillSDKConfig | null = null;
let sessionStatusCallbacks: Map<string, SessionStatusCallback> = new Map();
let skillWeCodeStatusCallback: SkillWecodeStatusCallback | null = null;

function getSessionManager(): SessionManager {
  if (!sessionManager || !config) {
    throw new Error('Skill SDK not initialized. Call init() first.');
  }
  return sessionManager;
}

export function init(sdkConfig: SkillSDKConfig): void {
  config = sdkConfig;
  sessionManager = SessionManager.getInstance(sdkConfig);
}

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

export async function closeSkill(sessionId: string): Promise<CloseSkillResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  await httpClient.delete<CloseSessionResponse>(`/api/skill/sessions/${sessionId}`);

  manager.removeSession(sessionId);
  sessionStatusCallbacks.delete(sessionId);

  return { success: true };
}

export async function stopSkill(sessionId: string): Promise<StopSkillResult> {
  const manager = getSessionManager();
  const session = manager.getSession(sessionId);

  if (session) {
    session.wsManager.close();
    manager.updateSessionState(sessionId, SessionState.IDLE);
    sessionStatusCallbacks.delete(sessionId);
  }

  return { success: true };
}

export function onSessionStatus(sessionId: string, callback: SessionStatusCallback): void {
  const manager = getSessionManager();

  sessionStatusCallbacks.set(sessionId, callback);

  const session = manager.getSession(sessionId);
  if (session) {
    session.wsManager.setStatusCallback(callback);
  }
}

export function onSkillWecodeStatus(callback: SkillWecodeStatusCallback): void {
  skillWeCodeStatusCallback = callback;
}

export async function regenerateAnswer(sessionId: string): Promise<AnswerResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const messagesResponse = await httpClient.get<PageResult<ChatMessage>>(
    `/api/skill/sessions/${sessionId}/messages`,
    { page: 0, size: 50 }
  );

  const userMessages = messagesResponse.content.filter(msg => msg.role === 'USER');

  if (userMessages.length === 0) {
    return {
      messageId: '',
      success: false
    };
  }

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

export async function sendMessageToIM(sessionId: string, content: string): Promise<SendMessageToIMResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const response = await httpClient.post<SendToIMResponse>(
    `/api/skill/sessions/${sessionId}/send-to-im`,
    { content }
  );

  return { success: response.success };
}

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

export async function sendMessage(
  sessionId: string,
  content: string,
  onMessage?: (message: StreamMessage) => void
): Promise<SendMessageResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();
  const session = manager.getSession(sessionId);

  await httpClient.post<ChatMessage>(
    `/api/skill/sessions/${sessionId}/messages`,
    { content }
  );

  if (session && onMessage) {
    session.wsManager.setMessageCallback(onMessage);
  }

  return { success: true };
}

export async function replyPermission(
  sessionId: string,
  permissionId: string,
  approved: boolean
): Promise<ReplyPermissionResult> {
  const manager = getSessionManager();
  const httpClient = manager.getHttpClient();

  const response = await httpClient.post<PermissionResponse>(
    `/api/skill/sessions/${sessionId}/permissions/${permissionId}`,
    { approved } as ReplyPermissionRequest
  );

  return { success: response.success };
}

export async function controlSkillWeCode(action: SkillWeCodeAction): Promise<ControlSkillWeCodeResult> {
  const context = getContext() as common.UIAbilityContext;

  const windowManager = window.getLastWindow(context);
  const win = await windowManager;

  if (action === SkillWeCodeAction.CLOSE) {
    const allSessions = getSessionManager().getAllSessions();
    for (const [sessionId, _] of allSessions) {
      await closeSkill(sessionId);
    }

    if (skillWeCodeStatusCallback) {
      skillWeCodeStatusCallback(SkillWecodeStatus.CLOSED);
    }

    return { success: true };
  } else if (action === SkillWeCodeAction.MINIMIZE) {
    await win.minimize();

    if (skillWeCodeStatusCallback) {
      skillWeCodeStatusCallback(SkillWecodeStatus.MINIMIZED);
    }

    return { success: true };
  }

  return { success: false };
}

function getContext(): Object {
  return globalThis.getContext();
}