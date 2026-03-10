# 层① 接口协议：Miniapp ↔ Skill Server

> 版本：1.1  
> 日期：2026-03-08  
> 状态：待实现

---

## 全局约定

### ID 命名规范

| 名称              | 说明                           |
| ----------------- | ------------------------------ |
| `welinkSessionId` | Skill Server 内部分配的会话 ID |
| `toolSessionId`   | OpenCode SDK 分配的会话 ID     |

### 会话状态枚举

| 状态     | 说明                             |
| -------- | -------------------------------- |
| `ACTIVE` | 会话活跃中，可收发消息           |
| `IDLE`   | 会话超时闲置，由定时任务自动标记 |
| `CLOSED` | 会话已关闭，不可再发送消息       |

### REST API 响应格式

所有 REST 接口统一返回 HTTP `200 OK`，响应体结构如下：

```json
{
  "code": 0,
  "errormsg": "",
  "data": { ... }
}
```

| 字段       | 类型          | 说明                                   |
| ---------- | ------------- | -------------------------------------- |
| `code`     | Integer       | 结果返回码，`0` 表示成功，非零表示错误 |
| `errormsg` | String        | 错误信息，成功时为空字符串             |
| `data`     | Object / null | 正常返回内容，错误时为 `null`          |

---

## 一、REST API

> 基础路径：`/api/skill`  
> 认证方式：Cookie（所有接口从 Cookie 中解析 `userId`，类型 `String`）  
> Content-Type：`application/json`

---

### 1. 创建会话

**POST** `/api/skill/sessions`

#### 请求

| 字段        | 类型   | 必填  | 说明                                                |
| ----------- | ------ | :---: | --------------------------------------------------- |
| `ak`        | String |   ✅   | Agent Plugin 对应的 Access Key，用于定位 Agent 连接 |
| `title`     | String |   ❌   | 会话标题，不填则由 AI 自动生成                      |
| `imGroupId` | String |   ✅   | 关联的 IM 群组 ID                                   |

```json
{
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "imGroupId": "group_abc123"
}
```

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "welinkSessionId": 42,
    "userId": "10001",
    "ak": "ak_xxxxxxxx",
    "title": "帮我创建一个React项目",
    "imGroupId": "group_abc123",
    "status": "ACTIVE",
    "toolSessionId": null,
    "createdAt": "2026-03-08T00:15:00",
    "updatedAt": "2026-03-08T00:15:00"
  }
}
```

| data 字段         | 类型   | 说明                                           |
| ----------------- | ------ | ---------------------------------------------- |
| `welinkSessionId` | Long   | 会话 ID                                        |
| `userId`          | String | 用户 ID（从 Cookie 解析）                      |
| `ak`              | String | Access Key                                     |
| `title`           | String | 会话标题                                       |
| `imGroupId`       | String | IM 群组 ID                                     |
| `status`          | String | 会话状态：`ACTIVE`                             |
| `toolSessionId`   | String | OpenCode Session ID，创建时为 `null`，异步填充 |
| `createdAt`       | String | 创建时间，ISO-8601                             |
| `updatedAt`       | String | 更新时间，ISO-8601                             |

#### 内部副作用

1. 创建 `SkillSession` 记录（`status=ACTIVE`，`toolSessionId=null`）
2. 订阅 Redis `session:{welinkSessionId}` 广播频道
3. 若通过 `ak` 找到在线 Agent → 向 Gateway 发送 `invoke.create_session`

---

### 2. 发送消息

**POST** `/api/skill/sessions/{welinkSessionId}/messages`

#### 路径参数

| 参数              | 类型 | 说明    |
| ----------------- | ---- | ------- |
| `welinkSessionId` | Long | 会话 ID |

#### 请求

| 字段         | 类型   | 必填  | 说明                                                           |
| ------------ | ------ | :---: | -------------------------------------------------------------- |
| `content`    | String |   ✅   | 用户消息文本                                                   |
| `toolCallId` | String |   ❌   | 回答 AI question 时携带对应的工具调用 ID。不带则按普通消息处理 |

```json
{
  "content": "帮我创建一个React项目"
}
```

回答 AI question 时：

```json
{
  "content": "Vite",
  "toolCallId": "call_2"
}
```

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "id": 101,
    "welinkSessionId": 42,
    "userId": "10001",
    "role": "user",
    "content": "帮我创建一个React项目",
    "messageSeq": 3,
    "createdAt": "2026-03-08T00:16:00"
  }
}
```

