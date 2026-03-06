export enum SessionStatus {
  EXECUTING = 'executing',
  STOPPED = 'stopped',
  COMPLETED = 'completed'
}

export enum SkillWecodeStatus {
  CLOSED = 'closed',
  MINIMIZED = 'minimized'
}

export enum SkillWeCodeAction {
  CLOSE = 'close',
  MINIMIZE = 'minimize'
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
  TOOL = 'TOOL'
}

export enum ContentType {
  MARKDOWN = 'MARKDOWN',
  CODE = 'CODE',
  PLAIN = 'PLAIN'
}

export enum SessionState {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  CLOSED = 'CLOSED'
}

export interface ChatMessage {
  id: number;
  sessionId: number;
  seq: number;
  role: MessageRole | string;
  content: string;
  contentType: ContentType | string;
  createdAt: string;
  meta: string | null;
}

export interface StreamMessage {
  type: 'delta' | 'done' | 'error' | 'agent_offline' | 'agent_online';
  seq: number;
  content: string | StreamMessageContent | null;
  usage?: StreamUsage;
}

export interface StreamMessageContent {
  usage?: StreamUsage;
}

export interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
}

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

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface PermissionRequest {
  permissionId: string;
  sessionId: number;
  action: string;
  approved: boolean;
}

export interface PermissionResponse {
  success: boolean;
  permissionId: string;
  approved: boolean;
}

export interface CloseSessionResponse {
  status: string;
  sessionId: string;
}

export interface SendToIMResponse {
  success: boolean;
  chatId: string;
  contentLength: number;
}

export interface AnswerResult {
  messageId: string;
  success: boolean;
}

export interface ExecuteSkillResult {
  sessionId: string;
  status: SessionStatus | string;
  toolSessionId: string | null;
  createdAt: number;
}

export interface CloseSkillResult {
  success: boolean;
}

export interface StopSkillResult {
  success: boolean;
}

export interface SendMessageToIMResult {
  success: boolean;
}

export interface SendMessageResult {
  success: boolean;
}

export interface ReplyPermissionResult {
  success: boolean;
}

export interface ControlSkillWeCodeResult {
  success: boolean;
}

export interface CreateSessionRequest {
  userId: number;
  skillDefinitionId: number;
  agentId?: number;
  title?: string;
  imChatId?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface ReplyPermissionRequest {
  approved: boolean;
}

export interface ErrorResponse {
  success: boolean;
  error?: string;
}

export type SessionStatusCallback = (status: SessionStatus) => void;
export type SkillWecodeStatusCallback = (status: SkillWecodeStatus) => void;
export type StreamMessageCallback = (message: StreamMessage) => void;

export interface SkillSDKConfig {
  baseUrl: string;
  skillDefinitionId: number;
  webSocketHost?: string;
}