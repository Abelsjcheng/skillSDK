// ============================================================
// StreamMessage Protocol Type Definitions
// Based on 小程序JSAPI接口文档.md & 01-layer1-miniapp-skill-api.md
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

/**
 * StreamMessage delivered from SessionListener onMessage callback.
 * 参考: 小程序JSAPI接口文档.md - registerSessionListener
 */
export interface StreamMessage {
  // 传输层字段 (所有消息都有)
  type: StreamMessageType;
  seq: number;
  welinkSessionId: string;
  emittedAt: string;
  raw?: object;

  // 消息层字段 (归属到某条聊天气泡的事件)
  messageId?: string;
  messageSeq?: number;
  role?: 'user' | 'assistant' | 'system' | 'tool';

  // Part 层字段 (归属到消息中某个部件的事件)
  partId?: string;
  partSeq?: number;
  content?: string;

  // Tool fields (tool.update)
  toolName?: string;
  toolCallId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  input?: object;
  output?: string;
  error?: string;
  title?: string;

  // Question fields
  header?: string;
  question?: string;
  options?: string[];

  // Permission fields
  permissionId?: string;
  permType?: string;
  metadata?: object;
  response?: 'once' | 'always' | 'reject';

  // Session status
  sessionStatus?: 'busy' | 'idle' | 'retry';

  // Step fields
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;
  reason?: string;

  // File fields
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;

  // Snapshot/Streaming fields
  messages?: SessionMessageSnapshot[];
  parts?: MessagePartSnapshot[];
}

// ============================================================
// SessionMessage - 历史消息结构
// 参考: 小程序JSAPI接口文档.md - getSessionMessage
// ============================================================

export interface SessionMessage {
  id: number;
  welinkSessionId: number;
  userId: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  messageSeq: number;
  parts: SessionMessagePart[];
  createdAt: string;
}

export interface SessionMessagePart {
  partId: string;
  partSeq: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content: string;

  // Tool-specific
  toolName?: string;
  toolCallId?: string;
  toolStatus?: 'pending' | 'running' | 'completed' | 'error';
  toolInput?: object;
  toolOutput?: string;

  // Question-specific
  header?: string;
  question?: string;
  options?: string[];

  // Permission-specific
  permissionId?: string;

  // File-specific
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
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

  // Tool-specific
  toolName?: string;
  toolCallId?: string;
  toolStatus?: 'pending' | 'running' | 'completed' | 'error';
  toolInput?: object;
  toolOutput?: string;
  toolTitle?: string;

  // Question-specific
  header?: string;
  question?: string;
  options?: string[];
  answered?: boolean;

  // Permission-specific
  permissionId?: string;
  permType?: string;
  permResolved?: boolean;

  // File-specific
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
  seq: number;
  role: string;
  content: string;
  contentType?: 'plain' | 'markdown' | 'code';
  createdAt?: string;
  parts?: MessagePartSnapshot[];
}

/** Part snapshot for streaming recovery */
export interface MessagePartSnapshot {
  partId: string;
  partSeq?: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  status?: string;
  header?: string;
  question?: string;
  options?: string[];
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

// ============================================================
// App State Types
// ============================================================

export interface ChatState {
  welinkSessionId: number | null;
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
  id: number;
  welinkSessionId: number;
  userId: string;
  role: 'user';
  content: string;
  messageSeq: number;
  createdAt: string;
}

export interface GetSessionMessageResponse {
  content: SessionMessage[];
  page: number;
  size: number;
  total: number;
}

export interface StopSkillResponse {
  welinkSessionId: number;
  status: 'aborted';
}

export interface SendMessageToIMResponse {
  status: 'success' | 'failed';
}

export interface ReplyPermissionResponse {
  welinkSessionId: number;
  permissionId: string;
  response: 'once' | 'always' | 'reject';
}

export interface RegenerateAnswerResponse {
  id: number;
  welinkSessionId: number;
  userId: string;
  role: 'user';
  content: string;
  messageSeq: number;
  createdAt: string;
}

export interface ControlSkillWeCodeResponse {
  status: 'success' | 'failed';
}