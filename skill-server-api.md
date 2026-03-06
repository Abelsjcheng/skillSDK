# Skill Server 接口文档

> **版本**: v1.0  
> **基础 URL**: `http://{host}:8082`  
> **协议**: HTTP/1.1 + WebSocket  
> **内容类型**: `application/json`  
> **字符编码**: UTF-8  
> **最后更新**: 2026-03-06

---

## 目录

1. [概述](#1-概述)
2. [通用约定](#2-通用约定)
3. [数据模型](#3-数据模型)
4. [REST API 接口](#4-rest-api-接口)
   - [4.1 技能定义 (Skill Definition)](#41-技能定义-skill-definition)
   - [4.2 会话管理 (Session)](#42-会话管理-session)
   - [4.3 消息管理 (Message)](#43-消息管理-message)
5. [WebSocket 接口](#5-websocket-接口)
   - [5.1 流式推送端点 (Skill Stream)](#51-流式推送端点-skill-stream)
   - [5.2 网关内部端点 (Gateway Internal)](#52-网关内部端点-gateway-internal)
6. [错误处理](#6-错误处理)
7. [附录](#7-附录)

---

## 1. 概述

Skill Server 是 OpenCode CUI 系统中的技能服务层，提供以下核心能力：

- **技能定义管理** — 查询可用的 AI 技能（如 OpenCode AI 编码助手）
- **会话生命周期管理** — 创建、查询、关闭技能会话
- **消息收发** — 用户消息发送、历史消息查询、权限确认回复、IM 消息转发
- **流式推送** — 通过 WebSocket 向客户端实时推送 AI 响应流
- **网关通信** — 与 AI-Gateway 的内部 WebSocket 连接，中继调度指令和事件

### 架构位置

```
┌──────────────┐     HTTP/WS      ┌──────────────┐     WS      ┌──────────────┐
│ Skill Miniapp│ ←───────────────→ │ Skill Server │ ←──────────→ │  AI-Gateway  │
│   (前端)      │                  │  (Port 8082) │             │   (Java)     │
└──────────────┘                  └──────────────┘             └──────────────┘
```

---

## 2. 通用约定

### 2.1 请求格式

| 项目             | 说明                                                   |
| ---------------- | ------------------------------------------------------ |
| **Content-Type** | `application/json`                                     |
| **字符集**       | UTF-8                                                  |
| **日期格式**     | ISO 8601，如 `2026-03-06T10:30:00`                     |
| **分页参数**     | `page`（页码，从 0 开始）、`size`（每页条数，默认 20） |
| **路径参数**     | 使用 `{paramName}` 表示                                |

### 2.2 响应格式

成功响应直接返回业务对象或业务对象列表。分页接口返回 `PageResult` 包装对象。

### 2.3 HTTP 状态码

| 状态码                      | 含义             | 使用场景         |
| --------------------------- | ---------------- | ---------------- |
| `200 OK`                    | 请求成功         | GET、DELETE 成功 |
| `201 Created`               | 资源创建成功     | POST 成功        |
| `400 Bad Request`           | 请求参数校验失败 | 缺少必填字段     |
| `404 Not Found`             | 资源不存在       | 会话/消息不存在  |
| `409 Conflict`              | 状态冲突         | 对已关闭会话操作 |
| `500 Internal Server Error` | 服务器内部错误   | 未预期异常       |

---

## 3. 数据模型

### 3.1 SkillDefinition（技能定义）

| 字段          | 类型       | 必填 | 说明                                       |
| ------------- | ---------- | ---- | ------------------------------------------ |
| `id`          | `Long`     | 是   | 技能定义 ID（自增主键）                    |
| `skillCode`   | `String`   | 是   | 技能编码（唯一），如 `opencode`            |
| `skillName`   | `String`   | 是   | 技能显示名称，如 `OpenCode AI`             |
| `toolType`    | `String`   | 是   | 工具类型，默认 `OPENCODE`                  |
| `description` | `String`   | 否   | 技能描述文案                               |
| `iconUrl`     | `String`   | 否   | 技能图标 URL                               |
| `status`      | `Enum`     | 是   | 状态：`ACTIVE`（启用）、`DISABLED`（禁用） |
| `sortOrder`   | `Integer`  | 是   | 排序权重，默认 `0`，升序排列               |
| `createdAt`   | `DateTime` | 是   | 创建时间                                   |
| `updatedAt`   | `DateTime` | 是   | 最后更新时间                               |

**示例：**
```json
{
  "id": 1,
  "skillCode": "opencode",
  "skillName": "OpenCode AI",
  "toolType": "OPENCODE",
  "description": "AI 编码助手 - 代码生成、分析、重构",
  "iconUrl": "/icons/opencode.svg",
  "status": "ACTIVE",
  "sortOrder": 1,
  "createdAt": "2026-03-01T00:00:00",
  "updatedAt": "2026-03-01T00:00:00"
}
```

### 3.2 SkillSession（技能会话）

| 字段                | 类型       | 必填 | 说明                                                       |
| ------------------- | ---------- | ---- | ---------------------------------------------------------- |
| `id`                | `Long`     | 是   | 会话 ID（自增主键）                                        |
| `userId`            | `Long`     | 是   | 关联用户 ID                                                |
| `skillDefinitionId` | `Long`     | 是   | 关联技能定义 ID                                            |
| `agentId`           | `Long`     | 否   | 关联的 PCAgent ID                                          |
| `toolSessionId`     | `String`   | 否   | OpenCode 工具会话 ID（由 AI-Gateway 返回）                 |
| `title`             | `String`   | 否   | 会话标题                                                   |
| `status`            | `Enum`     | 是   | 状态：`ACTIVE`（活跃）、`IDLE`（空闲）、`CLOSED`（已关闭） |
| `imChatId`          | `String`   | 否   | 关联的 IM 聊天 ID                                          |
| `createdAt`         | `DateTime` | 是   | 创建时间                                                   |
| `lastActiveAt`      | `DateTime` | 是   | 最后活跃时间                                               |

**示例：**
```json
{
  "id": 42,
  "userId": 1001,
  "skillDefinitionId": 1,
  "agentId": 99,
  "toolSessionId": "oc-sess-abc123",
  "title": "重构登录模块",
  "status": "ACTIVE",
  "imChatId": "chat-789",
  "createdAt": "2026-03-06T10:00:00",
  "lastActiveAt": "2026-03-06T10:30:00"
}
```

### 3.3 SkillMessage（技能消息）

| 字段          | 类型       | 必填 | 说明                                            |
| ------------- | ---------- | ---- | ----------------------------------------------- |
| `id`          | `Long`     | 是   | 消息 ID（自增主键）                             |
| `sessionId`   | `Long`     | 是   | 所属会话 ID                                     |
| `seq`         | `Integer`  | 是   | 会话内消息序号                                  |
| `role`        | `Enum`     | 是   | 消息角色：`USER`、`ASSISTANT`、`SYSTEM`、`TOOL` |
| `content`     | `String`   | 是   | 消息内容                                        |
| `contentType` | `Enum`     | 是   | 内容类型：`MARKDOWN`（默认）、`CODE`、`PLAIN`   |
| `createdAt`   | `DateTime` | 是   | 创建时间                                        |
| `meta`        | `JSON`     | 否   | 扩展元数据（JSON 格式）                         |

**示例：**
```json
{
  "id": 1,
  "sessionId": 42,
  "seq": 1,
  "role": "USER",
  "content": "请帮我重构登录模块",
  "contentType": "MARKDOWN",
  "createdAt": "2026-03-06T10:30:00",
  "meta": null
}
```

### 3.4 PageResult\<T\>（分页结果）

| 字段            | 类型      | 说明                  |
| --------------- | --------- | --------------------- |
| `content`       | `List<T>` | 当前页数据列表        |
| `totalElements` | `Long`    | 总记录数              |
| `totalPages`    | `Integer` | 总页数                |
| `number`        | `Integer` | 当前页码（从 0 开始） |
| `size`          | `Integer` | 每页大小              |

**示例：**
```json
{
  "content": [ ... ],
  "totalElements": 56,
  "totalPages": 3,
  "number": 0,
  "size": 20
}
```

---

## 4. REST API 接口

### 4.1 技能定义 (Skill Definition)

#### 4.1.1 获取技能定义列表

查询所有状态为 `ACTIVE` 的技能定义，按 `sortOrder` 升序排列。

| 项目     | 值                           |
| -------- | ---------------------------- |
| **URL**  | `GET /api/skill/definitions` |
| **认证** | 无                           |

**请求参数：** 无

**成功响应：**

- **状态码**: `200 OK`
- **响应体**: `List<SkillDefinition>`

```json
[
  {
    "id": 1,
    "skillCode": "opencode",
    "skillName": "OpenCode AI",
    "toolType": "OPENCODE",
    "description": "AI 编码助手 - 代码生成、分析、重构",
    "iconUrl": "/icons/opencode.svg",
    "status": "ACTIVE",
    "sortOrder": 1,
    "createdAt": "2026-03-01T00:00:00",
    "updatedAt": "2026-03-01T00:00:00"
  }
]
```

---

### 4.2 会话管理 (Session)

#### 4.2.1 创建会话

创建一个新的技能会话。如果提供了 `agentId`，同时会向 AI-Gateway 发送 `create_session` 调度指令。

| 项目     | 值                         |
| -------- | -------------------------- |
| **URL**  | `POST /api/skill/sessions` |
| **认证** | 无                         |

**请求体：**

| 字段                | 类型     | 必填   | 说明                                                   |
| ------------------- | -------- | ------ | ------------------------------------------------------ |
| `userId`            | `Long`   | **是** | 用户 ID                                                |
| `skillDefinitionId` | `Long`   | **是** | 技能定义 ID                                            |
| `agentId`           | `Long`   | 否     | PCAgent ID，提供时将触发 AI-Gateway 创建 OpenCode 会话 |
| `title`             | `String` | 否     | 会话标题                                               |
| `imChatId`          | `String` | 否     | 关联的 IM 聊天 ID                                      |

**请求示例：**
```json
{
  "userId": 1001,
  "skillDefinitionId": 1,
  "agentId": 99,
  "title": "重构登录模块",
  "imChatId": "chat-789"
}
```

**成功响应：**

- **状态码**: `201 Created`
- **响应体**: `SkillSession`

```json
{
  "id": 42,
  "userId": 1001,
  "skillDefinitionId": 1,
  "agentId": 99,
  "toolSessionId": null,
  "title": "重构登录模块",
  "status": "ACTIVE",
  "imChatId": "chat-789",
  "createdAt": "2026-03-06T10:00:00",
  "lastActiveAt": "2026-03-06T10:00:00"
}
```

**错误响应：**

| 状态码            | 条件                                 |
| ----------------- | ------------------------------------ |
| `400 Bad Request` | `userId` 或 `skillDefinitionId` 为空 |

---

#### 4.2.2 查询会话列表

按用户 ID 分页查询会话，支持按状态过滤。

| 项目     | 值                        |
| -------- | ------------------------- |
| **URL**  | `GET /api/skill/sessions` |
| **认证** | 无                        |

**查询参数：**

| 参数       | 类型         | 必填   | 默认值 | 说明                                         |
| ---------- | ------------ | ------ | ------ | -------------------------------------------- |
| `userId`   | `Long`       | **是** | —      | 用户 ID                                      |
| `statuses` | `List<Enum>` | 否     | 全部   | 状态过滤，可多选：`ACTIVE`、`IDLE`、`CLOSED` |
| `page`     | `Integer`    | 否     | `0`    | 页码（从 0 开始）                            |
| `size`     | `Integer`    | 否     | `20`   | 每页条数                                     |

**请求示例：**
```
GET /api/skill/sessions?userId=1001&statuses=ACTIVE&statuses=IDLE&page=0&size=10
```

**成功响应：**

- **状态码**: `200 OK`
- **响应体**: `PageResult<SkillSession>`

```json
{
  "content": [
    {
      "id": 42,
      "userId": 1001,
      "skillDefinitionId": 1,
      "agentId": 99,
      "title": "重构登录模块",
      "status": "ACTIVE",
      "createdAt": "2026-03-06T10:00:00",
      "lastActiveAt": "2026-03-06T10:30:00"
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "number": 0,
  "size": 10
}
```

---

#### 4.2.3 查询会话详情

根据会话 ID 获取单个会话的完整信息。

| 项目     | 值                             |
| -------- | ------------------------------ |
| **URL**  | `GET /api/skill/sessions/{id}` |
| **认证** | 无                             |

**路径参数：**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | `Long` | 会话 ID |

**成功响应：**

- **状态码**: `200 OK`
- **响应体**: `SkillSession`

**错误响应：**

| 状态码          | 条件       |
| --------------- | ---------- |
| `404 Not Found` | 会话不存在 |

---

#### 4.2.4 关闭会话

关闭指定会话。如果会话关联了 `agentId` 和 `toolSessionId`，同时会向 AI-Gateway 发送 `close_session` 调度指令。

| 项目     | 值                                |
| -------- | --------------------------------- |
| **URL**  | `DELETE /api/skill/sessions/{id}` |
| **认证** | 无                                |

**路径参数：**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | `Long` | 会话 ID |

**成功响应：**

- **状态码**: `200 OK`
- **响应体**:

```json
{
  "status": "closed",
  "sessionId": "42"
}
```

**错误响应：**

| 状态码          | 条件       |
| --------------- | ---------- |
| `404 Not Found` | 会话不存在 |

---

### 4.3 消息管理 (Message)

> **基础路径**: `/api/skill/sessions/{sessionId}`

#### 4.3.1 发送用户消息

向指定会话发送用户消息。消息被持久化后，系统会自动向 AI-Gateway 转发 `chat` 调度指令，触发 AI 处理。

| 项目     | 值                                              |
| -------- | ----------------------------------------------- |
| **URL**  | `POST /api/skill/sessions/{sessionId}/messages` |
| **认证** | 无                                              |

**路径参数：**

| 参数        | 类型   | 说明    |
| ----------- | ------ | ------- |
| `sessionId` | `Long` | 会话 ID |

**请求体：**

| 字段      | 类型     | 必填   | 说明                           |
| --------- | -------- | ------ | ------------------------------ |
| `content` | `String` | **是** | 消息文本内容（不能为空或空白） |

**请求示例：**
```json
{
  "content": "请帮我重构登录模块的校验逻辑"
}
```

**成功响应：**

- **状态码**: `201 Created`
- **响应体**: `SkillMessage`

```json
{
  "id": 1,
  "sessionId": 42,
  "seq": 1,
  "role": "USER",
  "content": "请帮我重构登录模块的校验逻辑",
  "contentType": "MARKDOWN",
  "createdAt": "2026-03-06T10:30:00",
  "meta": null
}
```

**错误响应：**

| 状态码                      | 条件                          |
| --------------------------- | ----------------------------- |
| `400 Bad Request`           | `content` 为空或空白字符串    |
| `404 Not Found`             | 会话不存在                    |
| `409 Conflict`              | 会话已关闭（状态为 `CLOSED`） |
| `500 Internal Server Error` | AI-Gateway 调度失败           |

**副作用：**
- 持久化用户消息到数据库
- 向 AI-Gateway 发送 `chat` 调度指令（携带消息文本和 `toolSessionId`）
- AI 响应将通过 WebSocket 流式推送端点返回

---

#### 4.3.2 查询消息历史

分页查询指定会话的消息历史记录。

| 项目     | 值                                             |
| -------- | ---------------------------------------------- |
| **URL**  | `GET /api/skill/sessions/{sessionId}/messages` |
| **认证** | 无                                             |

**路径参数：**

| 参数        | 类型   | 说明    |
| ----------- | ------ | ------- |
| `sessionId` | `Long` | 会话 ID |

**查询参数：**

| 参数   | 类型      | 必填 | 默认值 | 说明              |
| ------ | --------- | ---- | ------ | ----------------- |
| `page` | `Integer` | 否   | `0`    | 页码（从 0 开始） |
| `size` | `Integer` | 否   | `50`   | 每页条数          |

**请求示例：**
```
GET /api/skill/sessions/42/messages?page=0&size=50
```

**成功响应：**

- **状态码**: `200 OK`
- **响应体**: `PageResult<SkillMessage>`

```json
{
  "content": [
    {
      "id": 1,
      "sessionId": 42,
      "seq": 1,
      "role": "USER",
      "content": "请帮我重构登录模块",
      "contentType": "MARKDOWN",
      "createdAt": "2026-03-06T10:30:00",
      "meta": null
    },
    {
      "id": 2,
      "sessionId": 42,
      "seq": 2,
      "role": "ASSISTANT",
      "content": "好的，我来分析一下登录模块的代码...",
      "contentType": "MARKDOWN",
      "createdAt": "2026-03-06T10:30:05",
      "meta": "{\"usage\":{\"inputTokens\":150,\"outputTokens\":320}}"
    }
  ],
  "totalElements": 2,
  "totalPages": 1,
  "number": 0,
  "size": 50
}
```

**错误响应：**

| 状态码          | 条件       |
| --------------- | ---------- |
| `404 Not Found` | 会话不存在 |

---

#### 4.3.3 回复权限确认

对 AI 发起的权限确认请求进行批准或拒绝。

当 AI 需要执行文件修改、命令执行等敏感操作时，会发送权限确认请求。前端收到后展示确认 UI，用户决策后调用此接口回复。

| 项目     | 值                                                          |
| -------- | ----------------------------------------------------------- |
| **URL**  | `POST /api/skill/sessions/{sessionId}/permissions/{permId}` |
| **认证** | 无                                                          |

**路径参数：**

| 参数        | 类型     | 说明            |
| ----------- | -------- | --------------- |
| `sessionId` | `Long`   | 会话 ID         |
| `permId`    | `String` | 权限确认请求 ID |

**请求体：**

| 字段       | 类型      | 必填   | 说明                      |
| ---------- | --------- | ------ | ------------------------- |
| `approved` | `Boolean` | **是** | `true` 批准，`false` 拒绝 |

**请求示例：**
```json
{
  "approved": true
}
```

**成功响应：**

- **状态码**: `200 OK`
- **响应体**:

```json
{
  "success": true,
  "permissionId": "p-abc123",
  "approved": true
}
```

**错误响应：**

| 状态码            | 条件                             |
| ----------------- | -------------------------------- |
| `400 Bad Request` | `approved` 字段缺失（为 `null`） |
| `404 Not Found`   | 会话不存在或无关联 Agent         |
| `409 Conflict`    | 会话已关闭                       |

**副作用：**
- 向 AI-Gateway 发送 `permission_reply` 调度指令（携带 `permissionId`、`approved`、`toolSessionId`）

---

#### 4.3.4 发送消息到 IM

将消息内容转发到会话关联的 IM 聊天中。

| 项目     | 值                                                |
| -------- | ------------------------------------------------- |
| **URL**  | `POST /api/skill/sessions/{sessionId}/send-to-im` |
| **认证** | 无                                                |

**路径参数：**

| 参数        | 类型   | 说明    |
| ----------- | ------ | ------- |
| `sessionId` | `Long` | 会话 ID |

**请求体：**

| 字段      | 类型     | 必填   | 说明                   |
| --------- | -------- | ------ | ---------------------- |
| `content` | `String` | **是** | 要发送到 IM 的消息内容 |

**请求示例：**
```json
{
  "content": "代码重构已完成，请查看 PR #42"
}
```

**成功响应：**

- **状态码**: `200 OK`
- **响应体**:

```json
{
  "success": true,
  "chatId": "chat-789",
  "contentLength": 22
}
```

**错误响应：**

| 状态码                      | 条件                    |
| --------------------------- | ----------------------- |
| `400 Bad Request`           | `content` 为空或空白    |
| `404 Not Found`             | 会话不存在              |
| `409 Conflict`              | 会话无关联的 IM 聊天 ID |
| `500 Internal Server Error` | IM 消息发送失败         |

**副作用：**
- 调用 IM 平台 API 发送文本消息到指定聊天

---

## 5. WebSocket 接口

### 5.1 流式推送端点 (Skill Stream)

客户端订阅 AI 响应流。连接后，服务端会实时推送 AI 处理过程中的增量内容更新、完成通知和错误信息。

| 项目     | 值                                             |
| -------- | ---------------------------------------------- |
| **URL**  | `ws://{host}:8082/ws/skill/stream/{sessionId}` |
| **方向** | 服务端 → 客户端（单向推送）                    |
| **认证** | 无                                             |
| **CORS** | 可通过 `skill.websocket.allowed-origins` 配置  |

**路径参数：**

| 参数        | 类型     | 说明        |
| ----------- | -------- | ----------- |
| `sessionId` | `String` | 技能会话 ID |

**连接示例：**
```javascript
const ws = new WebSocket('ws://localhost:8082/ws/skill/stream/42');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg.seq, msg.content);
};
```

#### 服务端推送消息格式

```json
{
  "type": "<消息类型>",
  "seq": 1,
  "content": "<消息内容>"
}
```

| 字段      | 类型               | 说明                               |
| --------- | ------------------ | ---------------------------------- |
| `type`    | `String`           | 消息类型（见下表）                 |
| `seq`     | `Long`             | 递增序列号，用于客户端排序         |
| `content` | `String \| Object` | 消息内容，可能是纯文本或 JSON 对象 |

#### 消息类型

| type            | 说明                | content                      |
| --------------- | ------------------- | ---------------------------- |
| `delta`         | 增量内容更新        | AI 生成的文本片段            |
| `done`          | 工具执行完成        | 使用统计信息（token 用量等） |
| `error`         | 错误消息            | 错误描述文本                 |
| `agent_offline` | 关联的 PCAgent 下线 | `null` 或状态描述            |
| `agent_online`  | 关联的 PCAgent 上线 | `null` 或状态描述            |

**推送示例：**

增量内容（delta）：
```json
{
  "type": "delta",
  "seq": 1,
  "content": "好的，我来分析"
}
```

```json
{
  "type": "delta",
  "seq": 2,
  "content": "一下登录模块的代码结构..."
}
```

执行完成（done）：
```json
{
  "type": "done",
  "seq": 10,
  "content": {
    "usage": {
      "inputTokens": 1500,
      "outputTokens": 3200
    }
  }
}
```

Agent 离线通知：
```json
{
  "type": "agent_offline",
  "seq": 11,
  "content": null
}
```

#### 连接行为

| 事件               | 行为                                                    |
| ------------------ | ------------------------------------------------------- |
| 连接建立           | 订阅指定 sessionId 的消息流（支持多客户端订阅同一会话） |
| 连接关闭           | 自动取消订阅；若该会话无剩余订阅者，清理序列计数器      |
| 路径缺少 sessionId | 服务端立即关闭连接，关闭码 `BAD_DATA`                   |
| 传输错误           | 自动移除故障连接                                        |

---

### 5.2 网关内部端点 (Gateway Internal)

AI-Gateway 与 Skill Server 之间的内部 WebSocket 连接。**此端点仅供内部服务间通信，不面向前端客户端**。

| 项目     | 值                                                             |
| -------- | -------------------------------------------------------------- |
| **URL**  | `ws://{host}:8082/ws/internal/gateway?token={internal_token}`  |
| **方向** | 双向                                                           |
| **认证** | 查询参数 `token`，需匹配 `skill.gateway.internal-token` 配置值 |

**查询参数：**

| 参数    | 类型     | 必填   | 说明           |
| ------- | -------- | ------ | -------------- |
| `token` | `String` | **是** | 内部认证 Token |

#### 上行消息（AI-Gateway → Skill Server）

AI-Gateway 向 Skill Server 推送的事件类型：

| 消息类型          | 说明                                        |
| ----------------- | ------------------------------------------- |
| `tool_event`      | OpenCode 原始事件（用于流式推送到前端）     |
| `tool_done`       | 工具执行完成，携带 token 使用统计           |
| `tool_error`      | 工具执行错误                                |
| `agent_online`    | PCAgent 上线通知，携带工具信息              |
| `agent_offline`   | PCAgent 下线通知                            |
| `session_created` | OpenCode 会话创建成功，携带 `toolSessionId` |

#### 下行消息（Skill Server → AI-Gateway）

Skill Server 向 AI-Gateway 发送的调度指令：

| 指令类型           | 说明               | 触发场景            |
| ------------------ | ------------------ | ------------------- |
| `create_session`   | 创建 OpenCode 会话 | 创建技能会话时      |
| `close_session`    | 关闭 OpenCode 会话 | 关闭技能会话时      |
| `chat`             | 发送用户消息       | 用户发送消息时      |
| `permission_reply` | 回复权限确认       | 用户批准/拒绝权限时 |

#### 安全与连接管理

- 每个 Skill Server 实例最多维持 **1 个** Gateway WebSocket 连接
- 新连接建立时，旧连接会被主动关闭
- Token 验证失败的连接会立即被拒绝（关闭码 `NOT_ACCEPTABLE`）

---

## 6. 错误处理

### 6.1 REST API 错误响应

API 在错误场景下返回 `Map<String, Object>` 格式的错误信息：

```json
{
  "success": false,
  "error": "Session is closed"
}
```

### 6.2 常见错误场景

| 场景            | HTTP 状态码 | 错误消息                                               |
| --------------- | ----------- | ------------------------------------------------------ |
| 必填字段缺失    | `400`       | `Content is required` / `Field 'approved' is required` |
| 会话不存在      | `404`       | — （空响应体）                                         |
| 会话已关闭      | `409`       | `Session is closed`                                    |
| 无关联 Agent    | `404`       | `No agent associated with this session`                |
| 无关联 IM 聊天  | `409`       | `No IM chat ID associated`                             |
| IM 消息发送失败 | `500`       | `Failed to send message to IM gateway`                 |

---

## 7. 附录

### 7.1 配置参考

以下为 Skill Server 的关键配置项（`application.yml`）：

| 配置项                                   | 默认值                         | 说明                     |
| ---------------------------------------- | ------------------------------ | ------------------------ |
| `server.port`                            | `8082`                         | 服务端口                 |
| `skill.websocket.allowed-origins`        | `http://localhost:5173`        | WebSocket CORS 允许域    |
| `skill.gateway.internal-token`           | `sk-intl-9f2a7d3e4b1c`         | 网关内部认证 Token       |
| `skill.im.api-url`                       | `http://localhost:8080/api/im` | IM 平台 API 地址         |
| `skill.session.idle-timeout-minutes`     | `30`                           | 会话空闲超时时间（分钟） |
| `skill.session.cleanup-interval-minutes` | `10`                           | 空闲会话清理间隔（分钟） |

### 7.2 接口总览

| #   | 方法     | 路径                                                   | 说明                 |
| --- | -------- | ------------------------------------------------------ | -------------------- |
| 1   | `GET`    | `/api/skill/definitions`                               | 获取技能定义列表     |
| 2   | `POST`   | `/api/skill/sessions`                                  | 创建会话             |
| 3   | `GET`    | `/api/skill/sessions`                                  | 查询会话列表         |
| 4   | `GET`    | `/api/skill/sessions/{id}`                             | 查询会话详情         |
| 5   | `DELETE` | `/api/skill/sessions/{id}`                             | 关闭会话             |
| 6   | `POST`   | `/api/skill/sessions/{sessionId}/messages`             | 发送用户消息         |
| 7   | `GET`    | `/api/skill/sessions/{sessionId}/messages`             | 查询消息历史         |
| 8   | `POST`   | `/api/skill/sessions/{sessionId}/permissions/{permId}` | 回复权限确认         |
| 9   | `POST`   | `/api/skill/sessions/{sessionId}/send-to-im`           | 发送消息到 IM        |
| 10  | `WS`     | `/ws/skill/stream/{sessionId}`                         | 流式推送（面向前端） |
| 11  | `WS`     | `/ws/internal/gateway?token={token}`                   | 网关内部连接         |

### 7.3 数据库表结构

```sql
-- 技能定义表
CREATE TABLE skill_definition (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  skill_code  VARCHAR(50) NOT NULL UNIQUE,
  skill_name  VARCHAR(100) NOT NULL,
  tool_type   VARCHAR(50) NOT NULL DEFAULT 'OPENCODE',
  description VARCHAR(500),
  icon_url    VARCHAR(200),
  status      ENUM('ACTIVE','DISABLED') DEFAULT 'ACTIVE',
  sort_order  INT DEFAULT 0,
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL
);

-- 技能会话表
CREATE TABLE skill_session (
  id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id             BIGINT NOT NULL,
  skill_definition_id BIGINT NOT NULL,
  agent_id            BIGINT,
  tool_session_id     VARCHAR(128),
  title               VARCHAR(200),
  status              ENUM('ACTIVE','IDLE','CLOSED') DEFAULT 'ACTIVE',
  im_chat_id          VARCHAR(128),
  created_at          DATETIME NOT NULL,
  last_active_at      DATETIME NOT NULL,
  INDEX idx_user_active (user_id, status),
  INDEX idx_agent (agent_id)
);

-- 技能消息表
CREATE TABLE skill_message (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id   BIGINT NOT NULL,
  seq          INT NOT NULL,
  role         ENUM('USER','ASSISTANT','SYSTEM','TOOL') NOT NULL,
  content      MEDIUMTEXT NOT NULL,
  content_type ENUM('MARKDOWN','CODE','PLAIN') DEFAULT 'MARKDOWN',
  created_at   DATETIME NOT NULL,
  meta         JSON,
  INDEX idx_session_seq (session_id, seq)
);
```