| data 字段         | 类型    | 说明                   |
| ----------------- | ------- | ---------------------- |
| `id`              | Long    | 消息 ID                |
| `welinkSessionId` | Long    | 所属会话 ID            |
| `userId`          | String  | 发送用户 ID            |
| `role`            | String  | 角色，固定 `"user"`    |
| `content`         | String  | 消息内容               |
| `messageSeq`      | Integer | 该消息在会话内的顺序号 |
| `createdAt`       | String  | 创建时间，ISO-8601     |

#### 内部副作用

1. 从 Cookie 解析 `userId`，持久化 user message 到 MySQL（含 `userId`）
2. 查询 session 记录获取 `toolSessionId`
3. 根据是否携带 `toolCallId` 分支处理：
   - **无 `toolCallId`**：构建 `invoke.chat` payload（`{ toolSessionId, text: content }`）发送至 Gateway
   - **有 `toolCallId`**：构建 `invoke.question_reply` payload（`{ toolSessionId, toolCallId, answer: content }`）发送至 Gateway

---

### 3. 回复权限请求

**POST** `/api/skill/sessions/{welinkSessionId}/permissions/{permId}`

#### 路径参数

| 参数              | 类型   | 说明        |
| ----------------- | ------ | ----------- |
| `welinkSessionId` | Long   | 会话 ID     |
| `permId`          | String | 权限请求 ID |

#### 请求

| 字段       | 类型   | 必填  | 值域                         | 说明                           |
| ---------- | ------ | :---: | ---------------------------- | ------------------------------ |
| `response` | String |   ✅   | `once` / `always` / `reject` | 直接使用 OpenCode SDK 定义的值 |

含义：

- `once` — 仅本次允许
- `always` — 永久允许（同类操作不再询问）
- `reject` — 拒绝

```json
{
  "response": "once"
}
```

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "welinkSessionId": 42,
    "permissionId": "perm_1",
    "response": "once"
  }
}
```

| data 字段         | 类型   | 说明        |
| ----------------- | ------ | ----------- |
| `welinkSessionId` | Long   | 会话 ID     |
| `permissionId`    | String | 权限请求 ID |
| `response`        | String | 回复值      |

#### 内部副作用

1. 构建 `invoke.permission_reply` payload（`{ toolSessionId, permissionId, response }`）发送至 Gateway
2. PC Agent 直接将 `response` 原值透传给 OpenCode SDK，无需转换

---

### 4. 中止会话执行

**POST** `/api/skill/sessions/{welinkSessionId}/abort`

#### 路径参数

| 参数              | 类型 | 说明    |
| ----------------- | ---- | ------- |
| `welinkSessionId` | Long | 会话 ID |

#### 请求

无请求体。

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "welinkSessionId": 42,
    "status": "aborted"
  }
}
```

#### 内部副作用

1. 向 Gateway 发送 `invoke.abort_session`（`{ toolSessionId }`）
2. PC Agent 调用 `session.abort()` 中止当前执行
3. Skill Session 状态**不变**（仍为 `ACTIVE`），可以继续发消息

---

### 5. 关闭并删除会话

**DELETE** `/api/skill/sessions/{welinkSessionId}`

#### 路径参数

| 参数              | 类型 | 说明    |
| ----------------- | ---- | ------- |
| `welinkSessionId` | Long | 会话 ID |

#### 请求

