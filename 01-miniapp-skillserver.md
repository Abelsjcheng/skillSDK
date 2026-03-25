This group is not allowed.# Layer 1：Skill Miniapp ↔ Skill Server 协议详解

## 概述

Miniapp（React SPA）与 Skill Server 之间通过两条通道通信：
- **REST API**（HTTP）：会话 CRUD、消息发送、权限回复、IM 转发
- **WebSocket 流**（`/ws/skill/stream`）：实时事件推送、流式内容

```
┌──────────────┐    REST (HTTP)     ┌──────────────┐
│              │ ──────────────────→ │              │
│  Skill       │                    │  Skill       │
│  Miniapp     │    WebSocket       │  Server      │
│  (React SPA) │ ←───────────────── │  :8082       │
└──────────────┘                    └──────────────┘
```

---

## 一、REST API 协议

### 1.1 统一响应信封

所有 REST 响应使用 `ApiResponse<T>` 包装：

```json
{
  "code": 0,           // 0=成功，非零=错误码
  "errormsg": null,    // 成功时为 null，错误时为描述
  "data": "<T>"        // 成功时为数据，错误时为 null
}
```

Miniapp 侧处理逻辑：
- HTTP status !== 2xx → 抛出 `ApiError`
- `code !== 0` → 抛出错误，使用 `errormsg` 作为消息
- `code === 0` → 返回 `data` 字段
- HTTP 204 → 返回 `undefined`
- 所有请求带 `credentials: 'include'`（传递 cookie）

### 1.2 技能定义查询

```
GET /api/skill/definitions
```

**响应：** `SkillDefinition[]`

```typescript
interface SkillDefinition {
  id: number;
  skillCode: string;       // 技能编码
  skillName: string;       // 技能名称
  toolType: string;        // 工具类型
  description?: string;    // 技能描述
  iconUrl?: string;        // 图标 URL
  status: string;          // 状态
}
```

### 1.3 Agent 查询

```
GET /api/skill/agents
```

**响应：** `AgentInfo[]`

```typescript
interface AgentInfo {
  id: string;
  userId?: string;
  ak: string;              // Agent Access Key（主要标识符）
  deviceName: string;      // 设备名称
  os: string;              // 操作系统
  toolType: string;        // 工具类型（如 "opencode"）
  toolVersion: string;     // 工具版本
  status: string;          // 状态（如 "ONLINE"）
}
```

**Miniapp 行为：**
- `useAgentSelector` hook 每 30 秒轮询一次
- 若只有 1 个 Agent 且未选择 → 自动选择
- 若当前选中 Agent 离线 → 切换到第一个在线 Agent 或清空

### 1.4 会话 CRUD

#### 创建会话

```
POST /api/skill/sessions
```

**请求体：**
```json
{
  "ak": "agent-access-key",     // 必需：Agent Key
  "title": "会话标题",            // 可选
  "bussinessDomain": "miniapp",   // 必需：会话关联场域
  "bussinessType": "direct",     // 必需：会话类型
  "bussinessId": "userAccount",   // 必需：对话所属人id
  "assistantAccount": "assistantAccount"   // 必需：分身账号id
}
```

**响应：** `SkillSession`

```typescript
interface Session {
  id: string;                    // welinkSessionId（Snowflake ID，字符串化）
  userId?: string;               // 会话所有者
  ak?: string;                   // Agent Key
  title: string;                 // 会话标题
  bussinessDomain: string;       // 会话关联场域
  bussinessType: string;         // 会话类型
  bussinessId: string;           // 对话所属人id
  assistantAccount: string;      // 分身账号id
  status: 'active' | 'idle' | 'closed';
  toolSessionId?: string;        // OpenCode 侧会话 ID（可能未就绪）
  createdAt: string;             // ISO 时间戳
  updatedAt: string;
}
```

