/**
 * Skill SDK Types
 * 鸿蒙ArkTS SDK类型定义
 */

// ==================== 枚举类型 ====================

/**
 * 会话状态枚举
 */
export enum SessionStatus {
  EXECUTING = 'executing',
  STOPPED = 'stopped',
  COMPLETED = 'completed'
}

/**
 * 小程序状态枚举
 */
export enum SkillWecodeStatus {
  CLOSED = 'closed',
  MINIMIZED = 'minimized'
}

/**
 * 小程序操作类型枚举
 */
export enum SkillWeCodeAction {
  CLOSE = 'close',
  MINIMIZE = 'minimize'
}

/**
 * 消息角色枚举
 */
export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
  TOOL = 'TOOL'
}

/**
 * 内容类型枚举
 */
export enum ContentType {
  MARKDOWN = 'MARKDOWN',
  CODE = 'CODE',
  PLAIN = 'PLAIN'
}

/**
 * WebSocket消息类型枚举
 */
export enum WebSocketMessageType {
  DELTA = 'delta',
  DONE = 'done',
  ERROR = 'error',
  AGENT_OFFLINE = 'agent_offline',
  AGENT_ONLINE = 'agent_online'
}

// ==================== 请求参数类型 ====================

/**
 * 执行技能参数
 */
export interface ExecuteSkillParams {
  imChatId: string;
  skillDefinitionId: number;
  userId: string;
  agentId?: number;
  title?: string;
  skillContent: string;
}

/**
 * 关闭技能参数
 */
export interface CloseSkillParams {
  sessionId: string;
}

/**
 * 停止技能参数
 */
export interface StopSkillParams {
  sessionId: string;
}

/**
 * 会话状态变更回调参数
 */
export interface OnSessionStatusChangeParams {
  sessionId: string;
  callback: (result: SessionStatusResult) => void;
}

/**
 * 小程序状态变更回调参数
 */
export interface OnSkillWecodeStatusChangeParams {
  callback: (result: SkillWecodeStatusResult) => void;
}

/**
 * 重新生成问答参数
 */
export interface RegenerateAnswerParams {
  sessionId: string;
  content: string;
}

/**
 * 发送消息到IM参数
 */
export interface SendMessageToIMParams {
  sessionId: string;
  content: string;
}

/**
 * 获取会话消息参数
 */
export interface GetSessionMessageParams {
  sessionId: string;
  page?: number;
  size?: number;
}

/**
 * 注册会话监听器参数
 */
export interface RegisterSessionListenerParams {
  sessionId: string;
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

/**
 * 移除会话监听器参数
 */
export interface UnregisterSessionListenerParams {
  sessionId: string;
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

/**
 * 发送消息参数
 */
export interface SendMessageParams {
  sessionId: string;
  content: string;
}

/**
 * 权限确认参数
 */
export interface ReplyPermissionParams {
  sessionId: string;
  permissionId: string;
  approved: boolean;
}

/**
 * 小程序控制参数
 */
export interface ControlSkillWeCodeParams {
  action: SkillWeCodeAction;
}

// ==================== 响应数据类型 ====================

/**
 * 技能会话
 */
export interface SkillSession {
  id: number;
  userId: number;
  skillDefinitionId: number;
  agentId?: number;
  toolSessionId?: string;
  title?: string;
  status: string;
  imChatId?: string;
  createdAt: string;
  lastActiveAt: string;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: number | string;
  sessionId: number;
  seq: number;
  role: string;
  content: string;
  contentType: string;
  createdAt: string;
  meta?: string;
}

/**
 * 流式消息
 */
export interface StreamMessage {
  sessionId: string;
  type: string;
  seq: number;
  content: string | object;
  usage?: TokenUsage;
}

/**
 * Token用量统计
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 会话错误
 */
export interface SessionError {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * 会话状态结果
 */
export interface SessionStatusResult {
  status: SessionStatus;
}

/**
 * 小程序状态结果
 */
export interface SkillWecodeStatusResult {
  status: SkillWecodeStatus;
  timestamp: number;
  message?: string;
}

/**
 * 发送消息到IM结果
 */
export interface SendMessageToIMResult {
  success: boolean;
  chatId?: string;
  contentLength?: number;
  errorMessage?: string;
}

/**
 * 发送消息结果
 */
export interface SendMessageResult {
  messageId: number;
  seq: number;
  createdAt: string;
}

/**
 * 关闭技能结果
 */
export interface CloseSkillResult {
  status: string;
}

/**
 * 停止技能结果
 */
export interface StopSkillResult {
  status: string;
}

/**
 * 回答结果
 */
export interface AnswerResult {
  messageId: string;
}

/**
 * 权限确认结果
 */
export interface ReplyPermissionResult {
  success: boolean;
  permissionId?: string;
  approved?: boolean;
}

/**
 * 小程序控制结果
 */
export interface ControlSkillWeCodeResult {
  status: string;
}

/**
 * 分页结果
 */
export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * 权限请求
 */
export interface PermissionRequest {
  permissionId: string;
  sessionId: number;
  action: string;
  approved: boolean;
}

/**
 * 会话监听器
 */
export interface SessionListener {
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

// ==================== 配置类型 ====================

/**
 * SDK配置
 */
export interface SkillSDKConfig {
  baseUrl: string;
  wsUrl: string;
  timeout?: number;
  enableLog?: boolean;
}

// ==================== 内部类型 ====================

/**
 * 流式消息缓存项
 */
export interface StreamingMessageCache {
  sessionId: string;
  messageId: string;
  content: string;
  seq: number;
  isStreaming: boolean;
  createdAt: string;
  lastUpdated: number;
}

/**
 * REST API响应包装
 */
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}