无请求体。

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "welinkSessionId": 42,
    "status": "closed"
  }
}
```

#### 内部副作用

1. 向 Gateway 发送 `invoke.close_session`（`{ toolSessionId }`）
2. PC Agent 调用 `session.delete()` 删除 OpenCode session
3. 更新 `SkillSession.status = CLOSED`
4. 取消订阅 Redis `session:{welinkSessionId}` 广播频道

---

### 6. 查询历史消息

**GET** `/api/skill/sessions/{welinkSessionId}/messages`

#### 路径参数

| 参数              | 类型 | 说明    |
| ----------------- | ---- | ------- |
| `welinkSessionId` | Long | 会话 ID |

#### 查询参数

| 参数   | 类型 | 默认值 | 说明     |
| ------ | ---- | :----: | -------- |
| `page` | int  |   0    | 页码     |
| `size` | int  |   50   | 每页条数 |

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "content": [
      {
        "id": 101,
        "welinkSessionId": 42,
        "userId": "10001",
        "role": "user",
        "content": "帮我创建一个React项目",
        "messageSeq": 1,
        "parts": [],
        "createdAt": "2026-03-08T00:15:00"
      },
      {
        "id": 102,
        "welinkSessionId": 42,
        "userId": null,
        "role": "assistant",
        "content": "好的，我来帮你创建...",
        "messageSeq": 2,
        "parts": [
          {
            "partId": "p_1",
            "partSeq": 1,
            "type": "text",
            "content": "好的，我来帮你创建..."
          },
          {
            "partId": "p_2",
            "partSeq": 2,
            "type": "tool",
            "toolName": "bash",
            "toolStatus": "completed",
            "toolInput": { "command": "npx create-vite" },
            "toolOutput": "Done."
          }
        ],
        "createdAt": "2026-03-08T00:15:05"
      }
    ],
    "page": 0,
    "size": 50,
    "total": 2
  }
}
```

---

### 7. 查询会话列表

**GET** `/api/skill/sessions`

#### 查询参数

| 参数        | 类型   | 必填  | 默认值 | 说明                                        |
| ----------- | ------ | :---: | :----: | ------------------------------------------- |
| `imGroupId` | String |   ❌   |   —    | 按 IM 群组 ID 过滤                          |
| `ak`        | String |   ❌   |   —    | 按 Access Key 过滤                          |
| `page`      | int    |   ❌   |   0    | 页码                                        |
| `size`      | int    |   ❌   |   20   | 每页条数                                    |
| `status`    | String |   ❌   |   —    | 可选过滤：`ACTIVE` / `CLOSED`，不传返回全部 |

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "content": [
      {
        "welinkSessionId": 42,
        "userId": "10001",
        "ak": "ak_xxxxxxxx",
        "title": "帮我创建一个React项目",
        "imGroupId": "group_abc123",
        "status": "ACTIVE",
        "toolSessionId": "ses_abc",
        "createdAt": "2026-03-08T00:15:00",
        "updatedAt": "2026-03-08T00:16:00"
      }
    ],
    "page": 0,
    "size": 20,
    "total": 1
  }
}
```

---

### 8. 查询单个会话

**GET** `/api/skill/sessions/{welinkSessionId}`

#### 路径参数

| 参数              | 类型 | 说明    |
| ----------------- | ---- | ------- |
| `welinkSessionId` | Long | 会话 ID |

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "welinkSessionId": 42,
    "userId": "10001",
    "ak": "ak_xxxxxxxx",
    "title": "帮我创建一个React项目",
    "imGroupId": "group_abc123",
    "status": "ACTIVE",
    "toolSessionId": "ses_abc",
    "createdAt": "2026-03-08T00:15:00",
    "updatedAt": "2026-03-08T00:16:00"
  }
}
```

---

### 9. 发送内容到 IM 群聊

**POST** `/api/skill/sessions/{welinkSessionId}/send-to-im`

将 AI 回复的文本内容转发到关联的 IM 群组。

#### 路径参数

| 参数              | 类型 | 说明    |
| ----------------- | ---- | ------- |
| `welinkSessionId` | Long | 会话 ID |

#### 请求

```json
{
  "content": "这是 AI 生成的代码片段...",
  "chatId": "group_abc123"
}
```

| 字段      | 类型   | 必填  | 说明                                             |
| --------- | ------ | :---: | ------------------------------------------------ |
| `content` | String |   ✅   | 要发送的文本内容                                 |
| `chatId`  | String |   ❌   | 目标 IM 群组 ID，不传则从会话的 `imGroupId` 获取 |

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": {
    "success": true
  }
}
```

---

### 10. 查询在线 Agent 列表

**GET** `/api/skill/agents`

查询当前用户名下在线的 Agent 列表（代理到 Gateway 的 `/api/gateway/agents`）。

#### 请求

无请求体。从 Cookie 解析 `userId`。

#### 响应

```json
{
  "code": 0,
  "errormsg": "",
  "data": [
    {
      "ak": "ak_xxxxxxxx",
      "akId": "ak_xxxxxxxx",
      "toolType": "OPENCODE",
      "toolVersion": "1.0.0",
      "deviceName": "MyPC",
      "os": "WINDOWS"
    }
  ]
}
```

| data[] 字段   | 类型   | 说明                  |
| ------------- | ------ | --------------------- |
| `ak`          | String | Agent 的 Access Key   |
| `akId`        | String | 同 `ak`，前端兼容字段 |
| `toolType`    | String | 工具类型              |
| `toolVersion` | String | 工具版本号            |
| `deviceName`  | String | 设备名称              |
| `os`          | String | 操作系统              |

---

## 二、WebSocket 实时流协议

### 连接信息

| 项目         | 值                                                                  |
| ------------ | ------------------------------------------------------------------- |
| **端点**     | `ws://host/ws/skill/stream`                                         |
| **认证**     | Cookie → 解析 `userId`（String）                                    |
| **推送策略** | 自动推送该用户所有 ACTIVE 会话的事件，前端按 `welinkSessionId` 分流 |
| **传输格式** | JSON                                                                |
| **方向**     | 服务端 → 客户端（单向推送）                                         |