> **后端扩展字段（Miniapp 前端未使用但 API 返回）：**
> - `businessSessionDomain`: "miniapp" | "im"（会话来源域）
> - `businessSessionType`: "group" | "direct"（会话类型）
> - `businessSessionId`: IM 会话 ID
> - `assistantAccount`: 关联的助手账号
>
> 这些字段由 V6 数据库迁移新增，用于 IM 入站消息场景。前端 `Session` 接口暂未映射这些字段。

```typescript
// 后端 SkillSession 完整结构（Java → JSON 序列化后）
{
  "welinkSessionId": number,            // @JsonProperty 映射自 id 字段
  "userId": string,
  "ak": string,
  "toolSessionId": string | null,
  "title": string,
  "status": "ACTIVE" | "IDLE" | "CLOSED",
  "businessSessionDomain": "miniapp" | "im",
  "businessSessionType": "group" | "direct" | null,
  "businessSessionId": string | null,
  "assistantAccount": string | null,
  "createdAt": string,                  // ISO timestamp
  "updatedAt": string                   // 映射自 lastActiveAt
}
```

**Skill Server 内部处理：**
1. 验证用户身份（`userId` cookie）
2. 创建 `SkillSession` 记录（Snowflake ID）
3. 若提供了 `ak` → 发送 `invoke(action=create_session)` 到 Gateway
4. 返回 Session（此时 `toolSessionId` 可能为 null，需等 Gateway 回复 `session_created`）

#### 查询会话列表

```
GET /api/skill/sessions?status=active&bussinessId=xxx&ak=xxx&page=0&size=20&assistantAccount=xxx
```

**查询参数：**
| 参数               | 类型   | 说明                         |
| ------------------ | ------ | ---------------------------- |
| `status`           | string | 按状态筛选                   |
| `ak`               | string | 按 Agent Key 筛选            |
| `bussinessId`      | string | 按 业务ID筛选（原imGroupId） |
| `assistantAccount` | string | 按 分身账号筛选              |
| `page`             | int    | 页码（从 0 开始）            |
| `size`             | int    | 每页大小                     |


**响应：** `PageResult<SkillSession>`

```json
{
  "content": [ /* Session[] */ ],
  "total": 100,        // 后端字段 totalElements，@JsonProperty("total") 序列化为 "total"
  "totalPages": 5,
  "page": 0,           // 后端字段 number，@JsonProperty("page") 序列化为 "page"
  "size": 20
}
```

> **注意：** Miniapp 的 TypeScript `PaginatedResponse` 接口定义了 `totalElements` 和 `number`，与后端实际 JSON 的 `total` 和 `page` 不一致。但代码中仅使用 `res.content`，该不一致不影响功能。

#### 查询单个会话

```
GET /api/skill/sessions/{id}
```

#### 关闭会话

```
DELETE /api/skill/sessions/{id}
```

**响应：** `{ "status": "closed", "welinkSessionId": "12345" }`

**Skill Server 内部处理：**
1. 验证会话所有权
2. 更新状态为 CLOSED
3. 发送 `invoke(action=close_session, payload={toolSessionId})` 到 Gateway

#### 中止会话

```
POST /api/skill/sessions/{id}/abort
```

**响应：** `{ "status": "aborted", "welinkSessionId": "12345" }`

**与关闭的区别：** 中止不关闭会话，仅停止当前执行（类似"取消"操作）。Skill Server 发送 `invoke(action=abort_session)` 到 Gateway，Plugin 调用 `client.session.abort()` SDK 方法。

> **注意：** 后端 endpoint 已实现，但前端 `api.ts` 未导出 `abortSession()` 函数。如需在 Miniapp 中使用中止功能，需补充前端 API 封装。

### 1.5 消息操作

#### 发送消息

```
POST /api/skill/sessions/{sessionId}/messages
```

**请求体：**
```json
{
  "content": "用户消息文本",      // 必需
  "toolCallId": "call_abc123"   // 可选：若提供则路由为 question_reply
}
```

