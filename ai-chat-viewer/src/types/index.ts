export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type SessionStatus = 'busy' | 'idle' | 'retry' | 'unknown';

export type AgentStatus = 'online' | 'offline' | 'unknown';

export type PartType = 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';

export type PermissionResponse = 'once' | 'always' | 'reject';

export interface SessionMessagePart {
  partId?: string;
  partSeq?: number;
  type?: string;
  content?: string;
  toolName?: string;
  toolCallId?: string;
  toolStatus?: 'pending' | 'running' | 'completed' | 'error';
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  question?: string;
  options?: string[];
  header?: string;
  permissionId?: string;
  permType?: string;
  response?: PermissionResponse;
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface SessionMessage {
  id?: number | string;
  welinkSessionId?: number;
  userId?: string | null;
  role?: MessageRole;
  content?: string;
  messageSeq?: number;
  parts?: SessionMessagePart[];
  createdAt?: string;
}

export interface GetSessionMessageResult {
  content?: SessionMessage[];
  page?: number;
  size?: number;
  total?: number;
}

export interface SnapshotMessage {
  id?: number | string;
  seq?: number;
  role?: MessageRole;
  content?: string;
  contentType?: 'plain' | 'markdown' | 'code';
  createdAt?: string;
  parts?: SessionMessagePart[];
}

export interface StreamingPart {
  partId?: string;
  partSeq?: number;
  type?: string;
  content?: string;
  toolName?: string;
  toolCallId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  header?: string;
  question?: string;
  options?: string[];
  permissionId?: string;
  permType?: string;
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface StreamMessage {
  type?: string;
  seq?: number;
  welinkSessionId?: string | number;
  emittedAt?: string;
  raw?: Record<string, unknown>;

  messageId?: string | number;
  messageSeq?: number;
  role?: MessageRole;

  partId?: string;
  partSeq?: number;
  content?: string;

  toolName?: string;
  toolCallId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;

  header?: string;
  question?: string;
  options?: string[];

  fileName?: string;
  fileUrl?: string;
  fileMime?: string;

  tokens?: Record<string, unknown>;
  cost?: number;
  reason?: string;

  sessionStatus?: SessionStatus;

  permissionId?: string;
  permType?: string;
  metadata?: Record<string, unknown>;
  response?: PermissionResponse;

  messages?: SnapshotMessage[];
  parts?: StreamingPart[];
}

export interface ChatMessagePart {
  partId: string;
  partSeq?: number;
  type: PartType;
  content: string;
  isStreaming: boolean;

  toolName?: string;
  toolCallId?: string;
  toolStatus?: 'pending' | 'running' | 'completed' | 'error';
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  toolTitle?: string;

  header?: string;
  question?: string;
  options?: string[];
  answered?: boolean;

  permissionId?: string;
  permType?: string;
  metadata?: Record<string, unknown>;
  permResolved?: boolean;
  response?: PermissionResponse;

  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface ChatMessage {
  localId: string;
  messageId?: number | string;
  messageSeq?: number;
  role: MessageRole;
  content: string;
  createdAt?: string;

  parts: ChatMessagePart[];

  completed: boolean;
  isStreaming: boolean;
  awaitingUserAction: boolean;
  stepRunning: boolean;

  meta?: {
    tokens?: Record<string, unknown>;
    cost?: number;
    reason?: string;
  };
}

export interface RegisterSessionListenerParams {
  welinkSessionId: number;
  onMessage: (message: StreamMessage) => void;
  onError?: (error: { errorCode?: number; errorMessage?: string }) => void;
  onClose?: (reason?: string) => void;
}

export interface Hwh5Ext {
  getSessionMessage: (params: {
    welinkSessionId: number;
    page?: number;
    size?: number;
  }) => Promise<GetSessionMessageResult>;
  registerSessionListener: (params: RegisterSessionListenerParams) => Promise<void> | void;
  unregisterSessionListener: (params: RegisterSessionListenerParams) => Promise<void> | void;
  sendMessage: (params: {
    welinkSessionId: number;
    content: string;
    toolCallId?: string;
  }) => Promise<SessionMessage>;
  stopSkill: (params: { welinkSessionId: number }) => Promise<{ status?: string }>;
  replyPermission: (params: {
    welinkSessionId: number;
    permId: string;
    response: PermissionResponse;
  }) => Promise<{ response?: PermissionResponse }>;
  sendMessageToIM: (params: {
    welinkSessionId: number;
    messageId?: number | string;
  }) => Promise<{ status?: 'success' | 'failed' }>;
  controlSkillWeCode: (params: {
    action: 'minimize' | 'close';
  }) => Promise<{ status?: 'success' | 'failed' }>;
}

declare global {
  interface Window {
    HWH5EXT?: Hwh5Ext;
  }
}