---

### 公共字段

#### 传输层（所有消息都有）

| 字段              | 类型    | 必填  | 说明                                         |
| ----------------- | ------- | :---: | -------------------------------------------- |
| `type`            | String  |   ✅   | 消息类型标识                                 |
| `seq`             | Integer |   ✅   | 传输序号，单调递增，用于排序、去重、丢包检测 |
| `welinkSessionId` | String  |   ✅   | 会话 ID，前端据此分流到对应会话              |
| `emittedAt`       | String  |   ✅   | 事件发出时间，ISO-8601                       |
| `raw`             | Object  |   ❌   | 原始 OpenCode 事件，仅调试用                 |

#### 消息层（归属到某条聊天气泡的事件额外携带）

| 字段         | 类型    | 必填  | 说明                                                   |
| ------------ | ------- | :---: | ------------------------------------------------------ |
| `messageId`  | String  |   ✅   | Skill Server 分配的稳定消息 ID，同一气泡生命周期内不变 |
| `messageSeq` | Integer |   ✅   | 会话内消息顺序，与历史消息 API 返回的顺序对齐          |
| `role`       | String  |   ✅   | 消息角色：`user` / `assistant` / `system` / `tool`     |

#### Part 层（归属到消息中某个部件的事件额外携带）

| 字段      | 类型    | 必填  | 说明                                     |
| --------- | ------- | :---: | ---------------------------------------- |
| `partId`  | String  |   ✅   | Part 唯一 ID，用于增量更新定位           |
| `partSeq` | Integer |   ❌   | Part 在消息内的顺序，用于恢复/回放时排序 |

---

### 消息类型总览

| 分类 | type               |    字段层级    | 说明                     |
| ---- | ------------------ | :------------: | ------------------------ |
| 内容 | `text.delta`       | 传输+消息+Part | AI 文本流式追加          |
| 内容 | `text.done`        | 传输+消息+Part | AI 文本完成              |
| 内容 | `thinking.delta`   | 传输+消息+Part | 思维链流式追加           |
| 内容 | `thinking.done`    | 传输+消息+Part | 思维链完成               |
| 内容 | `tool.update`      | 传输+消息+Part | 工具调用状态更新         |
| 内容 | `question`         | 传输+消息+Part | AI 提问交互              |
| 内容 | `file`             | 传输+消息+Part | 文件/图片附件            |
| 状态 | `step.start`       |   传输+消息    | 推理步骤开始             |
| 状态 | `step.done`        |   传输+消息    | 推理步骤结束             |
| 状态 | `session.status`   |     仅传输     | 会话状态变化             |
| 状态 | `session.title`    |     仅传输     | 会话标题变化             |
| 状态 | `session.error`    |     仅传输     | 会话级错误               |
| 交互 | `permission.ask`   |   传输+消息    | 权限请求                 |
| 交互 | `permission.reply` |   传输+消息    | 权限响应结果             |
| 系统 | `agent.online`     |     仅传输     | Agent 上线               |
| 系统 | `agent.offline`    |     仅传输     | Agent 下线               |
| 系统 | `error`            |     仅传输     | 非会话级错误             |
| 恢复 | `snapshot`         |     仅传输     | 断线恢复：已完成消息快照 |
| 恢复 | `streaming`        |     仅传输     | 断线恢复：进行中的流消息 |

---

### 消息类型详细定义

#### `text.delta` — AI 文本流式追加

`content` 为增量文本，前端拼接到该 `partId` 已有内容之后。