**响应：** `ProtocolMessageView`（消息对象）

**Skill Server 内部路由逻辑：**
- **无 `toolCallId`** → 动作为 `chat`，payload = `{text, toolSessionId}`
- **有 `toolCallId`** → 动作为 `question_reply`，payload = `{answer, toolCallId, toolSessionId}`
- **无 `toolSessionId`** → 触发 Session 重建流程（缓存消息 → 广播 `session.status: retry` → 发送 `create_session`）

**Miniapp 侧行为（useSkillStream.sendMessage — 乐观更新模式）：**

> **乐观更新（Optimistic Update）：** 在服务端确认之前就先在 UI 上显示预期结果。好处是用户感知零延迟；如果请求失败则回滚。

1. 创建带临时 ID 的 user 消息对象，**立即**追加到消息列表（用户无感等待）
2. POST `/sessions/{id}/messages` 发送消息到后端
3. 成功 → 用服务端返回的真实 `messageId` 替换临时 ID
4. 将 `messageId` 加入 `knownUserMessageIdsRef`（防止 WebSocket 推送的同一消息重复显示）

#### 查询历史消息

```
GET /api/skill/sessions/{sessionId}/messages?page=0&size=50
```

**响应：** `PageResult<ProtocolMessageView>`

**Miniapp 侧 history 规范化（`normalizeHistoryMessage`）：**

| 后端字段           | 转换逻辑                                                   |
| ------------------ | ---------------------------------------------------------- |
| `id` / `messageId` | `String(id ?? messageId ?? 随机生成)`                      |
| `role`             | 标准化为 `user`/`assistant`/`system`/`tool`，默认 `system` |
| `content`          | 若消息无内容，从 `parts[type=text]` 拼接                   |
| `contentType`      | assistant → markdown, tool → code, 其他 → plain            |
| `createdAt`        | 解析为毫秒时间戳                                           |
| `parts`            | 逐个 `normalizePart()` 转换                                |
| `meta`             | 若为字符串则 JSON.parse                                    |

**Part 类型转换规则：**

| 后端 partType            | 转换为前端 type | 特殊处理                                                     |
| ------------------------ | --------------- | ------------------------------------------------------------ |
| `text`                   | `text`          | —                                                            |
| `thinking` / `reasoning` | `thinking`      | —                                                            |
| `tool`                   | `tool`          | 若 `toolName=question` 且 `status=running` → 转为 `question` |
| `question`               | `question`      | 提取 options                                                 |
| `permission`             | `permission`    | 判断 `permResolved` 状态                                     |
| `file`                   | `file`          | —                                                            |

### 1.6 权限回复

```
POST /api/skill/sessions/{sessionId}/permissions/{permId}
```

**请求体：**
```json
{
  "response": "once"    // "once" | "always" | "reject"
}
```

**响应：**
```json
{
  "welinkSessionId": "12345",
  "permissionId": "perm_abc",
  "response": "once"
}
```

**Skill Server 内部处理：**
1. 构造 `invoke(action=permission_reply, payload={permissionId, response, toolSessionId})`
2. 发送到 Gateway
3. 同时推送 `permission.reply` StreamMessage 到前端 WebSocket

### 1.7 发送到 IM

```
POST /api/skill/sessions/{sessionId}/send-to-im
```

**请求体：**
```json
{
  "content": "要发送的内容",    // 必需
  "chatId": "im-chat-123"     // 可选：IM 会话 ID（缺省用 session.businessSessionId）
}
```

**响应：** 200 OK + `ApiResponse<{"success": true}>`

> **注意：** 后端返回标准 `ApiResponse` 包装（HTTP 200），不是 204 No Content。前端 `sendToIm()` 返回 `Promise<void>`，成功时忽略响应体。

**Miniapp 侧行为（useSendToIm）：**
- 发送中状态 → success 状态（3 秒自动清除）→ 或 error 状态

---

