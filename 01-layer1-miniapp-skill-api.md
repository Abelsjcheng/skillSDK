# Layer① 协议：Miniapp ↔ Skill Server

> 本文档基于代码实现逐项核对，确保协议描述与实际行为一致。

## 概述

| 方向 | 传输方式 | 端点 |
|---|---|---|
| Miniapp → Skill Server | REST API (HTTP) | `/api/skill/**` |
| Skill Server → Miniapp | WebSocket | `ws://{host}/ws/skill/stream` |

**认证方式**：Cookie `userId`（所有接口统一）

> [!IMPORTANT]
> `welinkSessionId` 在所有 JSON 传输中必须编码为 **字符串**，禁止使用 JSON 数字类型。
> 后端通过 `@JsonSerialize(using = ToStringSerializer.class)` 保证；前端显式转为 string。

---

## 一、REST API（Miniapp → Skill Server）

### 通用响应包装

所有 REST API 返回 HTTP 200，通过 `ApiResponse` 包装（`@JsonInclude(NON_NULL)`）：

```json
// 成功
{ "code": 0, "data": { ... } }
// 失败
{ "code": 400, "errormsg": "错误描述" }
```

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `code` | int | ✅ | 状态码，`0` = 成功，非零 = 错误码 |
| `errormsg` | string | ❌ | 错误描述，仅失败时返回；成功时为 `null` 不输出 |
| `data` | object | ❌ | 业务数据，仅成功时返回；失败时为 `null` 不输出 |

---

### API-1：创建会话

```
POST /api/skill/sessions
```

