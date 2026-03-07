# Skill SDK for HarmonyOS - API 参考

本文档提供 Skill SDK for HarmonyOS 的完整 API 参考。

## 目录

- [类和方法](#类和方法)
  - [SkillSDK](#skill-sdk)
  - [配置](#配置)
  - [会话管理](#会话管理)
  - [消息管理](#消息管理)
  - [监听器管理](#监听器管理)
  - [状态管理](#状态管理)
  - [小程序控制](#小程序控制)
- [类型定义](#类型定义)
- [枚举](#枚举)
- [接口](#接口)

---

## 类和方法

### SkillSDK

SDK 主类，单例模式。

#### 静态方法

##### `getInstance(config?: SkillSDKConfig): SkillSDK`

获取 SDK 单例实例。

**参数**：
- `config` (可选): SDK 配置对象

**返回值**：
- `SkillSDK`: SDK 实例

**示例**：
```typescript
const config: SkillSDKConfig = {
  baseUrl: 'http://192.168.1.100:8082',
  wsUrl: 'ws://192.168.1.100:8082/ws/skill/stream',
  enableLog: true
};

const skillSDK = SkillSDK.getInstance(config);
```

##### `destroyInstance(): void`

销毁 SDK 实例，清理所有资源。

**示例**：
```typescript
SkillSDK.destroyInstance();
```

---

### 配置

#### SkillSDKConfig

SDK 配置接口。

**属性**：

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| baseUrl | string | 是 | - | REST API 基础 URL |
| wsUrl | string | 是 | - | WebSocket URL |
| timeout | number | 否 | 30000 | 请求超时时间（毫秒） |
| enableLog | boolean | 否 | false | 是否启用日志 |

---

### 会话管理

#### executeSkill(params: ExecuteSkillParams): Promise\<SkillSession\>

执行技能，创建会话并发送首条消息。

**参数**：
- `params`: 执行技能参数

**返回值**：
- `Promise<SkillSession>`: 会话对象

**示例**：
```typescript
const session = await skillSDK.executeSkill({
  imChatId: 'chat-001',
  skillDefinitionId: 1,
  userId: 'user-001',
  skillContent: '你好',
  agentId: 99,           // 可选
  title: '代码分析'       // 可选
});
```

#### closeSkill(params: CloseSkillParams): Promise\<CloseSkillResult\>

关闭会话，释放所有相关资源。

**参数**：
- `params`: 关闭技能参数

**返回值**：
- `Promise<CloseSkillResult>`: 关闭结果

**示例**：
```typescript
const result = await skillSDK.closeSkill({
  sessionId: '42'
});
```

#### stopSkill(params: StopSkillParams): Promise\<StopSkillResult\>

停止接收消息，但保持会话连接。

**参数**：
- `params`: 停止技能参数

**返回值**：
- `Promise<StopSkillResult>`: 停止结果

**示例**：
```typescript
const result = await skillSDK.stopSkill({
  sessionId: '42'
});
```

---

### 消息管理

#### sendMessage(params: SendMessageParams): Promise\<SendMessageResult\>

发送用户消息，触发 AI 响应。

**参数**：
- `params`: 发送消息参数

**返回值**：
- `Promise<SendMessageResult>`: 发送结果

**示例**：
```typescript
const result = await skillSDK.sendMessage({
  sessionId: '42',
  content: '请继续分析'
});
```

#### getSessionMessage(params: GetSessionMessageParams): Promise\<PageResult\<ChatMessage\>\>

获取会话消息列表，支持分页和流式消息合并。

**参数**：
- `params`: 获取消息参数

**返回值**：
- `Promise<PageResult<ChatMessage>>`: 分页消息结果

**示例**：
```typescript
const result = await skillSDK.getSessionMessage({
  sessionId: '42',
  page: 0,
  size: 50
});
```

#### regenerateAnswer(params: RegenerateAnswerParams): Promise\<AnswerResult\>

重新生成回答。

**参数**：
- `params`: 重新生成参数

**返回值**：
- `Promise<AnswerResult>`: 回答结果

**示例**：
```typescript
const result = await skillSDK.regenerateAnswer({
  sessionId: '42',
  content: '请重新分析'
});
```

#### sendMessageToIM(params: SendMessageToIMParams): Promise\<SendMessageToIMResult\>

发送消息到 IM 客户端。

**参数**：
- `params`: 发送到 IM 参数

**返回值**：
- `Promise<SendMessageToIMResult>`: 发送结果

**示例**：
```typescript
const result = await skillSDK.sendMessageToIM({
  sessionId: '42',
  content: '分析完成'
});
```

---

### 监听器管理

#### registerSessionListener(params: RegisterSessionListenerParams): void

注册会话监听器，接收 WebSocket 推送消息。

**参数**：
- `params`: 注册监听器参数

**示例**：
```typescript
skillSDK.registerSessionListener({
  sessionId: '42',
  onMessage: (message) => {
    console.log('收到消息:', message);
  },
  onError: (error) => {
    console.error('错误:', error);
  },
  onClose: (reason) => {
    console.log('关闭:', reason);
  }
});
```

#### unregisterSessionListener(params: UnregisterSessionListenerParams): void

移除会话监听器。

**参数**：
- `params`: 移除监听器参数

**示例**：
```typescript
skillSDK.unregisterSessionListener({
  sessionId: '42',
  onMessage: callback,
  onError: errorCallback,
  onClose: closeCallback
});
```

---

### 状态管理

#### onSessionStatusChange(params: OnSessionStatusChangeParams): void

监听会话状态变更。

**参数**：
- `params`: 状态变更参数

**示例**：
```typescript
skillSDK.onSessionStatusChange({
  sessionId: '42',
  callback: (result) => {
    console.log('状态:', result.status);
  }
});
```

#### onSkillWecodeStatusChange(params: OnSkillWecodeStatusChangeParams): void

监听小程序状态变更。

**参数**：
- `params`: 小程序状态变更参数

**示例**：
```typescript
skillSDK.onSkillWecodeStatusChange({
  callback: (result) => {
    console.log('小程序状态:', result.status);
  }
});
```

---

### 小程序控制

#### controlSkillWeCode(params: ControlSkillWeCodeParams): Promise\<ControlSkillWeCodeResult\>

控制小程序（关闭/最小化）。

**参数**：
- `params`: 控制参数

**返回值**：
- `Promise<ControlSkillWeCodeResult>`: 控制结果

**示例**：
```typescript
// 关闭小程序
await skillSDK.controlSkillWeCode({
  action: SkillWeCodeAction.CLOSE
});

// 最小化小程序
await skillSDK.controlSkillWeCode({
  action: SkillWeCodeAction.MINIMIZE
});
```

#### replyPermission(params: ReplyPermissionParams): Promise\<ReplyPermissionResult\>

回复权限确认请求。

**参数**：
- `params`: 权限确认参数

**返回值**：
- `Promise<ReplyPermissionResult>`: 权限确认结果

**示例**：
```typescript
const result = await skillSDK.replyPermission({
  sessionId: '42',
  permissionId: 'perm-001',
  approved: true
});
```

---

## 类型定义

### 枚举

#### SessionStatus

会话状态枚举。

```typescript
enum SessionStatus {
  EXECUTING = 'executing',   // 执行中
  STOPPED = 'stopped',       // 已停止
  COMPLETED = 'completed'    // 已完成
}
```

#### SkillWecodeStatus

小程序状态枚举。

```typescript
enum SkillWecodeStatus {
  CLOSED = 'closed',         // 已关闭
  MINIMIZED = 'minimized'    // 已最小化
}
```

#### SkillWeCodeAction

小程序操作类型枚举。

```typescript
enum SkillWeCodeAction {
  CLOSE = 'close',           // 关闭
  MINIMIZE = 'minimize'      // 最小化
}
```

#### MessageRole

消息角色枚举。

```typescript
enum MessageRole {
  USER = 'USER',             // 用户
  ASSISTANT = 'ASSISTANT',   // AI 助手
  SYSTEM = 'SYSTEM',         // 系统
  TOOL = 'TOOL'              // 工具
}
```

#### WebSocketMessageType

WebSocket 消息类型枚举。

```typescript
enum WebSocketMessageType {
  DELTA = 'delta',                 // 增量内容
  DONE = 'done',                   // 处理完成
  ERROR = 'error',                 // 错误
  AGENT_OFFLINE = 'agent_offline', // Agent 离线
  AGENT_ONLINE = 'agent_online'    // Agent 上线
}
```

---

### 接口

#### ExecuteSkillParams

执行技能参数。

```typescript
interface ExecuteSkillParams {
  imChatId: string;              // IM 聊天 ID
  skillDefinitionId: number;     // 技能定义 ID
  userId: string;                // 用户 ID
  skillContent: string;          // 技能内容
  agentId?: number;              // Agent ID（可选）
  title?: string;                // 会话标题（可选）
}
```

#### SkillSession

技能会话。

```typescript
interface SkillSession {
  id: number;                    // 会话 ID
  userId: number;                // 用户 ID
  skillDefinitionId: number;     // 技能定义 ID
  agentId?: number;              // Agent ID
  toolSessionId?: string;        // 工具会话 ID
  title?: string;                // 会话标题
  status: string;                // 会话状态
  imChatId?: string;             // IM 聊天 ID
  createdAt: string;             // 创建时间
  lastActiveAt: string;          // 最后活跃时间
}
```

#### ChatMessage

聊天消息。

```typescript
interface ChatMessage {
  id: number | string;           // 消息 ID
  sessionId: number;             // 会话 ID
  seq: number;                   // 消息序号
  role: string;                  // 消息角色
  content: string;               // 消息内容
  contentType: string;           // 内容类型
  createdAt: string;             // 创建时间
  meta?: string;                 // 元数据
}
```

#### StreamMessage

流式消息。

```typescript
interface StreamMessage {
  sessionId: string;             // 会话 ID
  type: string;                  // 消息类型
  seq: number;                   // 消息序号
  content: string | object;      // 消息内容
  usage?: TokenUsage;            // Token 用量
}
```

#### TokenUsage

Token 用量统计。

```typescript
interface TokenUsage {
  inputTokens: number;           // 输入 Token 数
  outputTokens: number;          // 输出 Token 数
}
```

#### SessionError

会话错误。

```typescript
interface SessionError {
  code: string;                  // 错误码
  message: string;               // 错误消息
  timestamp: number;             // 时间戳
}
```

#### PageResult\<T\>

分页结果。

```typescript
interface PageResult<T> {
  content: T[];                  // 数据列表
  totalElements: number;         // 总记录数
  totalPages: number;            // 总页数
  number: number;                // 当前页码
  size: number;                  // 每页大小
}
```

#### SessionListener

会话监听器。

```typescript
interface SessionListener {
  onMessage: (message: StreamMessage) => void;     // 消息回调
  onError?: (error: SessionError) => void;         // 错误回调
  onClose?: (reason: string) => void;              // 关闭回调
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| NETWORK_ERROR | 网络错误 |
| TIMEOUT | 请求超时 |
| SESSION_NOT_FOUND | 会话不存在 |
| SESSION_CLOSED | 会话已关闭 |
| WEBSOCKET_ERROR | WebSocket 错误 |
| CONTENT_EMPTY | 消息内容为空 |
| INVALID_PARAMS | 参数无效 |
| UNAUTHORIZED | 未授权 |

---

## 相关文档

- [QUICK_START.md](./QUICK_START.md) - 快速开始指南
- [EXAMPLES.md](./EXAMPLES.md) - 完整示例
- [Skill_SDK_接口文档.md](../Skill_SDK_接口文档.md) - 完整接口文档
