/**
 * Skill SDK type contracts aligned with:
 * - SkillClientSdkInterfaceV1.md
 * - 01-layer1-miniapp-skill-api.md
 */

// ---------------------------
// Constants and Enums
// ---------------------------

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

export type PermissionResponse = 'once' | 'always' | 'reject';
export type SessionRecordStatus = 'ACTIVE' | 'IDLE' | 'CLOSED';
export type SessionRuntimeStatus = 'busy' | 'idle' | 'retry';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageContentType = 'plain' | 'markdown';

export type StreamMessageType =
  | 'text.delta'
  | 'text.done'
  | 'thinking.delta'
  | 'thinking.done'
  | 'tool.update'
  | 'question'
  | 'file'
  | 'step.start'
  | 'step.done'
  | 'session.status'
  | 'session.title'
  | 'session.error'
  | 'permission.ask'
  | 'permission.reply'
  | 'agent.online'
  | 'agent.offline'
  | 'error'
  | 'snapshot'
  | 'streaming';

// ---------------------------
// SDK Config and Error
// ---------------------------

export interface SkillSDKConfig {
  baseUrl: string;
  wsUrl?: string;
  timeout?: number;
  enableLog?: boolean;
  defaultHeaders?: Record<string, string>;
}

export interface SDKError {
  errorCode: number;
  errorMessage: string;
}

export class SkillSdkException extends Error implements SDKError {
  errorCode: number;
  errorMessage: string;

  constructor(errorCode: number, errorMessage: string) {
    super(errorMessage);
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.name = 'SkillSdkException';
  }
}

// ---------------------------
// REST envelope
// ---------------------------

export interface RestApiResponse<T> {
  code: number;
  errormsg: string;
  data: T | null;
}

// ---------------------------
// Shared entities
// ---------------------------

export interface SkillSession {
  welinkSessionId: string;
  userId: string;
  ak: string | null;
  title: string | null;
  imGroupId: string | null;
  status: SessionRecordStatus;
  toolSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessagePart {
  partId: string;
  partSeq?: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  input?: Record<string, any>;
  output?: string;
  error?: string;
  title?: string;
  header?: string;
  question?: string;
  options?: string[];
  permissionId?: string;
  permType?: string;
  metadata?: Record<string, any>;
  response?: PermissionResponse;
  status?: 'pending' | 'running' | 'completed' | 'error';
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface SessionMessage {
  id: string;
  seq?: number | null;
  welinkSessionId: string;
  role: MessageRole;
  content?: string | null;
  contentType?: MessageContentType | null;
  meta?: Record<string, any> | null;
  messageSeq?: number | null;
  parts?: SessionMessagePart[] | null;
  createdAt: string;
}

export interface PageResult<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
}

// ---------------------------
// WebSocket entities
// ---------------------------

export interface StreamSnapshotMessage {
  id: string;
  welinkSessionId: string;
  seq?: number | null;
  messageSeq?: number | null;
  role: MessageRole;
  content?: string | null;
  contentType?: MessageContentType | null;
  createdAt: string;
  meta?: Record<string, any> | null;
  parts?: SessionMessagePart[] | null;
}

export interface StreamingPart {
  partId: string;
  partSeq?: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  input?: Record<string, any>;
  output?: string;
  error?: string;
  title?: string;
  header?: string;
  question?: string;
  options?: string[];
  permissionId?: string;
  permType?: string;
  metadata?: Record<string, any>;
  response?: PermissionResponse;
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface StreamMessage {
  type: StreamMessageType;
  seq?: number | null;
  welinkSessionId: string;
  emittedAt?: string | null;
  createdAt?: string;
  raw?: Record<string, any>;

  messageId?: string;
  sourceMessageId?: string | null;
  messageSeq?: number;
  role?: MessageRole | null;
  partId?: string;
  partSeq?: number;

  content?: string;
  toolName?: string;
  toolCallId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error' | null;
  input?: Record<string, any>;
  output?: string | null;
  error?: string | null;
  title?: string | null;
  header?: string;
  question?: string;
  options?: string[];
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
  cost?: number;
  reason?: string;
  sessionStatus?: SessionRuntimeStatus | null;
  permissionId?: string | null;
  permType?: string | null;
  metadata?: Record<string, any> | null;
  response?: PermissionResponse | null;
  messages?: StreamSnapshotMessage[];
  parts?: StreamingPart[];
}

export interface SessionError {
  code: string;
  message: string;
  timestamp: number;
}

export interface SessionListener {
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

// ---------------------------
// API params and results
// ---------------------------

export interface CreateSessionParams {
  ak?: string;
  title?: string;
  imGroupId: string;
}

export interface CloseSkillResult {
  status: 'success' | 'failed';
}

export interface StopSkillParams {
  welinkSessionId: string;
}

export interface StopSkillResult {
  welinkSessionId: string;
  status: 'aborted';
}

export interface SessionStatusResult {
  status: SessionStatus;
}

export interface OnSessionStatusChangeParams {
  welinkSessionId: string;
  callback: (result: SessionStatusResult) => void;
}

export interface SkillWecodeStatusResult {
  status: SkillWecodeStatus;
  timestamp: number;
  message?: string;
}

export interface OnSkillWecodeStatusChangeParams {
  callback: (result: SkillWecodeStatusResult) => void;
}

export interface RegenerateAnswerParams {
  welinkSessionId: string;
}

export interface SendMessageToIMParams {
  welinkSessionId: string;
  messageId?: string;
  chatId?: string;
}

export interface SendMessageToIMResult {
  success: boolean;
}

export interface GetSessionMessageParams {
  welinkSessionId: string;
  page?: number;
  size?: number;
}

export interface RegisterSessionListenerParams {
  welinkSessionId: string;
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

export interface RegisterSessionListenerResult {
  status: 'success';
}

export interface UnregisterSessionListenerParams {
  welinkSessionId: string;
}

export interface UnregisterSessionListenerResult {
  status: 'success';
}

export interface SendMessageParams {
  welinkSessionId: string;
  content: string;
  toolCallId?: string;
}

export interface SendMessageResult {
  id: string;
  welinkSessionId: string;
  seq?: number | null;
  messageSeq?: number | null;
  role: MessageRole;
  content?: string | null;
  contentType?: MessageContentType | null;
  meta?: Record<string, any> | null;
  parts?: SessionMessagePart[] | null;
  createdAt: string;
}

export interface ReplyPermissionParams {
  welinkSessionId: string;
  permId: string;
  response: PermissionResponse;
}

export interface ReplyPermissionResult {
  welinkSessionId: string;
  permissionId: string;
  response: PermissionResponse;
}

export interface ControlSkillWeCodeParams {
  action: SkillWeCodeAction;
}

export interface ControlSkillWeCodeResult {
  status: 'success' | 'failed';
}