**请求 Body**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ak` | string | 否 | Agent 的 Access Key，决定是否触发 Gateway 建会话 |
| `title` | string | 否 | 会话标题，可选初始标题 |
| `imGroupId` | string | 否 | 关联的 IM 群组 ID，用于 send-to-im 回退 |

**响应 `data`** — `SkillSession` 对象（无 `@JsonInclude(NON_NULL)`，**所有字段均返回**，null 字段显示为 `null`）：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `welinkSessionId` | string | ✅ | 会话 ID（Java `Long` → String 序列化，雪花 ID） |
| `userId` | string | ✅ | 拥有该会话的用户 ID |
| `ak` | string | ❌ | Agent Access Key，未关联 Agent 时为 `null` |
| `toolSessionId` | string | ❌ | OpenCode 侧的 session ID，创建后由 Gateway 回填，初始为 `null` |
| `title` | string | ❌ | 会话标题，未设置时为 `null` |
| `status` | string | ✅ | 会话状态：`ACTIVE` / `IDLE` / `CLOSED`，默认 `ACTIVE` |
| `imGroupId` | string | ❌ | 关联的 IM 群组 ID，未设置时为 `null` |
| `createdAt` | string | ✅ | 创建时间（ISO 8601） |
| `updatedAt` | string | ✅ | 最后活跃时间（Java 字段名 `lastActiveAt`，JSON 序列化为 `updatedAt`） |

**副作用**：若 `ak` 非空，发送 `create_session` invoke 到 AI-Gateway。

**代码**：[SkillSessionController.java L53-75](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillSessionController.java#L53-L75)

---

### API-2：会话列表

```
GET /api/skill/sessions?page=0&size=20&status=ACTIVE&ak=xxx&imGroupId=yyy
```

**Query 参数**：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `page` | int | `0` | 页码（从 0 开始） |
| `size` | int | `20` | 每页条数 |
| `status` | string | — | 按状态过滤（`ACTIVE` / `IDLE` / `CLOSED`） |
| `ak` | string | — | 按 Agent AK 过滤 |
| `imGroupId` | string | — | 按 IM 群组 ID 过滤 |

**响应 `data`** — `PageResult<SkillSession>`：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `content` | array | ✅ | `SkillSession` 对象数组（字段同 API-1） |
| `totalElements` | long | ✅ | 满足条件的总记录数 |
| `number` | int | ✅ | 当前页码（从 0 开始） |
| `size` | int | ✅ | 每页大小 |

**代码**：[SkillSessionController.java L81-94](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillSessionController.java#L81-L94)

---

### API-3：查询单个会话

```
GET /api/skill/sessions/{id}
```

**路径参数**：`id` — welinkSessionId

**响应 `data`** — `SkillSession` 对象（字段同 API-1）。

**代码**：[SkillSessionController.java](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillSessionController.java)

---

### API-4：关闭会话

```
DELETE /api/skill/sessions/{id}
```

**响应 `data`**：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `status` | string | ✅ | 固定值 `"closed"` |
| `welinkSessionId` | string | ✅ | 被关闭的会话 ID |

**副作用**：
1. 状态改为 `CLOSED`
2. 若 `ak != null && toolSessionId != null`，发送 `close_session` invoke 到 Gateway

**代码**：[SkillSessionController.java L118-147](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillSessionController.java#L118-L147)

---

### API-5：中止会话

```
POST /api/skill/sessions/{id}/abort
```

**响应 `data`**：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `status` | string | ✅ | 固定值 `"aborted"` |
| `welinkSessionId` | string | ✅ | 被中止的会话 ID |

**错误**：`409` — 会话已关闭

**副作用**：若 `ak != null && toolSessionId != null`，发送 `abort_session` invoke 到 Gateway（不改变 session 状态）。

**代码**：[SkillSessionController.java L154-188](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillSessionController.java#L154-L188)

---

### API-6：发送消息

```
POST /api/skill/sessions/{sessionId}/messages
```

**请求 Body**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | string | 是 | 消息文本 |
| `toolCallId` | string | 否 | 存在时走 `question_reply` 路由，对应 WS-6 中的 `toolCallId` |

**响应 `data`** — `ProtocolMessageView` 对象（见下方定义）。

**三条分支**：
1. `toolSessionId == null` → 触发 `rebuildToolSession()`
2. `toolCallId` 有值 → `question_reply` action
3. 否则 → `chat` action

**错误**：`400` content 为空 / `409` 会话已关闭

**代码**：[SkillMessageController.java L75-139](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillMessageController.java#L75-L139)

---

### API-7：消息历史

```
GET /api/skill/sessions/{sessionId}/messages?page=0&size=50
```

**响应 `data`** — `PageResult<ProtocolMessageView>`（分页字段同 API-2）。

#### ProtocolMessageView 结构（`@JsonInclude(NON_NULL)`，null 字段不输出）

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 消息 ID（优先 `messageId`，回退 DB 自增 `id`） |
| `welinkSessionId` | string | ✅ | 所属会话 ID |
| `seq` | int | ❌ | 消息在数据库中的排序序号，用户消息时可能为 null |
| `messageSeq` | int | ❌ | 消息序号，由 OpenCode 分配 |
| `role` | string | ✅ | 发送方：`user`（用户发送）/ `assistant`（AI 生成） |
| `content` | string | ❌ | 消息纯文本内容（`user` 消息必有，`assistant` 可能为 null） |
| `contentType` | string | ❌ | 内容类型：`plain`（纯文本）/ `markdown`（Markdown 格式） |
| `createdAt` | string | ✅ | 消息创建时间（ISO 8601） |
| `meta` | object | ❌ | 元信息对象（包含 tokens、cost 等），仅 assistant 消息可能有 |
| `parts` | array | ❌ | `ProtocolMessagePart` 数组，仅 assistant 消息有，详见下方 |

#### ProtocolMessagePart 结构（`@JsonInclude(NON_NULL)`，null 字段不输出）

**基础字段**（所有 type 共用）：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `partId` | string | ✅ | Part 唯一标识 |
| `partSeq` | int | ✅ | Part 在消息中的序号（从 1 递增） |
| `type` | string | ✅ | Part 类型：`text` / `thinking` / `tool` / `question` / `permission` / `file` |
| `content` | string | ❌ | 文本内容，仅 `text` / `thinking` 类型有值 |

**按 type 扩展的字段**（仅对应类型时出现）：

| type | 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|---|
| `tool` | `toolName` | string | ✅ | 工具名称（如 `bash`, `read`, `edit`） |
| `tool` | `toolCallId` | string | ❌ | 工具调用 ID |
| `tool` | `status` | string | ✅ | 执行状态：`pending` / `running` / `completed` / `error` |
| `tool` | `input` | object | ❌ | 工具输入参数（JSON 对象） |
| `tool` | `output` | string | ❌ | 工具执行输出文本 |
| `tool` | `error` | string | ❌ | 工具执行错误信息 |
| `tool` | `title` | string | ❌ | 工具调用的展示标题 |
| `question` | `toolCallId` | string | ✅ | 问题关联的工具调用 ID，前端回复时需回传 |
| `question` | `status` | string | ✅ | 固定为 `"running"`（等待回答） |
| `question` | `input` | object | ❌ | 问题原始 payload |
| `question` | `header` | string | ❌ | 问题标题/说明 |
| `question` | `question` | string | ❌ | 问题正文 |
| `question` | `options` | array | ❌ | 选项列表（字符串数组） |
| `permission` | `permissionId` | string | ✅ | 权限请求 ID |
| `permission` | `permType` | string | ✅ | 权限类型（如 `file-edit`） |
| `permission` | `metadata` | object | ❌ | 权限相关元数据 |
| `permission` | `response` | string | ❌ | 回复值（`once` / `always` / `reject`，已回复时出现） |
| `permission` | `status` | string | ❌ | 权限状态 |
| `file` | `fileName` | string | ❌ | 文件名 |
| `file` | `fileUrl` | string | ❌ | 文件下载 URL |
| `file` | `fileMime` | string | ❌ | 文件 MIME 类型 |

> 使用 `@JsonInclude(NON_NULL)`，null 字段不输出。

**代码**：[SkillMessageController.java L145-172](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillMessageController.java#L145-L172)

---

### API-8：转发到 IM

```
POST /api/skill/sessions/{sessionId}/send-to-im
```

**请求 Body**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | string | 是 | 要转发的文本 |
| `chatId` | string | 否 | IM 聊天 ID，空则回退到 `session.imGroupId` |

**响应 `data`**：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `success` | boolean | ✅ | 固定为 `true`（失败时走 errormsg） |

**代码**：[SkillMessageController.java L178-217](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillMessageController.java#L178-L217)

---

### API-9：权限回复

```
POST /api/skill/sessions/{sessionId}/permissions/{permId}
```

**请求 Body**：

| 字段 | 类型 | 必填 | 合法值 |
|---|---|---|---|
| `response` | string | 是 | `once`（单次允许）/ `always`（始终允许）/ `reject`（拒绝） |

**响应 `data`**：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `welinkSessionId` | string | ✅ | 会话 ID |
| `permissionId` | string | ✅ | 被回复的权限请求 ID |
| `response` | string | ✅ | 回复内容（回显请求值） |

**副作用**：
1. 发送 `permission_reply` invoke 到 Gateway
2. 推送 `permission.reply` StreamMessage 到 WS

**代码**：[SkillMessageController.java L225-288](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/SkillMessageController.java#L225-L288)

---

### API-10：在线 Agent 列表

```
GET /api/skill/agents
```

**响应 `data`** — `List<AgentSummary>`（`@JsonInclude(NON_NULL)`，null 字段不输出）：

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `ak` | string | ✅ | Agent Access Key，唯一标识 |
| `status` | string | ❌ | 连接状态，如 `ONLINE` |
| `deviceName` | string | ❌ | 设备名称 |
| `os` | string | ❌ | 操作系统（如 `Windows`, `macOS`, `Linux`） |
| `toolType` | string | ❌ | 工具类型（小写，如 `opencode`） |
| `toolVersion` | string | ❌ | 工具版本号 |
| `connectedAt` | string | ❌ | 连接时间（ISO 8601） |

> 字段来自 Gateway API 透传，除 `ak` 外其他字段取决于 Agent 上报的注册信息。

**代码**：[AgentQueryController.java](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/controller/AgentQueryController.java)

---

## 二、WebSocket 协议（Skill Server → Miniapp）

### 连接

```
ws://{host}/ws/skill/stream
```

- **认证**：Cookie `userId`
- **订阅模型**：按 userId，一个用户所有 session 的事件推到同一连接
- **连接后**：自动推送所有 ACTIVE session 的 `snapshot` + `streaming`
- **客户端消息**：`{"action": "resume"}` — 重发 `snapshot` + `streaming`
- **重连**：指数退避，最大 30 秒

**代码**：[SkillStreamHandler.java](file:///D:/02_Lab/Projects/sandbox/opencode-CUI/skill-server/src/main/java/com/opencode/cui/skill/ws/SkillStreamHandler.java)

---

### StreamMessage 通用字段

所有 WS 事件使用 `StreamMessage` DTO（`@JsonInclude(NON_NULL)`，null 字段不输出）。

以下字段根据事件类型选择性出现，具体见各事件定义：

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | 事件类型（固定，所有事件必有） |
| `seq` | long | 传输序号（per-session 递增，由广播层动态分配） |
| `welinkSessionId` | string | 会话 ID（由 `enrichStreamMessage` 注入） |
| `emittedAt` | string | 发射时间（ISO 8601），部分事件类型不含此字段 |

---

### 事件类型总览

| 类型 | 用途 | 基于 Builder |
|---|---|---|
| `text.delta` | 文本增量 | partBuilder |
| `text.done` | 文本完成 | partBuilder |
| `thinking.delta` | 思考增量 | partBuilder |
| `thinking.done` | 思考完成 | partBuilder |
| `tool.update` | 工具调用状态 | partBuilder |
| `question` | 交互式提问 | partBuilder |
| `file` | 文件附件 | partBuilder |
| `permission.ask` | 权限请求 | messageBuilder |
| `permission.reply` | 权限回复 | 直接构造 |
| `step.start` | 步骤开始 | messageBuilder |
| `step.done` | 步骤完成（含 tokens/cost） | messageBuilder |
| `session.status` | 会话状态变更 | baseBuilder |
| `session.title` | 会话标题更新 | baseBuilder |
| `session.error` | 会话错误 | baseBuilder |
| `agent.online` | Agent 上线 | 直接构造 |
| `agent.offline` | Agent 下线 | 直接构造 |
| `snapshot` | 历史消息快照 | 直接构造 |
| `streaming` | 当前流式状态 | 直接构造 |
| `error` | 通用错误 | 直接构造 |

**Builder 层级决定的字段组合**：
- **baseBuilder**：`type` + `sessionId` + `emittedAt`
- **messageBuilder** = baseBuilder + `role` + `messageId` + `sourceMessageId`
- **partBuilder** = messageBuilder + `partId` + `partSeq`

---

### WS-1/2：text.delta / text.done

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"text.delta"` 或 `"text.done"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ✅ | 所属消息 ID |
| `sourceMessageId` | string | ✅ | 源消息 ID（同 messageId） |
| `role` | string | ✅ | 固定 `"assistant"` |
| `partId` | string | ✅ | Part 唯一标识 |
| `partSeq` | int | ✅ | Part 在消息中的序号 |
| `content` | string | ✅ | `delta` 为增量片段，`done` 为完整文本 |

**来源**：`OpenCodeEventTranslator.translateTextPart()` / `translatePartDelta()`

---

### WS-3/4：thinking.delta / thinking.done

字段结构与 text.delta/done **完全一致**，仅 `type` 不同（`"thinking.delta"` / `"thinking.done"`）。

OpenCode partType `"reasoning"` 映射为 `"thinking"`。

---

### WS-5：tool.update

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"tool.update"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ✅ | 所属消息 ID |
| `sourceMessageId` | string | ✅ | 源消息 ID |
| `role` | string | ✅ | 固定 `"assistant"` |
| `partId` | string | ✅ | Part 唯一标识 |
| `partSeq` | int | ✅ | Part 序号 |
| `toolName` | string | ✅ | 工具名称（如 `bash`, `read`, `edit`） |
| `toolCallId` | string | ❌ | 工具调用 ID，由 OpenCode 分配 |
| `status` | string | ✅ | 执行状态：`pending` / `running` / `completed` / `error` |
| `input` | object | ❌ | 工具输入参数，JSON 对象（如 `{"command": "ls -la"}`） |
| `output` | string | ❌ | 工具执行输出文本 |
| `error` | string | ❌ | 工具执行错误信息（null 时省略） |
| `title` | string | ❌ | 工具调用的展示标题 |

**字段来源映射**：

| 字段 | 来源 |
|---|---|
| `toolName` | `part.tool` |
| `toolCallId` | `part.callID` |
| `status` | `part.state.status` |
| `input` | `part.state.input` |
| `output` | `part.state.output` |
| `error` | `part.state.error`（null 时省略） |
| `title` | `part.state.title` |

> 当 `toolName == "question"` 且 `status == "running"` 时，转为 `question` 类型。

---

### WS-6：question

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"question"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ✅ | 所属消息 ID |
| `sourceMessageId` | string | ✅ | 源消息 ID |
| `role` | string | ✅ | 固定 `"assistant"` |
| `partId` | string | ✅ | Part 唯一标识 |
| `partSeq` | int | ✅ | Part 序号 |
| `toolName` | string | ✅ | 固定 `"question"` |
| `toolCallId` | string | ✅ | 工具调用 ID，前端回复时需通过 API-6 回传此值 |
| `status` | string | ✅ | 固定 `"running"`（等待回答） |
| `input` | object | ❌ | 问题原始 payload（JSON 对象） |
| `header` | string | ❌ | 问题标题/说明文字 |
| `question` | string | ❌ | 问题正文 |
| `options` | array | ❌ | 选项列表（字符串数组），无选项时不返回 |

**两条来源路径**：
- `translateQuestion()`：`tool` part 中 `toolName == "question"` 且 `status == "running"`
- `translateQuestionAsked()`：OpenCode `question.asked` 事件

**options 提取**：每个 option 先取 `.label`，无则取文本值。

---

### WS-7：file

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"file"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ✅ | 所属消息 ID |
| `sourceMessageId` | string | ✅ | 源消息 ID |
| `role` | string | ✅ | 固定 `"assistant"` |
| `partId` | string | ✅ | Part 唯一标识 |
| `partSeq` | int | ✅ | Part 序号 |
| `fileName` | string | ❌ | 文件名（如 `result.png`） |
| `fileUrl` | string | ❌ | 文件下载 URL |
| `fileMime` | string | ❌ | MIME 类型（如 `image/png`） |

---

### WS-8：permission.ask

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"permission.ask"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ❌ | 所属消息 ID（OpenCode 路径有，Gateway 路径可能无） |
| `sourceMessageId` | string | ❌ | 源消息 ID（同 messageId） |
| `role` | string | ✅ | 固定 `"assistant"` |
| `permissionId` | string | ✅ | 权限请求唯一 ID，前端回复时需回传 |
| `permType` | string | ✅ | 权限类型（如 `file-edit`, `bash`） |
| `title` | string | ❌ | 权限请求展示标题（如 `"edit /src/main.ts"`） |
| `metadata` | object | ❌ | 权限相关元数据（如 `{"path": "/src/main.ts"}`） |

**两条来源**：
- `translatePermission()`：来自 OpenCode `permission.updated`/`permission.asked` 事件
- `translatePermissionFromGateway()`：来自 Gateway 中转的 `permission_request`

---

### WS-9：permission.reply

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"permission.reply"` |
| `welinkSessionId` | string | ✅ | 会话 ID（由广播层注入） |
| `role` | string | ✅ | 固定 `"assistant"` |
| `permissionId` | string | ✅ | 被回复的权限请求 ID |
| `response` | string | ✅ | 回复内容：`once` / `always` / `reject` |

