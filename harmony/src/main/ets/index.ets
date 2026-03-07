/**
 * Skill SDK 鸿蒙平台入口模块
 * 导出所有公共类型和API
 */

// 类型定义
export {
  // 枚举类型
  SessionStatus,
  SkillWecodeStatus,
  SkillWeCodeAction,
  MessageRole,
  ContentType,
  SessionState,

  // 接口类型
  StreamUsage,
  StreamMessageContent,
  StreamMessage,
  ChatMessage,
  SkillSession,
  PageResult,
  SessionError,

  // 参数类型
  ExecuteSkillParams,
  CloseSkillParams,
  StopSkillParams,
  OnSessionStatusChangeParams,
  OnSkillWecodeStatusChangeParams,
  RegenerateAnswerParams,
  SendMessageToIMParams,
  GetSessionMessageParams,
  RegisterSessionListenerParams,
  UnregisterSessionListenerParams,
  SendMessageParams,
  ReplyPermissionParams,
  ControlSkillWeCodeParams,

  // 返回类型
  ExecuteSkillResult,
  CloseSkillResult,
  StopSkillResult,
  SessionStatusResult,
  SkillWecodeStatusResult,
  AnswerResult,
  SendMessageToIMResult,
  SendMessageResult,
  ReplyPermissionResult,
  ControlSkillWeCodeResult,

  // 其他类型
  PermissionRequest,
  CloseSessionResponse,
  SendToIMResponse,
  PermissionResponse,
  CreateSessionRequest,
  SendMessageRequest,
  ReplyPermissionRequest,
  ErrorResponse,
  SkillSDKConfig
} from './types';

// 回调类型
export type {
  SessionStatusCallback,
  SkillWecodeStatusCallback,
  StreamMessageCallback
} from './types';

// API 函数
export {
  init,
  executeSkill,
  closeSkill,
  stopSkill,
  onSessionStatusChange,
  onSkillWecodeStatusChange,
  regenerateAnswer,
  sendMessageToIM,
  getSessionMessage,
  registerSessionListener,
  unregisterSessionListener,
  sendMessage,
  replyPermission,
  controlSkillWeCode
} from './api/skill-api';