## 二、WebSocket 流协议

### 2.1 连接

**地址：** `ws(s)://{host}/ws/skill/stream`
**认证：** `userId` cookie（由 `SkillStreamHandler` 在 `afterConnectionEstablished` 中提取）

**Miniapp 连接管理：**
- 自动重连：指数退避，`delay = min(2^attempt × 1000ms, 30000ms)`
- 切换 session 时：加载历史消息 → 发送 `{action: "resume"}` 触发状态同步

**Skill Server 连接管理：**
- 连接建立时注册为该用户的 subscriber
- 首次连接时 subscribe Redis `user-stream:{userId}` 频道
- 发送 `snapshot`（全量消息历史）+ `streaming`（当前流式状态）
- 断开时 unregister，最后一个连接断开时 unsubscribe Redis

### 2.2 StreamMessage 完整结构

```typescript
interface StreamMessage {
  // ── 类型与路由 ──
  type: StreamMessageType;                // 必需：消息类型
  seq?: number;                           // 传输序列号（per-session AtomicLong）
  welinkSessionId?: string | number;      // 会话 ID
  emittedAt?: string;                     // ISO 8601 时间戳
  raw?: unknown;                          // 原始 OpenCode 事件

  // ── 消息标识 ──
  messageId?: string;                     // 消息唯一 ID
  messageSeq?: number;                    // 消息级序列号（UI 排序）
  role?: 'user' | 'assistant' | 'system' | 'tool';
  sourceMessageId?: string;               // 等同 messageId

  // ── 内容分片 ──
  partId?: string;                        // 分片 ID（多分片消息）
  partSeq?: number;                       // 分片序列号
  content?: string;                       // 文本内容

  // ── 工具执行 ──
  toolName?: string;                      // 工具名称（bash, read, write 等）
  toolCallId?: string;                    // 工具调用 ID
  status?: 'pending' | 'running' | 'completed' | 'error';
  input?: Record<string, unknown>;        // 工具输入参数
  output?: string;                        // 工具输出结果
  title?: string;                         // 工具执行标题

  // ── 交互提问 ──
  header?: string;                        // 问题标题
  question?: string;                      // 问题内容
  options?: QuestionOption[];              // 选项列表（后端 List<String>，前端经 normalizeQuestionOptions() 规范化为 QuestionOption[]）

  // ── 权限 ──
  permissionId?: string;                  // 权限请求 ID
  permType?: string;                      // 权限类型
  metadata?: Record<string, unknown>;     // 权限元数据
  response?: string;                      // 权限回复

  // ── Token 统计 ──
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;                          // 费用
  reason?: string;                        // 完成原因（stop/length/tool_calls）

  // ── 会话状态 ──
  sessionStatus?: 'busy' | 'idle' | 'retry' | 'completed';
  error?: string;                         // 错误描述

  // ── 文件 ──
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;

  // ── 快照恢复 ──
  messages?: Array<Record<string, unknown>>;  // snapshot: 全量历史
  parts?: Array<Record<string, unknown>>;     // streaming: 恢复流式分片
}

interface QuestionOption {
  label: string;
  description?: string;
}
```

### 2.3 Skill Server 侧 StreamMessage 模型（Java）

Skill Server 使用 `@JsonUnwrapped` 将嵌套对象展平为 JSON：

```java
class StreamMessage {
  String type;
  Long seq;
  String sessionId;                 // @JsonIgnore，内部使用
  @JsonProperty("welinkSessionId")  // 序列化时映射 sessionId
  String emittedAt;
  Object raw;

  String messageId, role, sourceMessageId;
  Integer messageSeq;
  String partId, content;
  Integer partSeq;
  String status, title, error, sessionStatus;
  List<Object> messages, parts;

  @JsonUnwrapped ToolInfo tool;          // → toolName, toolCallId, input, output
  @JsonUnwrapped PermissionInfo permission; // → permissionId, permType, metadata, response
  @JsonUnwrapped QuestionInfo questionInfo; // → header, question, options
  @JsonUnwrapped UsageInfo usage;        // → tokens, cost, reason
  @JsonUnwrapped FileInfo file;          // → fileName, fileUrl, fileMime
}
```

