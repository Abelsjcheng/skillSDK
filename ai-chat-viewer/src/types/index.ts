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

/** StreamMessage delivered from SessionListener onMessage callback. */
export interface StreamMessage {
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
  role?: 'user' | 'assistant' | 'system' | 'tool' | string;

  // part-level fields
  partId?: string | null;
  partSeq?: number | null;
  content?: string | null;

  // tool fields
  toolName?: string | null;
  toolCallId?: string | null;
  status?: 'pending' | 'running' | 'completed' | 'error' | string | null;
  input?: object | null;
  output?: string | null;
  error?: string | null;
  title?: string | null;

  // question fields
  header?: string | null;
  question?: string | null;
  options?: string[] | null;

  // permission fields
  permissionId?: string | null;
  permType?: string | null;
  metadata?: object | null;
  response?: 'once' | 'always' | 'reject' | string | null;

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

  // file fields
  fileName?: string | null;
  fileUrl?: string | null;
  fileMime?: string | null;

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
  role: 'user' | 'assistant' | string;
  content: string | null;
  contentType?: 'plain' | 'markdown' | string | null;
  meta?: object | null;
  messageSeq?: number | null;
  parts?: SessionMessagePart[] | null;
  createdAt: string;
}

export interface SessionMessagePart {
  partId: string;
  partSeq: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content: string | null;

  // tool/question fields
  toolName?: string | null;
  toolCallId?: string | null;
  status?: string | null;
  input?: object | null;
  output?: string | null;
  error?: string | null;
  title?: string | null;

  // question fields
  header?: string | null;
  question?: string | null;
  options?: string[] | null;

  // permission fields
  permissionId?: string | null;
  permType?: string | null;
  metadata?: object | null;
  response?: 'once' | 'always' | 'reject' | string | null;

  // file fields
  fileName?: string | null;
  fileUrl?: string | null;
  fileMime?: string | null;
}

// ============================================================
// UI State Types
// ============================================================

/** A structured part within an assistant message */
export interface MessagePart {
  partId: string;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content: string;
  isStreaming: boolean;

  // tool/question fields (align with JSAPI field names)
  toolName?: string;
  toolCallId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  input?: object;
  output?: string;
  title?: string;

  // question-specific
  header?: string;
  question?: string;
  options?: string[];
  answered?: boolean;

  // permission-specific
  permissionId?: string;
  permType?: string;
  permResolved?: boolean;

  // file-specific
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

/** A single message in the conversation */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
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
  contentType?: 'plain' | 'markdown' | 'code' | string | null;
  meta?: object | null;
  createdAt?: string;
  parts?: MessagePartSnapshot[];
}

/** Part snapshot for streaming recovery */
export interface MessagePartSnapshot {
  partId: string;
  partSeq?: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content?: string | null;
  toolName?: string | null;
  toolCallId?: string | null;
  status?: string | null;
  input?: object | null;
  output?: string | null;
  error?: string | null;
  title?: string | null;
  header?: string | null;
  question?: string | null;
  options?: string[] | null;
  permissionId?: string | null;
  permType?: string | null;
  metadata?: object | null;
  response?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  fileMime?: string | null;
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

export interface SendMessageResponse {
  id: string;
  welinkSessionId: string;
  seq: number | null;
  messageSeq: number | null;
  role: 'user' | 'assistant' | string;
  content: string | null;
  contentType: 'plain' | 'markdown' | string | null;
  createdAt: string;
  meta: object | null;
  parts: SessionMessagePart[] | null;
}

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
  response: 'once' | 'always' | 'reject';
}

export interface RegenerateAnswerResponse {
  id: string;
  welinkSessionId: string;
  seq: number | null;
  messageSeq: number | null;
  role: 'user' | 'assistant' | string;
  content: string | null;
  contentType: 'plain' | 'markdown' | string | null;
  createdAt: string;
  meta: object | null;
  parts: SessionMessagePart[] | null;
}

export interface ControlSkillWeCodeResponse {
  status: 'success' | 'failed';
}