> 无 `emittedAt`（直接 `StreamMessage.builder()` 构造）。
> 在用户通过 REST API-9 回复权限时推送。

---

### WS-10：step.start

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"step.start"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ✅ | 所属消息 ID |
| `sourceMessageId` | string | ✅ | 源消息 ID |
| `role` | string | ✅ | 固定 `"assistant"` |

仅基础字段，无额外数据。

---

### WS-11：step.done

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"step.done"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messageId` | string | ✅ | 所属消息 ID |
| `sourceMessageId` | string | ✅ | 源消息 ID |
| `role` | string | ✅ | 固定 `"assistant"` |
| `tokens` | object | ❌ | Token 用量：`{"input": 1000, "output": 500}`，仅 `step-finish` part 路径有 |
| `cost` | double | ❌ | 本次调用费用（美元），仅非零时返回 |
| `reason` | string | ❌ | 结束原因（如 `"stop"`, `"length"`） |

- `tokens`/`cost` 仅在 `step-finish` part 路径中有
- `message.updated`（带 `finish`）路径只有 `reason`

---

### WS-12：session.status

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"session.status"` |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `sessionStatus` | string | ✅ | 归一化后的状态值（见下表） |

**状态映射**：

| OpenCode 原始值 | 映射后 | 含义 |
|---|---|---|
| `idle` / `completed` | `idle` | AI 处于空闲，可接收新消息 |
| `active` / `running` / `busy` | `busy` | AI 正在处理中 |
| `reconnecting` / `retry` / `recovering` | `retry` | 连接恢复中 |