### 2.4 消息类型详解

#### 2.4.1 `text.delta` — 流式文本增量

**方向：** Server → Client
**触发：** OpenCode 生成文本的增量片段

```json
{
  "type": "text.delta",
  "welinkSessionId": "12345",
  "messageId": "msg_001",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "part_text_1",
  "partSeq": 0,
  "content": "你好，"
}
```

**Miniapp 处理（StreamAssembler）：**
1. 获取/创建 `partId` 对应的 MessagePart（type=text）
2. 追加 `content` 到该 Part
3. 标记 `isStreaming = true`
4. 更新 `activeMessageIdsRef`
5. 触发 UI 重渲染

#### 2.4.2 `text.done` — 文本完成

**方向：** Server → Client
**触发：** 一个文本片段的完整内容已确定

```json
{
  "type": "text.done",
  "messageId": "msg_001",
  "partId": "part_text_1",
  "partSeq": 0,
  "content": "你好，我是 AI 助手。"
}
```

**Miniapp 处理（StreamAssembler）：**
1. 若 `msg.content` 存在 → 替换为完整内容（否则保持增量拼接结果）
2. 标记 `isStreaming = false`
3. 从 `activeMessageIdsRef` 移除（若无其他活跃 Part）

#### 2.4.3 `thinking.delta` — 思考过程增量

**方向：** Server → Client
**触发：** Claude Extended Thinking 产生推理过程

```json
{
  "type": "thinking.delta",
  "messageId": "msg_001",
  "partId": "part_thinking_1",
  "partSeq": 0,
  "content": "让我分析一下这个问题..."
}
```

**处理：** 与 `text.delta` 相同，但 Part type 为 `thinking`。

#### 2.4.4 `thinking.done` — 思考完成

处理方式与 `text.done` 相同，Part type 为 `thinking`。

#### 2.4.5 `tool.update` — 工具状态变更

**方向：** Server → Client
**触发：** OpenCode 调用工具（bash、read、write、edit 等）的状态变化

**pending（排队中）：**
```json
{
  "type": "tool.update",
  "messageId": "msg_001",
  "partId": "part_tool_1",
  "partSeq": 1,
  "toolName": "bash",
  "toolCallId": "call_abc123",
  "status": "pending",
  "title": "执行命令: ls -la",
  "input": { "command": "ls -la" }
}
```

**running（执行中）：**
```json
{
  "type": "tool.update",
  "toolCallId": "call_abc123",
  "status": "running"
}
```

**completed（完成）：**
```json
{
  "type": "tool.update",
  "toolCallId": "call_abc123",
  "status": "completed",
  "output": "total 24\ndrwxr-xr-x  6 user ...",
  "title": "执行命令: ls -la"
}
```

**error（错误）：**
```json
{
  "type": "tool.update",
  "toolCallId": "call_abc123",
  "status": "error",
  "content": "Command timed out after 120000ms"
}
```

**Miniapp 处理（StreamAssembler）：**
1. 创建/获取 Part（type=tool）
2. 更新字段：`toolName, toolCallId, toolStatus, toolTitle, toolInput, toolOutput`
3. `isStreaming = (status === 'pending' || status === 'running')`
4. 若 `error` 存在 → 存入 `content`

**UI 渲染（ToolUseRenderer）：**
- 标题格式：`"Tool: {toolName} [{状态标签}]"`
- 状态标签映射：pending→等待中, running→运行中..., completed→完成, error→错误
- 内容：优先显示 output（JSON 美化），其次 input，最后空

#### 2.4.6 `question` — 交互式提问

**方向：** Server → Client
**触发：** OpenCode 需要用户输入（如确认操作）