```json
{
  "type": "text.delta",
  "seq": 4,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:01.123Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_1",
  "partSeq": 1,
  "content": "好的，"
}
```

| 特有字段  | 类型   | 说明         |
| --------- | ------ | ------------ |
| `content` | String | 增量文本片段 |

---

#### `text.done` — AI 文本完成

`content` 为该 Part 的最终完整文本。

```json
{
  "type": "text.done",
  "seq": 8,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:05.000Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_1",
  "partSeq": 1,
  "content": "好的，我来帮你创建一个React项目。"
}
```

| 特有字段  | 类型   | 说明                   |
| --------- | ------ | ---------------------- |
| `content` | String | 该 Part 的最终完整文本 |

---

#### `thinking.delta` — 思维链流式追加

前端渲染为可折叠的"思考过程"区域。`content` 为增量文本。

```json
{
  "type": "thinking.delta",
  "seq": 3,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:00.500Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_0",
  "partSeq": 0,
  "content": "用户需要创建React项目，我应该..."
}
```

| 特有字段  | 类型   | 说明           |
| --------- | ------ | -------------- |
| `content` | String | 增量思维链文本 |

---

#### `thinking.done` — 思维链完成

```json
{
  "type": "thinking.done",
  "seq": 5,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:01.500Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_0",
  "partSeq": 0,
  "content": "用户需要创建React项目，我应该使用Vite来初始化。"
}
```

| 特有字段  | 类型   | 说明                         |
| --------- | ------ | ---------------------------- |
| `content` | String | 该 Part 的最终完整思维链文本 |

---

#### `tool.update` — 工具调用状态更新

ToolPart 状态机：`pending → running → completed / error`。

```json
{
  "type": "tool.update",
  "seq": 6,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:02.000Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_3",
  "partSeq": 3,
  "toolName": "bash",
  "toolCallId": "call_1",
  "status": "completed",
  "input": { "command": "npx create-vite my-app" },
  "output": "Scaffolding project in ./my-app...\nDone.",
  "title": "Execute bash command"
}
```

| 特有字段     | 类型   | 必填  | 说明                                                |
| ------------ | ------ | :---: | --------------------------------------------------- |
| `toolName`   | String |   ✅   | 工具名称（`bash` / `edit` / `read` 等）             |
| `toolCallId` | String |   ❌   | 工具调用 ID                                         |
| `status`     | String |   ✅   | 状态：`pending` / `running` / `completed` / `error` |
| `input`      | Object |   ❌   | 工具输入参数                                        |
| `output`     | String |   ❌   | 工具输出结果（`completed` 时）                      |
| `error`      | String |   ❌   | 错误信息（`error` 时）                              |
| `title`      | String |   ❌   | 工具执行摘要标题                                    |

---

#### `question` — AI 提问交互

AI 通过内置 `question` 工具向用户提问，阻塞等待用户选择或输入。

```json
{
  "type": "question",
  "seq": 5,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:02.500Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_2",
  "partSeq": 2,
  "toolName": "question",
  "toolCallId": "call_2",
  "status": "running",
  "header": "项目配置",
  "question": "选择模板框架",
  "options": ["Vite", "CRA", "Next.js"]
}
```

| 特有字段     | 类型     | 必填  | 说明                               |
| ------------ | -------- | :---: | ---------------------------------- |
| `toolName`   | String   |   ✅   | 固定 `"question"`                  |
| `toolCallId` | String   |   ❌   | 工具调用 ID                        |
| `status`     | String   |   ✅   | 固定 `"running"`（等待用户回答）   |
| `header`     | String   |   ❌   | 问题分组标题                       |
| `question`   | String   |   ✅   | 问题正文                           |
| `options`    | String[] |   ❌   | 预设选项列表，用户可选择或自由输入 |

用户回答方式：调用 REST API `POST /api/skill/sessions/{welinkSessionId}/messages` 发送回答文本。

---

#### `file` — 文件/图片附件

```json
{
  "type": "file",
  "seq": 10,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:06.000Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "partId": "p_5",
  "partSeq": 5,
  "fileName": "screenshot.png",
  "fileUrl": "https://...",
  "fileMime": "image/png"
}
```

| 特有字段   | 类型   | 必填  | 说明         |
| ---------- | ------ | :---: | ------------ |
| `fileName` | String |   ❌   | 文件名       |
| `fileUrl`  | String |   ✅   | 文件访问 URL |
| `fileMime` | String |   ❌   | MIME 类型    |

