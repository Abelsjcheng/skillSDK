// ============================================================
// StreamMessage Protocol Type Definitions
// Based on 小程序JSAPI接口文档.md & SkillClientSdkInterfaceV1.md
// ============================================================

/** All supported StreamMessage type strings */
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

export type MessagePartType = 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
export type PartStatus = 'pending' | 'running' | 'completed' | 'error';
export type PermissionResponse = 'once' | 'always' | 'reject';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type BackendMessageRole = 'user' | 'assistant' | string;
export type BackendContentType = 'plain' | 'markdown' | string | null;

interface ToolPartFields<TValue, TStatus> {
  toolName?: TValue;
  toolCallId?: TValue;
  status?: TStatus;
  input?: object | null;
  output?: TValue;
  error?: TValue;
  title?: TValue;
}

interface QuestionPartFields<TValue, TOptions> {
  header?: TValue;
  question?: TValue;
  options?: TOptions;
}

interface PermissionCoreFields<TValue> {
  permissionId?: TValue;
  permType?: TValue;
}

interface PermissionPartFields<TValue, TResponse> extends PermissionCoreFields<TValue> {
  metadata?: object | null;
  response?: TResponse;
}

interface FilePartFields<TValue> {
  fileName?: TValue;
  fileUrl?: TValue;
  fileMime?: TValue;
}

/** StreamMessage delivered from SessionListener onMessage callback. */
export interface StreamMessage
  extends ToolPartFields<string | null, PartStatus | string | null>,
  QuestionPartFields<string | null, string[] | null>,
  PermissionPartFields<string | null, PermissionResponse | string | null>,
  FilePartFields<string | null> {
  // transport-level fields
  type: StreamMessageType;
  seq: number | null;
  welinkSessionId: string;
  emittedAt: string | null;
  raw?: object;

  // message-level fields
  messageId?: string | null;
  sourceMessageId?: string | null;
  messageSeq?: number | null;
  role?: MessageRole | string;

  // part-level fields
  partId?: string | null;
  partSeq?: number | null;
  content?: string | null;

  // session status
  sessionStatus?: 'busy' | 'idle' | 'retry' | string | null;

  // step fields
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  } | null;
  cost?: number | null;
  reason?: string | null;

  // snapshot/streaming fields
  messages?: SessionMessageSnapshot[] | null;
  parts?: MessagePartSnapshot[] | null;
}

// ============================================================
// SessionMessage - history message structure
// ============================================================

export interface SessionMessage {
  id: string;
  seq?: number | null;
  welinkSessionId: string;
  role: BackendMessageRole;
  content: string | null;
  contentType?: BackendContentType;
  meta?: object | null;
  messageSeq?: number | null;
  parts?: SessionMessagePart[] | null;
  createdAt: string;
}

export interface SessionMessagePart
  extends ToolPartFields<string | null, string | null>,
  QuestionPartFields<string | null, string[] | null>,
  PermissionPartFields<string | null, PermissionResponse | string | null>,
  FilePartFields<string | null> {
  partId: string;
  partSeq: number;
  type: MessagePartType;
  content: string | null;
}

// ============================================================
// UI State Types
// ============================================================

/** A structured part within an assistant message */
export interface MessagePart
  extends ToolPartFields<string, PartStatus>,
  QuestionPartFields<string, string[]>,
  PermissionCoreFields<string>,
  FilePartFields<string> {
  partId: string;
  type: MessagePartType;
  content: string;
  isStreaming: boolean;
  answered?: boolean;
  permResolved?: boolean;
}

/** A single message in the conversation */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  parts?: MessagePart[];
  meta?: {
    tokens?: StreamMessage['tokens'];
    cost?: number;
  };
}

/** Session status for UI display */
export type SessionStatus = 'idle' | 'busy' | 'retry' | 'error';
export type AgentStatus = 'online' | 'offline' | 'unknown';

/** Snapshot message for reconnect recovery */
export interface SessionMessageSnapshot {
  id: string;
  welinkSessionId?: string;
  seq: number | null;
  messageSeq?: number | null;
  role: string;
  content: string | null;
  contentType?: BackendContentType | 'code';
  meta?: object | null;
  createdAt?: string;
  parts?: MessagePartSnapshot[];
}

/** Part snapshot for streaming recovery */
export interface MessagePartSnapshot
  extends ToolPartFields<string | null, string | null>,
  QuestionPartFields<string | null, string[] | null>,
  PermissionPartFields<string | null, string | null>,
  FilePartFields<string | null> {
  partId: string;
  partSeq?: number;
  type: MessagePartType;
  content?: string | null;
}

// ============================================================
// App State Types
// ============================================================

export interface ChatState {
  welinkSessionId: string | null;
  title: string;
  messages: Message[];
  sessionStatus: SessionStatus;
  agentStatus: AgentStatus;
  isLoading: boolean;
  isMaximized: boolean;
  error: string | null;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  code: number;
  errormsg: string;
  data: T | null;
}

interface MessageOperationResponseBase {
  id: string;
  welinkSessionId: string;
  seq: number | null;
  messageSeq: number | null;
  role: BackendMessageRole;
  content: string | null;
  contentType: BackendContentType;
  createdAt: string;
  meta: object | null;
  parts: SessionMessagePart[] | null;
}

export interface SendMessageResponse extends MessageOperationResponseBase {}

export interface GetSessionMessageResponse {
  content: SessionMessage[];
  number: number;
  size: number;
  totalElements: number;
}

export interface StopSkillResponse {
  welinkSessionId: string;
  status: 'aborted';
}

export interface SendMessageToIMResponse {
  success: boolean;
}

export interface ReplyPermissionResponse {
  welinkSessionId: string;
  permissionId: string;
  response: PermissionResponse;
}

export interface RegenerateAnswerResponse extends MessageOperationResponseBase {}

export interface ControlSkillWeCodeResponse {
  status: 'success' | 'failed';
}