```json
{
  "type": "question",
  "messageId": "msg_001",
  "partId": "part_question_1",
  "toolName": "question",
  "toolCallId": "call_q1",
  "status": "running",
  "header": "用户确认",
  "question": "是否继续执行该操作？",
  "options": ["是", "否"]
}
```

**Miniapp 处理（StreamAssembler）：**
1. 创建 Part（type=question）
2. 提取 `header, question, options`
3. `content = question` 文本
4. `isStreaming = false`（问题立即显示完整）
5. 若 `status=completed/error` → `answered = true`

**用户回复流程：**
- 用户选择/输入后 → `sendMessage(answer, { toolCallId: "call_q1" })`
- POST `/sessions/{id}/messages` 带 `toolCallId`
- Skill Server 路由为 `question_reply` 动作

#### 2.4.7 `file` — 文件附件

**方向：** Server → Client

```json
{
  "type": "file",
  "messageId": "msg_001",
  "partId": "part_file_1",
  "fileName": "output.png",
  "fileUrl": "/files/output.png",
  "fileMime": "image/png"
}
```

**Miniapp 处理：** 创建 Part（type=file），`isStreaming = false`。

#### 2.4.8 `step.start` — 步骤开始

**方向：** Server → Client
**触发：** OpenCode 开始一个处理步骤

```json
{
  "type": "step.start",
  "messageId": "msg_001"
}
```

**Miniapp 处理：**
- **不创建 MessagePart**
- 将 `messageId` 加入 `activeMessageIdsRef`
- 设置 `isStreaming = true`

#### 2.4.9 `step.done` — 步骤完成

**方向：** Server → Client
**触发：** 一个处理步骤完成，包含 Token 统计

```json
{
  "type": "step.done",
  "messageId": "msg_001",
  "tokens": {
    "input": 1500,
    "output": 800,
    "reasoning": 2000,
    "cache": { "read": 500, "write": 200 }
  },
  "cost": 0.0125,
  "reason": "stop"
}
```

**Miniapp 处理：**
- **不创建 MessagePart**
- 更新 `message.meta` 中的 `tokens, cost, reason`

#### 2.4.10 `session.status` — 会话状态变更

**方向：** Server → Client
**触发：** 会话整体状态变化

```json
{
  "type": "session.status",
  "welinkSessionId": "12345",
  "sessionStatus": "idle"
}
```

**`sessionStatus` 取值及含义：**

| 值          | 含义           | Miniapp 处理                                                                                          |
| ----------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `busy`      | Agent 正在处理 | `setIsStreaming(true)`                                                                                |
| `idle`      | Agent 处理完毕 | `finalizeAllStreamingMessages()` — 所有 assembler 调用 `complete()`，所有 Part 的 `isStreaming=false` |
| `retry`     | Session 重建中 | `setIsStreaming(true)`                                                                                |
| `completed` | 会话彻底结束   | 同 `idle`                                                                                             |

**`finalizeAllStreamingMessages()` 详细逻辑：**
1. 遍历所有活跃 `assemblerRef`
2. 每个 assembler 调用 `complete()` → 所有 Part `isStreaming = false`
3. 清空 `activeMessageIdsRef`
4. `setIsStreaming(false)`

#### 2.4.11 `session.title` — 标题更新

```json
{
  "type": "session.title",
  "welinkSessionId": "12345",
  "title": "讨论项目架构设计"
}
```

#### 2.4.12 `session.error` — 会话错误

```json
{
  "type": "session.error",
  "welinkSessionId": "12345",
  "error": "Agent connection lost"
}
```

**Miniapp 处理：** `finalizeAllStreamingMessages()` + `setError(msg.error)`

#### 2.4.13 `permission.ask` — 权限请求

**方向：** Server → Client
**触发：** OpenCode 需要用户授权某个操作