---

### WS-13：session.title

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"session.title"` |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `title` | string | ❌ | AI 自动生成的会话标题 |

---

### WS-14：session.error

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"session.error"` |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `error` | string | ✅ | 错误描述信息 |

---

### WS-15/16：agent.online / agent.offline

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"agent.online"` 或 `"agent.offline"` |
| `seq` | long | ✅ | 传输序号（广播层分配） |
| `welinkSessionId` | string | ✅ | 关联的会话 ID（广播层注入） |

- 构造时仅设 `type`，`seq` 和 `welinkSessionId` 由广播路径动态注入
- 无 `emittedAt`、`role` 等字段
- 广播给该 `ak` 关联的所有 session（通过 `sessionService.findByAk(ak)` 查询）

---

### WS-17：snapshot

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"snapshot"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `messages` | array | ✅ | `ProtocolMessageView` 数组（格式同 REST API-7 的消息结构） |

- 触发时机：WS 连接建立 / 客户端 `resume`

---

### WS-18：streaming

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"streaming"` |
| `seq` | long | ✅ | 传输序号 |
| `welinkSessionId` | string | ✅ | 会话 ID |
| `emittedAt` | string | ✅ | 发射时间 |
| `sessionStatus` | string | ✅ | 当前状态：`"busy"`（流式进行中）或 `"idle"`（空闲） |
| `messageId` | string | ❌ | 当前流式消息 ID，仅 parts 非空时出现 |
| `messageSeq` | int | ❌ | 当前流式消息序号，仅 parts 非空时出现 |
| `role` | string | ❌ | 消息角色，仅 parts 非空时出现 |
| `parts` | array | ✅ | `ProtocolMessagePart` 数组（格式同上方定义），空闲时为空数组 |

---

### WS-19：error

| 字段 | 类型 | 必返回 | 说明 |
|---|---|---|---|
| `type` | string | ✅ | `"error"` |
| `seq` | long | ✅ | 传输序号（广播层分配） |
| `welinkSessionId` | string | ✅ | 会话 ID（广播层注入） |
| `error` | string | ✅ | 错误描述信息 |

- 来源：Gateway 回报 `tool_error` / rebuild 失败
- 无 `emittedAt`
