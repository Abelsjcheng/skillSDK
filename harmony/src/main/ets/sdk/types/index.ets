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
export type SessionRecordStatus = 'ACTIVE' | 'CLOSED';
export type SessionRuntimeStatus = 'busy' | 'idle' | 'retry';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageContentType = 'plain' | 'markdown' | 'code';

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
  welinkSessionId: number;
  userId: string;
  ak: string;
  title: string;
  imGroupId: string;
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
  toolStatus?: 'pending' | 'running' | 'completed' | 'error';
  toolInput?: Record<string, any>;
  toolOutput?: string;
  toolError?: string;
  header?: string;
  question?: string;
  options?: string[];
  permissionId?: string;
  permissionResponse?: PermissionResponse;
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface SessionMessage {
  id: number | string;
  welinkSessionId: number;
  userId: string | null;
  role: MessageRole;
  content: string;
  messageSeq: number;
  parts: SessionMessagePart[];
  createdAt: string;
  contentType?: MessageContentType;
}

export interface PageResult<T> {
  content: T[];
  page: number;
  size: number;
  total: number;
}

// ---------------------------
// WebSocket entities
// ---------------------------

export interface StreamSnapshotMessage {
  id: string;
  seq: number;
  role: MessageRole;
  content: string;
  contentType: MessageContentType;
  createdAt?: string;
  parts?: SessionMessagePart[];
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
  header?: string;
  question?: string;
  options?: string[];
  permissionId?: string;
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface StreamMessage {
  type: StreamMessageType;
  seq: number;
  welinkSessionId: string;
  emittedAt: string;
  createdAt?: string;
  raw?: Record<string, any>;

  messageId?: string;
  messageSeq?: number;
  role?: MessageRole;
  partId?: string;
  partSeq?: number;

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
  sessionStatus?: SessionRuntimeStatus;
  permissionId?: string;
  permType?: string;
  metadata?: Record<string, any>;
  response?: PermissionResponse;
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
  ak: string;
  title?: string;
  imGroupId: string;
}

export interface CloseSkillResult {
  status: 'success' | 'failed';
}

export interface StopSkillParams {
  welinkSessionId: number;
}

export interface StopSkillResult {
  welinkSessionId: number;
  status: 'aborted';
}

export interface SessionStatusResult {
  status: SessionStatus;
}

export interface OnSessionStatusChangeParams {
  welinkSessionId: number;
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
  welinkSessionId: number;
}

export interface SendMessageToIMParams {
  welinkSessionId: number;
  messageId?: string;
  chatId?: string;
}

export interface SendMessageToIMResult {
  status: 'success' | 'failed';
  chatId?: string;
  contentLength?: number;
}

export interface GetSessionMessageParams {
  welinkSessionId: number;
  page?: number;
  size?: number;
}

export interface RegisterSessionListenerParams {
  welinkSessionId: number;
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}

export interface UnregisterSessionListenerParams {
  welinkSessionId: number;
}

export interface SendMessageParams {
  welinkSessionId: number;
  content: string;
  toolCallId?: string;
}

export interface SendMessageResult {
  id: number;
  welinkSessionId: number;
  userId: string;
  role: 'user';
  content: string;
  messageSeq: number;
  createdAt: string;
}

export interface ReplyPermissionParams {
  welinkSessionId: number;
  permId: string;
  response: PermissionResponse;
}

export interface ReplyPermissionResult {
  welinkSessionId: number;
  permissionId: string;
  response: PermissionResponse;
}

export interface ControlSkillWeCodeParams {
  action: SkillWeCodeAction;
}

export interface ControlSkillWeCodeResult {
  status: 'success' | 'failed';
}
