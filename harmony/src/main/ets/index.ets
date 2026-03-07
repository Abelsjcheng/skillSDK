/**
 * Skill SDK for HarmonyOS
 * 鸿蒙ArkTS SDK入口文件
 * 
 * @version 1.0.0
 * @description 用于IM客户端、OpenCode Skill服务端、小程序间交互的鸿蒙ArkTS SDK
 */

// 导出主类
export { SkillSDK } from './sdk/SkillSDK';

// 导出所有类型
export {
  // 枚举
  SessionStatus,
  SkillWecodeStatus,
  SkillWeCodeAction,
  MessageRole,
  ContentType,
  WebSocketMessageType,
  
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
  
  // 响应类型
  SkillSession,
  ChatMessage,
  StreamMessage,
  TokenUsage,
  SessionError,
  SessionStatusResult,
  SkillWecodeStatusResult,
  SendMessageToIMResult,
  SendMessageResult,
  CloseSkillResult,
  StopSkillResult,
  AnswerResult,
  ReplyPermissionResult,
  ControlSkillWeCodeResult,
  PageResult,
  PermissionRequest,
  SessionListener,
  
  // 配置类型
  SkillSDKConfig
} from './sdk/types';