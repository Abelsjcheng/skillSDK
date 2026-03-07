/**
 * Skill SDK 类型定义
 * 根据接口文档定义所有参数类型和返回类型
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
 * 会话生命周期状态枚举
 */
export enum SessionState {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  CLOSED = 'CLOSED'
}

// ==================== 接口定义 ====================

/**
 * Token用量统计
 */
export interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 流式消息内容（done类型）
 */
export interface StreamMessageContent {
  usage?: StreamUsage;
}

/**
 * 流式消息
 */
export interface StreamMessage {
  type: 'delta' | 'done' | 'error' | 'agent_offline' | 'agent_online';
  seq: number;
  content: string | StreamMessageContent | null;
  usage?: StreamUsage;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: number | string;
  sessionId: number;
  seq: number;
  role: MessageRole | string;
  content: string;
  contentType: ContentType | string;
  createdAt: string;
  meta: string | null;
}

/**
 * 技能会话
 */
export interface SkillSession {
  id: number;
  userId: number;
  skillDefinitionId: number;
  agentId: number | null;
  toolSessionId: string | null;
  title: string | null;
  status: SessionState | string;
  imChatId: string | null;
  createdAt: string;
  lastActiveAt: string;
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
 * 会话错误
 */
export interface SessionError {
  code: string;
  message: string;
  timestamp: number;
}

// ==================== 参数类型定义 ====================

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
  callback: SessionStatusCallback;
}

/**
 * 小程序状态变更回调参数
 */
export interface OnSkillWecodeStatusChangeParams {
  callback: SkillWecodeStatusCallback;
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
 * 会话监听器参数
 */
export interface RegisterSessionListenerParams {
  sessionId: string;
  onMessage: StreamMessageCallback;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

/**
 * 移除会话监听器参数
 */
export interface UnregisterSessionListenerParams {
  sessionId: string;
  onMessage: StreamMessageCallback;
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
 * 回复权限参数
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

// ==================== 返回类型定义 ====================

/**
 * 执行技能结果
 */
export interface ExecuteSkillResult {
  sessionId: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
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
 * 会话状态变更结果
 */
export interface SessionStatusResult {
  status: SessionStatus;
}

/**
 * 小程序状态变更结果
 */
export interface SkillWecodeStatusResult {
  status: SkillWecodeStatus;
  timestamp: number;
  message?: string;
}

/**
 * 重新生成回答结果
 */
export interface AnswerResult {
  messageId: string;
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
 * 回复权限结果
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

// ==================== 回调类型定义 ====================

/**
 * 会话状态回调
 */
export type SessionStatusCallback = (result: SessionStatusResult) => void;

/**
 * 小程序状态回调
 */
export type SkillWecodeStatusCallback = (result: SkillWecodeStatusResult) => void;

/**
 * 流式消息回调
 */
export type StreamMessageCallback = (message: StreamMessage) => void;

// ==================== 其他类型 ====================

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
 * 关闭会话响应
 */
export interface CloseSessionResponse {
  status: string;
  sessionId: string;
}

/**
 * 发送到IM响应
 */
export interface SendToIMResponse {
  success: boolean;
  chatId: string;
  contentLength: number;
}

/**
 * 权限响应
 */
export interface PermissionResponse {
  success: boolean;
  permissionId: string;
  approved: boolean;
}

/**
 * 创建会话请求
 */
export interface CreateSessionRequest {
  userId: number;
  skillDefinitionId: number;
  agentId?: number;
  title?: string;
  imChatId?: string;
}

/**
 * 发送消息请求
 */
export interface SendMessageRequest {
  content: string;
}

/**
 * 回复权限请求
 */
export interface ReplyPermissionRequest {
  approved: boolean;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: boolean;
  error?: string;
}

/**
 * SDK配置
 */
export interface SkillSDKConfig {
  baseUrl: string;
  skillDefinitionId: number;
  webSocketHost?: string;
}