```json
{
  "type": "permission.ask",
  "messageId": "msg_001",
  "partId": "part_perm_1",
  "permissionId": "perm_abc123",
  "permType": "file_write",
  "toolName": "write",
  "title": "请求写入文件: /src/main.ts",
  "metadata": {
    "path": "/src/main.ts",
    "operation": "write"
  }
}
```

**Miniapp 处理（StreamAssembler）：**
1. 创建 Part（type=permission）
2. 设置 `permissionId, permType, toolName`
3. `content = msg.title ?? msg.content`
4. `permResolved = false`
5. `isStreaming = false`

**用户响应流程：**
- 用户点击"允许一次"/"始终允许"/"拒绝"
- 调用 `replyPermission(permId, 'once'|'always'|'reject')`
- POST `/sessions/{id}/permissions/{permId}`

#### 2.4.14 `permission.reply` — 权限已回复

```json
{
  "type": "permission.reply",
  "permissionId": "perm_abc123",
  "response": "once"
}
```

**Miniapp 处理（StreamAssembler）：**
1. 查找已存在的权限 Part（按 `permissionId`）
2. 更新：`permResolved = true`, `permissionResponse = response`
3. `isStreaming = false`

#### 2.4.15 `agent.online` — Agent 上线

```json
{
  "type": "agent.online"
}
```

**Miniapp 处理：** `setAgentStatus('online')`

#### 2.4.16 `agent.offline` — Agent 离线

```json
{
  "type": "agent.offline"
}
```

**Miniapp 处理：** `setAgentStatus('offline')`

#### 2.4.17 `error` — 流错误

```json
{
  "type": "error",
  "error": "Internal server error"
}
```

**Miniapp 处理：** `finalizeAllStreamingMessages()` + `setError(msg.error)`

#### 2.4.18 `snapshot` — 全量消息快照

**方向：** Server → Client
**触发：** WebSocket 连接建立 / 重连

```json
{
  "type": "snapshot",
  "messages": [
    { "id": "msg_1", "role": "user", "content": "Hello", "createdAt": "..." },
    { "id": "msg_2", "role": "assistant", "parts": [...], "createdAt": "..." }
  ]
}
```

**Miniapp 处理：**
- 重置所有状态（assemblers, activeMessageIds, isStreaming）
- 用 `normalizeHistoryMessage()` 规范化每条消息
- 替换整个消息列表

#### 2.4.19 `streaming` — 恢复流式状态

**方向：** Server → Client
**触发：** 重连时有消息正在流式传输

```json
{
  "type": "streaming",
  "messageId": "msg_003",
  "parts": [
    { "partId": "text_1", "type": "text", "content": "正在回答...", "isStreaming": true },
    { "partId": "tool_1", "type": "tool", "toolName": "bash", "status": "running" }
  ]
}
```

**Miniapp 处理：**
- 将 `parts` 数组转换回 StreamMessage 流
- 重建对应的 StreamAssembler
- 恢复 `activeMessageIdsRef` 和 `isStreaming` 状态

---

## 三、StreamAssembler 详细行为

### 3.1 数据结构

```typescript
class StreamAssembler {
  private parts: Map<string, MessagePart>;     // partId → Part
  private partOrder: string[];                  // 插入顺序
}
```

### 3.2 消息类型到 Part 的映射

| StreamMessage type                                             | 创建 Part? | Part type    | isStreaming                                 |
| -------------------------------------------------------------- | ---------- | ------------ | ------------------------------------------- |
| `text.delta`                                                   | ✓          | `text`       | `true`                                      |
| `text.done`                                                    | ✓          | `text`       | `false`                                     |
| `thinking.delta`                                               | ✓          | `thinking`   | `true`                                      |
| `thinking.done`                                                | ✓          | `thinking`   | `false`                                     |
| `tool.update`                                                  | ✓          | `tool`       | `status=pending/running → true, 否则 false` |
| `question`                                                     | ✓          | `question`   | `false`                                     |
| `permission.ask`                                               | ✓          | `permission` | `false`                                     |
| `permission.reply`                                             | ✓          | `permission` | `false`                                     |
| `file`                                                         | ✓          | `file`       | `false`                                     |
| 其他（step.*, session.*, agent.*, error, snapshot, streaming） | ✗          | —            | —                                           |