---

#### `step.start` — 推理步骤开始

AI 开始一轮推理步骤。

```json
{
  "type": "step.start",
  "seq": 2,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:00.000Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant"
}
```

无特有字段。

---

#### `step.done` — 推理步骤结束

一轮推理步骤完成，包含 token 统计。

```json
{
  "type": "step.done",
  "seq": 9,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:05.500Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "tokens": {
    "input": 5000,
    "output": 200,
    "reasoning": 800,
    "cache": { "read": 100, "write": 50 }
  },
  "cost": 0.01,
  "reason": "stop"
}
```

| 特有字段           | 类型    | 必填  | 说明                             |
| ------------------ | ------- | :---: | -------------------------------- |
| `tokens`           | Object  |   ❌   | Token 使用统计                   |
| `tokens.input`     | Integer |   ❌   | 输入 token 数                    |
| `tokens.output`    | Integer |   ❌   | 输出 token 数                    |
| `tokens.reasoning` | Integer |   ❌   | 推理 token 数                    |
| `tokens.cache`     | Object  |   ❌   | 缓存命中统计                     |
| `cost`             | Number  |   ❌   | 本步骤费用                       |
| `reason`           | String  |   ❌   | 结束原因（`stop` / `length` 等） |

---

#### `session.status` — 会话状态变化

```json
{
  "type": "session.status",
  "seq": 1,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:00.000Z",
  "sessionStatus": "busy"
}
```

| 特有字段        | 类型   | 必填  | 说明                                                    |
| --------------- | ------ | :---: | ------------------------------------------------------- |
| `sessionStatus` | String |   ✅   | `busy` — AI 正在推理 / `idle` — 空闲 / `retry` — 重试中 |

---

#### `session.title` — 会话标题变化

AI 自动为会话生成或更新标题时触发。

```json
{
  "type": "session.title",
  "seq": 11,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:10.000Z",
  "title": "React项目创建与配置"
}
```

| 特有字段 | 类型   | 必填  | 说明   |
| -------- | ------ | :---: | ------ |
| `title`  | String |   ✅   | 新标题 |

---

#### `session.error` — 会话级错误

```json
{
  "type": "session.error",
  "seq": 12,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:12.000Z",
  "error": "OpenCode runtime connection lost"
}
```

| 特有字段 | 类型   | 必填  | 说明     |
| -------- | ------ | :---: | -------- |
| `error`  | String |   ✅   | 错误描述 |

---

#### `permission.ask` — 权限请求

OpenCode 需要执行受限操作（如 shell 命令、文件写入）前发出审批请求。

```json
{
  "type": "permission.ask",
  "seq": 7,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:03.000Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "permissionId": "perm_1",
  "permType": "bash",
  "title": "Execute shell command",
  "metadata": {
    "command": "npx create-vite my-app"
  }
}
```

| 特有字段       | 类型   | 必填  | 说明                                 |
| -------------- | ------ | :---: | ------------------------------------ |
| `permissionId` | String |   ✅   | 权限请求唯一 ID                      |
| `permType`     | String |   ❌   | 权限类型（`bash` / `file_write` 等） |
| `title`        | String |   ❌   | 操作摘要                             |
| `metadata`     | Object |   ❌   | 操作详情（命令内容、文件路径等）     |

用户回复方式：调用 REST API `POST /api/skill/sessions/{welinkSessionId}/permissions/{permId}`。

---

#### `permission.reply` — 权限响应结果

权限请求被处理后的结果通知。

```json
{
  "type": "permission.reply",
  "seq": 8,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:16:04.000Z",
  "messageId": "m_2",
  "messageSeq": 2,
  "role": "assistant",
  "permissionId": "perm_1",
  "response": "once"
}
```

| 特有字段       | 类型   | 必填  | 说明                                 |
| -------------- | ------ | :---: | ------------------------------------ |
| `permissionId` | String |   ✅   | 权限请求 ID                          |
| `response`     | String |   ✅   | 回复值：`once` / `always` / `reject` |

---

#### `agent.online` — Agent 上线

关联的 PC Agent 建立连接。

```json
{
  "type": "agent.online",
  "seq": 0,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:14:00.000Z"
}
```

无特有字段。

---

#### `agent.offline` — Agent 下线

关联的 PC Agent 断开连接。

```json
{
  "type": "agent.offline",
  "seq": 13,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:20:00.000Z"
}
```

无特有字段。

---

#### `error` — 非会话级错误

Gateway 连接异常等系统级错误。

```json
{
  "type": "error",
  "seq": 14,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:21:00.000Z",
  "error": "Gateway connection timeout"
}
```

| 特有字段 | 类型   | 必填  | 说明     |
| -------- | ------ | :---: | -------- |
| `error`  | String |   ✅   | 错误描述 |

---

#### `snapshot` — 断线恢复：已完成消息快照

客户端重连后，服务端推送当前会话的已完成消息列表。

```json
{
  "type": "snapshot",
  "seq": 1,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:22:00.000Z",
  "messages": [
    {
      "id": "m_1",
      "seq": 1,
      "role": "user",
      "content": "帮我创建React项目",
      "contentType": "plain",
      "createdAt": "2026-03-08T00:15:00"
    },
    {
      "id": "m_2",
      "seq": 2,
      "role": "assistant",
      "content": "好的，我来帮你创建...",
      "contentType": "markdown",
      "parts": [
        {
          "partId": "p_1",
          "partSeq": 1,
          "type": "text",
          "content": "好的，我来帮你创建..."
        }
      ]
    }
  ]
}
```

| 特有字段                 | 类型    | 必填  | 说明                          |
| ------------------------ | ------- | :---: | ----------------------------- |
| `messages`               | Array   |   ✅   | 已完成消息列表                |
| `messages[].id`          | String  |   ✅   | 消息 ID                       |
| `messages[].seq`         | Integer |   ✅   | 消息顺序                      |
| `messages[].role`        | String  |   ✅   | 角色                          |
| `messages[].content`     | String  |   ✅   | 消息内容                      |
| `messages[].contentType` | String  |   ✅   | `plain` / `markdown` / `code` |
| `messages[].createdAt`   | String  |   ❌   | 创建时间                      |
| `messages[].parts`       | Array   |   ❌   | Part 列表                     |

---

#### `streaming` — 断线恢复：进行中的流消息

客户端重连后，若有正在进行中的 AI 响应，推送当前累积状态。

```json
{
  "type": "streaming",
  "seq": 2,
  "welinkSessionId": "42",
  "emittedAt": "2026-03-08T00:22:00.100Z",
  "sessionStatus": "busy",
  "messageId": "m_3",
  "messageSeq": 3,
  "role": "assistant",
  "parts": [
    {
      "partId": "p_1",
      "partSeq": 1,
      "type": "text",
      "content": "好的，我正在分析你的代码..."
    },
    {
      "partId": "p_2",
      "partSeq": 2,
      "type": "tool",
      "toolName": "bash",
      "toolCallId": "call_1",
      "status": "running"
    }
  ]
}
```

| 特有字段             | 类型     | 必填  | 说明                                                              |
| -------------------- | -------- | :---: | ----------------------------------------------------------------- |
| `sessionStatus`      | String   |   ✅   | `busy` / `idle`                                                   |
| `messageId`          | String   |   ❌   | 当前消息 ID                                                       |
| `messageSeq`         | Integer  |   ❌   | 当前消息顺序                                                      |
| `role`               | String   |   ❌   | 角色                                                              |
| `parts`              | Array    |   ✅   | 当前已累积的 Part 列表                                            |
| `parts[].partId`     | String   |   ✅   | Part ID                                                           |
| `parts[].partSeq`    | Integer  |   ❌   | Part 顺序                                                         |
| `parts[].type`       | String   |   ✅   | `text` / `thinking` / `tool` / `question` / `permission` / `file` |
| `parts[].content`    | String   |   ❌   | 文本内容                                                          |
| `parts[].toolName`   | String   |   ❌   | 工具名                                                            |
| `parts[].toolCallId` | String   |   ❌   | 工具调用 ID                                                       |
| `parts[].status`     | String   |   ❌   | 工具状态                                                          |
| `parts[].header`     | String   |   ❌   | question 标题                                                     |
| `parts[].question`   | String   |   ❌   | question 问题                                                     |
| `parts[].options`    | String[] |   ❌   | question 选项                                                     |
| `parts[].fileName`   | String   |   ❌   | 文件名                                                            |
| `parts[].fileUrl`    | String   |   ❌   | 文件 URL                                                          |
| `parts[].fileMime`   | String   |   ❌   | MIME 类型                                                         |