### 3.3 partId 生成策略

优先级：
1. `msg.partId`（服务端提供）
2. 活跃的同类型 Part（如正在流式的 text Part）
3. 自动生成：`{type}_{序号}`（如 `text_1`, `thinking_1`, `tool_1`）

### 3.4 排序规则

- 若 `partSeq` 存在 → 按 `partSeq` 升序插入
- 否则 → 按插入时间顺序
- `getParts()` 返回排序后的 Part 数组

### 3.5 完整 MessagePart 结构

```typescript
interface MessagePart {
  partId: string;
  partSeq?: number;
  type: 'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file';
  content: string;
  isStreaming: boolean;

  // 工具专有
  toolName?: string;            // bash, read, write, edit, glob, grep...
  toolCallId?: string;          // 唯一调用 ID
  toolStatus?: 'pending' | 'running' | 'completed' | 'error';
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  toolTitle?: string;

  // 提问专有
  header?: string;
  question?: string;
  options?: QuestionOption[];    // WS 传输为 string[]，前端 normalize 为 QuestionOption[]
  answered?: boolean;

  // 权限专有
  permissionId?: string;
  permType?: string;
  permResolved?: boolean;
  permissionResponse?: string;

  // 文件专有
  fileName?: string;
  fileUrl?: string;
  fileMime?: string;
}
```

---

## 四、事件分类辅助函数

`OpenCodeEventParser` 提供事件分类：

```typescript
// 事件分类
classifyType(type): 'content' | 'tool' | 'session' | 'error' | 'unknown'
  content:  text.*, thinking.*
  tool:     tool.*, question, file
  session:  session.*, agent.*, permission.*, step.*
  error:    error

// 最终状态判断
isFinalState(msg): boolean
  text.done ✓ | thinking.done ✓ | session.status ✓ | step.done ✓
  tool.update && (status=completed || error) ✓

// 流式状态判断
isStreamingState(msg): boolean
  text.delta ✓ | thinking.delta ✓
  tool.update && (status=pending || running) ✓
```

---

## 五、完整交互时序示例

### 用户发送消息到 AI 回复完成

```
时间线                 Miniapp                        Skill Server               说明
───────────────────────────────────────────────────────────────────────────────────
T+0   sendMessage("你好")
      → 创建临时 user 消息
      → POST /sessions/{id}/messages
                                    持久化 SkillMessage(USER)
                                    发送 invoke(chat) 到 Gateway
      ← 200 OK (messageId)
      → 替换临时 ID

T+1                                 ← tool_event (message.part.delta)
                                    翻译 → StreamMessage(text.delta)
      ← WS: text.delta                                                 追加文本 "你"
      → assembler.handleMessage()
      → UI 渲染部分文本

T+2   ← WS: text.delta                                                 追加文本 "好，"
T+3   ← WS: text.delta                                                 追加文本 "我是"

T+4                                 ← tool_event (message.part.updated, type=tool)
                                    翻译 → StreamMessage(tool.update, pending)
      ← WS: tool.update(pending)                                       工具排队
      → assembler: Part(tool, isStreaming=true)

T+5   ← WS: tool.update(running)                                       工具执行中
T+6   ← WS: tool.update(completed)                                     工具完成

T+7                                 ← tool_event (message.part.updated, type=text)
                                    翻译 → StreamMessage(text.done)
      ← WS: text.done                                                  文本最终化

T+8                                 ← tool_done
                                    标记 completionCache (5s TTL)
                                    广播 session.status: idle
      ← WS: session.status(idle)
      → finalizeAllStreamingMessages()
      → isStreaming = false
```
