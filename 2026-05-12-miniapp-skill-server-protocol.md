# MiniApp ↔ Skill-Server 接入协议（前端对接完整规范）

> **目的**：为 Skill MiniApp 前端团队提供与 Skill-Server（SS）对接的完整、可直接对照开发的协议契约。
> **协议范围**：miniapp WebSocket 出站（SS → 前端）+ HTTP 入站（前端 → SS）。
> **代码源**：见 §9 字段↔代码映射。

---

## 目录

- [1. 概览](#1-概览)
- [2. 接入契约（endpoint / 握手）](#2-接入契约endpoint--握手)
- [3. 鉴权](#3-鉴权)
- [4. 入站 HTTP 请求公共字段](#4-入站-http-请求公共字段)
- [5. 入站动作清单（miniapp → SS）](#5-入站动作清单miniapp--ss)
- [6. 出站 StreamMessage 公共字段](#6-出站-streammessage-公共字段)
- [7. 出站事件清单（SS → miniapp）](#7-出站事件清单ss--miniapp)
- [8. 长连接保活与生命周期](#8-长连接保活与生命周期)
- [9. 错误处理矩阵](#9-错误处理矩阵)
- [10. 配置项一览](#10-配置项一览)
- [11. 字段↔代码映射（实现验证）](#11-字段代码映射实现验证)
- [12. 给前端开发者的注意事项](#12-给前端开发者的注意事项)
- [13. Subagent 协议（子代理事件路由）](#13-subagent-协议子代理事件路由)
- [14. 变更记录](#14-变更记录)

---

## 1. 概览

### 1.1 角色

| 角色 | 职责 |
|---|---|
| **miniapp**（前端） | 浏览器/小程序客户端，通过 Cookie 鉴权连 WebSocket，通过 REST 发起会话/消息/权限应答 |
| **skill-server**（SS） | 协议网关：HTTP 入站持久化 + 路由到 ai-gateway；WebSocket 出站统一翻译 StreamMessage |
| **ai-gateway**（GW） | SS 下游，本协议**不**涉及；SS 通过内部 WS 转发 INVOKE |

### 1.2 总链路

```
[miniapp 前端]
   │
   ├── HTTP POST /api/skill/sessions                   (创建会话)
   ├── HTTP POST /api/skill/sessions/{id}/messages     (发用户消息 / question_reply)
   ├── HTTP POST /api/skill/sessions/{id}/permissions/{permId}  (权限应答)
   ├── HTTP POST /api/skill/sessions/{id}/abort        (中止会话)
   ├── HTTP DELETE /api/skill/sessions/{id}            (关闭会话)
   ├── HTTP GET  /api/skill/sessions/{id}/messages[/history]    (历史消息)
   ├── HTTP GET  /api/skill/agents                     (在线 Agent 查询)
   │
   └── WS /ws/skill/stream                             (出站事件流，每用户一条)
            ↑ StreamMessage（JSON 平铺，26 种 type）
            │
        skill-server  → 内部 WS → ai-gateway → 后端 Agent
```

### 1.3 主要场景

| 场景 | 入站动作 | 出站事件序列（典型） |
|---|---|---|
| 用户发消息 | `POST /messages` | `message.user` → `session.status(busy)` → `step.start` → `thinking.*` → `text.*` → `tool.update` → `step.done` → `session.status(idle)` |
| 用户回答 question | `POST /messages` 带 `toolCallId` | `question(completed)` → `text.*` → `step.done` |
| 用户应答 permission | `POST /permissions/{permId}` | `permission.reply` → `tool.update(completed)` |
| 重连恢复 | WS 重连 / `{"action":"resume"}` | `snapshot` → `streaming` |

---

## 2. 接入契约（endpoint / 握手）

### 2.1 出站 WebSocket

```
GET ws(s)://<host>/ws/skill/stream
Cookie: userId=<account>
```

- 协议：标准 WebSocket（无 subprotocol 协商）。
- 允许 Origin：由 `skill.websocket.allowed-origins` 控制，默认 `*`（`SkillConfig.registerWebSocketHandlers`）。
- 帧格式：每帧一条 JSON 文本（`TextMessage`），**无外层信封**，直接序列化 `StreamMessage`。
- 单用户多连接：同 userId 多 tab/设备共存，订阅集为 `CopyOnWriteArraySet`，每条消息广播给全部活跃订阅。

### 2.2 入站 HTTP

| 入站类 | 路径前缀 | 文件 |
|---|---|---|
| `SkillSessionController` | `/api/skill/sessions` | `controller/SkillSessionController.java` |
| `SkillMessageController` | `/api/skill/sessions/{sessionId}` | `controller/SkillMessageController.java` |
| `AgentQueryController` | `/api/skill/agents` | `controller/AgentQueryController.java` |

> 注：external 业务模块走独立的 `ExternalInboundController` + `/ws/external/stream`，不在本文档范围；IM 走 `ImInboundController`（`/api/inbound`），也不在范围。

### 2.3 客户端 → 服务端控制消息（WS 入帧）

WS 出站基本是单向（SS → 前端），但客户端可在已建立的连接上发送以下 JSON 控制帧：

| `action` 字段 | 行为 | 处理 |
|---|---|---|
| `"resume"` | 重发当前用户所有活跃会话的 `snapshot` + `streaming` | `SkillStreamHandler.handleTextMessage()` |
| `"ping"` | 心跳，仅打 DEBUG 日志，不响应 | `SkillStreamHandler.handleTextMessage()` |
| 其他 | 仅 DEBUG 日志 | 同上 |

```json
{"action": "ping"}
```

```json
{"action": "resume"}
```

---

## 3. 鉴权

### 3.1 Cookie

所有入站 HTTP 与 WebSocket 握手**统一**通过 Cookie `userId` 鉴权。

- 入站 HTTP：所有 controller 用 `@CookieValue(value = "userId", required = false)` 读 cookie，进入 `SessionAccessControlService.requireUserId()` 校验；空 → 抛 `ProtocolException(400, "userId is required")`。
- WebSocket 握手：`SkillStreamHandler.afterConnectionEstablished()` 从 handshake 头读 `Cookie`，调 `extractUserIdFromCookie()` 解析；缺失 → 用 `CloseStatus.BAD_DATA.withReason("Missing userId cookie")` 关闭。

### 3.2 会话归属

进一步的访问控制：`SessionAccessControlService.requireSessionAccess(sessionId, userIdCookie)` 校验 `session.userId == cookie.userId`，否则 `ProtocolException(403, "Session access denied")`。

WebSocket 推送侧也做归属校验：`SkillStreamHandler.resolveRecipients()` 通过 `sessionId → ownerUserId` 缓存（`Caffeine`，1h TTL）把消息精确投递给会话主人。

### 3.3 Cookie 格式

```
Cookie: userId=900001
```

> 多 cookie 时按 `;` 切分逐个 trim 后匹配 `userId=` 前缀；首匹配生效。

---

## 4. 入站 HTTP 请求公共字段

| Header / Cookie | 必填 | 说明 |
|---|---|---|
| `Cookie: userId=<id>` | ✅ | 用户身份，所有入站接口必需 |
| `Content-Type: application/json` | POST/DELETE 时 ✅ | body 永远是 JSON |

入站统一响应包络（`ApiResponse<T>`）：

```json
{
  "code": 200,
  "message": "ok",
  "data": { /* 接口返回体 */ }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | int | HTTP 语义码（200 成功；400/403/409/410/500/503 见 §9） |
| `message` | String | 文案描述 |
| `data` | Object \| null | 业务返回体（成功时） |

---

## 5. 入站动作清单（miniapp → SS）

### 5.1 创建会话

```http
POST /api/skill/sessions
Cookie: userId=900001
Content-Type: application/json

{
  "ak": "AK123456789",
  "title": "JDK8 与 JDK21 的区别",
  "assistantAccount": "e2e-cb-bot",
  "businessSessionDomain": null,
  "businessSessionType": null,
  "businessSessionId": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ak` | String | | 应用 AK（无 ak 的纯本地会话也合法） |
| `title` | String | | 会话标题（缺省时由 agent 推送 `session.title` 填充） |
| `assistantAccount` | String | 受开关控制 | 助理账号；空时由 `skill.assistant.existence-check.skip-on-null-assistant-account` 决定 400 拒绝还是放行 |
| `businessSessionDomain` / `Type` / `Id` | String | | 业务侧外部 ID 三元组（IM 接入会用；miniapp 通常为 null） |

成功响应：

```json
{
  "code": 200,
  "data": {
    "id": 1789012345,
    "userId": "900001",
    "ak": "AK123456789",
    "title": "JDK8 与 JDK21 的区别",
    "toolSessionId": null,
    "status": "ACTIVE",
    "assistantAccount": "e2e-cb-bot"
  }
}
```

> `id` 是 SS 的 snowflake 64-bit Long，作为后续接口的 `sessionId` 与 WebSocket 出站的 `welinkSessionId`。

错误码：`400 assistantAccount is required`、`410 该助理已被删除`。

---

### 5.1.1 默认助手注入（任务 05-15-noauth-conversation-permission）

#### 场景

特定接入方调 `POST /api/skill/sessions` **不传** `ak` / `assistantAccount`，只传 `(businessSessionDomain, businessSessionType, businessSessionId)` + cookie userId。

服务端按 `(domain, type)` 查 `sys_config[default_assistant_rule]` 规则表，命中即注入虚拟身份并落 DB；后续 chat / question_reply / permission_reply 走与 business scope 对称的云端 HTTP 路径，但身份是 SS / GW 协同的"虚拟"身份。

#### 触发条件（D1 优先级矩阵）

| `request.ak` / `request.assistantAccount` | `(domain, type)` 入参 + 规则查找 | 行为 |
|---|---|---|
| 任一非空 | 任意（**规则不查**） | 走老路径（显式 override） |
| 两个都为空 | `domain` / `type` 都非空且精确命中规则 | 默认助手路径（注入虚拟身份 + 单事务落 DB） |
| 两个都为空 | `domain` 或 `type` 任一为空 OR 都非空但未命中 | 400 `ak 和 assistantAccount 必填` |

#### 客户端契约

- 默认助手 session 字段（SS 落库后返回）：`ak` / `assistantAccount` 是虚拟值；客户端**不要硬编码**这俩值，按请求返回处理
- chat / question_reply / permission_reply / close / abort：与现有 miniapp 通道行为对称——客户端代码无需区分
- close / abort：默认助手 session 不发 GW invoke（SS DB 标 CLOSED），但客户端看到的响应一致

#### 运维入口

新增规则用现有 `/api/admin/configs/**` update 接口（参 `docs/superpowers/specs/2026-05-15-default-assistant-rule-ops.md`）。

---

### 5.2 发送用户消息 / question_reply

```http
POST /api/skill/sessions/{sessionId}/messages
Cookie: userId=900001
Content-Type: application/json

{
  "content": "JDK21 有什么新特性？",
  "toolCallId": null,
  "requestId": null,
  "subagentSessionId": null,
  "businessExtParam": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | String | ✅ | 用户输入文本；空/纯空白 → 400 |
| `toolCallId` | String | | 非空 → 路由到 `question_reply`（应答 §7 `question` 事件），与 question 事件中的 `toolCallId` 对齐 |
| `requestId` | String | | **personal scope 快路径**：opencode question request id（来源：§7 `question` 事件顶层 `requestId` 字段）。非空 → SS 透传给 plugin，新版 plugin 直接 `POST /question/{requestID}/reply`，跳过 `GET /question` 反查。缺失/空白 → SS 不塞 payload → plugin 走 fallback（toolCallId 反查）。空白字符串视为缺失（D8）。历史恢复时为空（D9 fallback） |
| `subagentSessionId` | String | **subagent 场景必填** | **协议路由字段**：业务方应回显本会话最近一条 subagent 出站事件中携带的 `subagentSessionId`；缺失则 plugin 会把应答路由到主对话（落到主 `toolSessionId`），导致子 agent 阻塞或 `tool_error`。详见 §13 |
| `businessExtParam` | Object | | 业务扩展参数；SS 透传到 `payload.businessExtParam`，最终落到云端 `extParameters.businessExtParam`（不解析、不修改） |

**SS 行为**（`SkillMessageController.sendMessage` + `routeToGateway`）：

1. 持久化 user 消息（`saveUserMessage`），分配 `messageId` 与 `messageSeq`。
2. **WebSocket 广播** `message.user` 事件给同会话所有连接（多端同步）。
3. 路由到 GW：
   - `toolCallId` 非空 → action=`question_reply`，payload 含 `{answer, toolCallId, toolSessionId, businessExtParam}`；当 `requestId` 非空白时额外塞 `requestId`（personal scope 快路径）。
   - `toolCallId` 空 + 有 `toolSessionId` → action=`chat`，payload 含 `{text, toolSessionId, sendUserAccount, assistantAccount, messageId, businessExtParam}`。
   - `toolSessionId` 缺失 → 触发 `rebuildToolSession`。
4. 同步返回持久化 `ProtocolMessageView`。

后续事件通过 WebSocket 流出（参见 §7）。

---

### 5.3 权限应答

```http
POST /api/skill/sessions/{sessionId}/permissions/{permId}
Cookie: userId=900001
Content-Type: application/json

{
  "response": "once",
  "subagentSessionId": null,
  "businessExtParam": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `response` | String | ✅ | 合法值：`"once"` / `"always"` / `"reject"`；其他 → 400 |
| `subagentSessionId` | String | **subagent 场景必填** | 同 §5.2；权限请求由子 agent 发起时（`permission.ask` 事件带 `subagentSessionId`），应答必须回显，否则授权会落到主对话。详见 §13 |
| `businessExtParam` | Object | | 同 §5.2 |

**SS 行为**（`SkillMessageController.replyPermission`）：

1. 校验 `response ∈ {once, always, reject}`。
2. 触发 agent 在线检查（个人助手必查，业务助手跳过）。
3. 路由到 GW action=`permission_reply`，payload 含 `{permissionId, response, toolSessionId, businessExtParam}`。
4. **WebSocket 广播** `permission.reply` 事件给同会话所有连接（多端同步 UI 已应答态）。

成功响应：

```json
{
  "code": 200,
  "data": {
    "welinkSessionId": "1789012345",
    "permissionId": "perm-001",
    "response": "once"
  }
}
```

---

### 5.4 中止会话（abort）

```http
POST /api/skill/sessions/{sessionId}/abort
Cookie: userId=900001
Content-Type: application/json

{
  "subagentSessionId": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `subagentSessionId` | String | **subagent 场景必填** | 中止特定子 agent 会话；缺省则中止主会话整条链路。详见 §13 |

**SS 行为**：向 GW 发 `abort_session`，会话保留可复用；已 CLOSED → 409。

成功响应：

```json
{ "code": 200, "data": { "status": "aborted", "welinkSessionId": "1789012345" } }
```

---

### 5.5 关闭会话（close）

```http
DELETE /api/skill/sessions/{sessionId}
Cookie: userId=900001
```

**SS 行为**：向 GW 发 `close_session` 后落库 `status=CLOSED`。

成功响应：

```json
{ "code": 200, "data": { "status": "closed", "welinkSessionId": "1789012345" } }
```

---

### 5.6 会话/消息查询

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET /api/skill/sessions` | 分页拉用户会话列表 | 支持 `status` / `ak` / `businessSession*` / `assistantAccount` / `page` / `size` |
| `GET /api/skill/sessions/{id}` | 取单会话 | 含 403 归属校验 |
| `GET /api/skill/sessions/{id}/messages` | 历史消息分页（`page` / `size`，默认 50，上限 200） | 含 parts |
| `GET /api/skill/sessions/{id}/messages/history` | 游标分页（`beforeSeq`） | 长列表向上滚加载 |
| `GET /api/skill/agents` | 当前 userId 的在线 Agent 列表 | 内部转 GW |

---

### 5.7 发送到 IM（仅有 IM 关联的会话）

```http
POST /api/skill/sessions/{sessionId}/send-to-im
Cookie: userId=900001
Content-Type: application/json

{ "content": "...", "chatId": null }
```

`chatId` 缺省时使用 session.businessSessionId。无关联 → 400。

---

## 6. 出站 StreamMessage 公共字段

`StreamMessage`（`model/StreamMessage.java`）一个 DTO 覆盖全部 26 种 type；序列化策略：

- `@JsonInclude(NON_NULL)`：null 字段直接省略。
- 5 个嵌套类（`ToolInfo` / `PermissionInfo` / `QuestionInfo` / `UsageInfo` / `FileInfo`）通过 `@JsonUnwrapped` **平铺**到 JSON 顶层。
- 不存在 envelope，前端直接消费每个 WS frame 作为完整 JSON。

### 6.1 公共字段表

| 字段 | 类型 | 说明 | 哪些 type 有 |
|---|---|---|---|
| `type` | String | 消息类型（22 种之一） | 所有 |
| `seq` | Long | 传输层全局序号（Redis INCR by sessionId） | 所有，由 `SkillStreamHandler.nextTransportSeq()` 发送时统一赋值 |
| `welinkSessionId` | String | 会话 ID（=`sessionId.toString()`） | 几乎所有（agent.online/offline 除外） |
| `emittedAt` | String | ISO 8601 时间戳；由 `StreamMessageEmitter.enrich()` 设置 | 见下方排除列表 |
| `messageId` | String | SS 持久化 messageId（`MessagePersistenceService.applyMessageContextIfPresent` 可能覆写） | Part 级 / step.* / message.user / streaming |
| `sourceMessageId` | String | 上游原始 messageId（不被覆写） | Part 级 / step.done |
| `messageSeq` | Integer | 消息在会话内的业务序号 | Part 级 / message.user / streaming |
| `role` | String | `"assistant"` / `"user"` | Part 级 / step.* / message.user / streaming / permission.reply |
| `partId` | String | Part 唯一标识 | Part 级 |
| `partSeq` | Integer | Part 在消息内的排序 | Part 级（permission.ask 除外） |
| `content` | String | 文本载荷 | text/thinking/planning/permission.ask(title 回退)/error |
| `status` | String | `"pending"`/`"running"`/`"completed"`/`"error"` | tool.update / question |
| `title` | String | 显示标题 | tool.update / session.title / permission.ask |
| `error` | String | 错误描述 | session.error / error |
| `sessionStatus` | String | `"busy"`/`"idle"`/`"retry"` | session.status / streaming |
| `subagentSessionId` | String | 子代理会话 ID。**协议路由字段**；subagent 场景必传，业务方在对应入站应答（`question_reply` / `permission_reply` / `abort` / `close`）中必须回显，详见 §13 | Part 级（subagent 场景必传） |
| `subagentName` | String | 子代理显示名；嵌套时以 `" > "` 分隔的路径（例 `"代码审查 > 设计"`），详见 §13 | Part 级（subagent 场景必传） |

**`emittedAt` 排除列表**（`StreamMessageEmitter.EMITTED_AT_EXCLUDED_TYPES`）：

- `permission.reply`
- `agent.online`
- `agent.offline`
- `error`

### 6.2 平铺嵌套字段

| 来源嵌套类 | JSON 字段 | 类型 | 哪些 type 用 |
|---|---|---|---|
| ToolInfo | `toolName` | String | tool.update / question |
| ToolInfo | `toolCallId` | String | tool.update / question |
| ToolInfo | `input` | Object | tool.update / question |
| ToolInfo | `output` | String | tool.update / question(completed) |
| PermissionInfo | `permissionId` | String | permission.ask / permission.reply |
| PermissionInfo | `permType` | String | permission.ask |
| PermissionInfo | `metadata` | Object | permission.ask |
| PermissionInfo | `response` | String | permission.reply |
| QuestionInfo | `header` | String | question(running) |
| QuestionInfo | `question` | String | question(running) |
| QuestionInfo | `options` | List\<String\> | question(running) |
| QuestionInfo | `multiSelect` | Boolean | question(running)（可选） |
| QuestionInfo | `questions` | List\<QuestionItem\> | question(running)（多题形态） |
| QuestionInfo | `extParam` | JsonNode | question(running)（云端透传） |
| UsageInfo | `tokens` | Map<String,Object> | step.done |
| UsageInfo | `cost` | Double | step.done |
| UsageInfo | `reason` | String | step.done |
| FileInfo | `fileName` | String | file |
| FileInfo | `fileUrl` | String | file |
| FileInfo | `fileMime` | String | file |

### 6.3 仅特定 type 使用的字段

| 字段 | 类型 | type |
|---|---|---|
| `messages` | List\<Object\> | snapshot |
| `parts` | List\<Object\> | streaming |
| `keywords` | List\<String\> | searching |
| `searchResults` | List\<SearchResultItem\> | search_result |
| `references` | List\<ReferenceItem\> | reference |
| `askMoreQuestions` | List\<String\> | ask_more |

---

## 7. 出站事件清单（SS → miniapp）

26 种 type 按处理层级分三组：Part 级（StreamAssembler 维护）/ 会话级 / 云端扩展。下面逐项完整字段表 + JSON 示例。

### 7.0 总览表

| 分类 | type | 处理层 | 章节 |
|---|---|---|---|
| **文本** | `text.delta` | Part | §7.1 |
| | `text.done` | Part | §7.2 |
| | `thinking.delta` | Part | §7.3 |
| | `thinking.done` | Part | §7.4 |
| **工具** | `tool.update` | Part | §7.5 |
| | `step.start` | 会话 | §7.6 |
| | `step.done` | 会话 | §7.7 |
| **交互** | `question` | Part | §7.8 |
| | `permission.ask` | Part | §7.9 |
| | `permission.reply` | Part | §7.10 |
| **文件** | `file` | Part | §7.11 |
| **会话** | `session.status` | 会话 | §7.12 |
| | `session.title` | 会话 | §7.13 |
| | `session.error` | 会话 | §7.14 |
| | `agent.online` | 会话 | §7.15 |
| | `agent.offline` | 会话 | §7.16 |
| | `error` | 会话 | §7.17 |
| | `message.user` | 会话 | §7.18 |
| | `snapshot` | 重连 | §7.19 |
| | `streaming` | 重连 | §7.20 |
| **云端扩展** | `planning.delta` | Part | §7.21 |
| | `planning.done` | Part | §7.22 |
| | `searching` | 云端 | §7.23 |
| | `search_result` | 云端 | §7.24 |
| | `reference` | 云端 | §7.25 |
| | `ask_more` | 云端 | §7.26 |

---

### 7.1 `text.delta` —— 文本流式增量

```json
{
  "type": "text.delta",
  "seq": 42,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:00Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-text-01",
  "partSeq": 0,
  "content": "您好，"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | String | ✅ | 增量片段，前端 `+=` 追加到 part.content |
| `role` | String | ✅ | `"assistant"` |
| `messageId` / `sourceMessageId` / `messageSeq` / `partId` / `partSeq` | | ✅ | 见 §6.1 |

> 前端语义：`isStreaming = true`，多个 delta 同一 `partId` 内累加。

---

### 7.2 `text.done` —— 文本片段完成

字段同 7.1，`content` 为完整文本（**替换**而非追加）。`isStreaming = false`。

```json
{
  "type": "text.done",
  "seq": 43,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:01Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-text-01",
  "partSeq": 0,
  "content": "您好，这是完整回复"
}
```

---

### 7.3 `thinking.delta` —— 深度思考增量

字段同 `text.delta`；前端创建 `type:'thinking'` part；可折叠展示。

```json
{
  "type": "thinking.delta",
  "seq": 40,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:58Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-think-01",
  "partSeq": 0,
  "content": "让我整理一下"
}
```

---

### 7.4 `thinking.done` —— 深度思考完成

字段同 7.3，`content` 为完整思考文本（替换）。

```json
{
  "type": "thinking.done",
  "seq": 41,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:59Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-think-01",
  "partSeq": 0,
  "content": "让我整理一下搜索结果"
}
```

---

### 7.5 `tool.update` —— 工具调用状态

```json
{
  "type": "tool.update",
  "seq": 44,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:02Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-tool-01",
  "partSeq": 1,
  "status": "completed",
  "title": "Read",
  "toolName": "Read",
  "toolCallId": "call-abc123",
  "input": { "file_path": "/src/main.ts" },
  "output": "file content here..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `status` | String | ✅ | `"pending"` / `"running"` / `"completed"` / `"error"` |
| `toolName` | String | ✅ | 工具名 |
| `toolCallId` | String | ✅ | 工具调用 ID |
| `title` | String | | 卡片标题（前端展示） |
| `input` | Object | | 入参 JSON |
| `output` | String | | 出参（completed 时） |
| `error` | String | | 错误描述（error 时） |

> 前端语义：`isStreaming = (status === 'pending' || status === 'running')`。

---

### 7.6 `step.start` —— 推理步骤开始

```json
{
  "type": "step.start",
  "seq": 39,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:57Z",
  "messageId": "msg-001",
  "role": "assistant"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `messageId` | String | ✅ | 当前步骤所属消息 |
| `role` | String | | `"assistant"` |

> **不带** `sourceMessageId` / `partId` / `partSeq`。

---

### 7.7 `step.done` —— 推理步骤完成（含用量）

```json
{
  "type": "step.done",
  "seq": 50,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:10Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "role": "assistant",
  "tokens": { "input": 1024, "output": 256, "reasoning": 512 },
  "cost": 0.003,
  "reason": "end_turn"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `messageId` | String | ✅ | |
| `tokens` | Map | | `input` / `output` / `reasoning` 等任意键，值为数字 |
| `cost` | Double | | 步骤计费 |
| `reason` | String | | `"end_turn"` / `"max_tokens"` / `"tool_calls"` 等 |

> step.done 可能来自两路：part `step-finish`（含 tokens/cost/reason）或 message `finish`（只 reason）。

---

### 7.8 `question` —— 交互式问答

**两阶段**：running（提问）→ completed/error（应答完成）。

#### running 示例

```json
{
  "type": "question",
  "seq": 45,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:03Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "partId": "q-part-01",
  "partSeq": 2,
  "status": "running",
  "toolName": "question",
  "toolCallId": "call-q001",
  "input": { "questions": [{ "header": "确认", "question": "继续吗？", "options": ["Yes", "No"] }] },
  "header": "确认",
  "question": "继续吗？",
  "options": ["Yes", "No"],
  "multiSelect": false,
  "requestId": "qreq-uuid-abc"
}
```

#### completed 示例

```json
{
  "type": "question",
  "seq": 55,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:31:00Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "q-part-01",
  "partSeq": 2,
  "status": "completed",
  "toolName": "question",
  "toolCallId": "call-q001",
  "output": "Yes"
}
```

| 字段 | 类型 | 必填 | 阶段 | 说明 |
|---|---|---|---|---|
| `status` | String | ✅ | 两阶段 | running / completed / error |
| `toolName` | String | ✅ | 两阶段 | 固定 `"question"` |
| `toolCallId` | String | ✅ | 两阶段 | 应答时回传到 §5.2 的 `toolCallId` |
| `input` | Object | | running | 完整问题结构 |
| `header` | String | | running | 单题表头 |
| `question` | String | | running | 单题问题文本 |
| `options` | List\<String\> | | running | 选项 label 数组 |
| `multiSelect` | Boolean | | running | 单/多选；默认 false |
| `requestId` | String | | running | **personal scope**：opencode question request id（顶层字段，来源 `QuestionInfo.requestId` 经 `@JsonUnwrapped` 平铺）。miniapp 回答时回传到 §5.2 `requestId`，让新版 plugin 走快路径 `POST /question/{requestID}/reply`。historical replay 不带（D9 fallback） |
| `output` | String | | completed | 用户应答（label 字符串） |

> completed 阶段**不带** header/question/options，前端用之前 running 缓存的 part 展示。

---

### 7.9 `permission.ask` —— 权限请求

```json
{
  "type": "permission.ask",
  "seq": 47,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:05Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "partId": "perm-part-01",
  "title": "bash: rm -rf /tmp/build",
  "permissionId": "perm-001",
  "permType": "Bash",
  "metadata": { "command": "rm -rf /tmp/build", "cwd": "/home/user" }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `permissionId` | String | ✅ | 权限 ID，应答时回传到 §5.3 |
| `permType` | String | | 权限类型（`Bash` / `filesystem` / 云端自定义） |
| `title` | String | | 卡片标题（前端 `content = title ?? content`） |
| `metadata` | Object | | 云端自定义元数据，透传 |

> permission.ask 有 `messageId`/`sourceMessageId`/`partId`，但**没有** `messageSeq`/`partSeq`。

---

### 7.10 `permission.reply` —— 权限应答回放

```json
{
  "type": "permission.reply",
  "seq": 48,
  "welinkSessionId": "1789012345",
  "role": "assistant",
  "permissionId": "perm-001",
  "response": "once"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `permissionId` | String | ✅ | 对应 permission.ask |
| `response` | String | ✅ | `"once"` / `"always"` / `"reject"` |
| `role` | String | | `"assistant"` |
| `subagentSessionId` | String | | 可选 |

> **极简事件**：不带 `emittedAt`（排除列表）/ `messageId` / `partId` / `partSeq`。前端通过 `permissionId` 匹配回原 ask part。

---

### 7.11 `file` —— 文件附件

```json
{
  "type": "file",
  "seq": 46,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:04Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-file-01",
  "partSeq": 3,
  "fileName": "screenshot.png",
  "fileUrl": "https://storage.example.com/files/screenshot.png",
  "fileMime": "image/png"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `fileName` | String | ✅ | |
| `fileUrl` | String | ✅ | |
| `fileMime` | String | | |

---

### 7.12 `session.status` —— 会话状态

```json
{
  "type": "session.status",
  "seq": 51,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:11Z",
  "sessionStatus": "idle"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sessionStatus` | String | ✅ | `"busy"` / `"idle"` / `"retry"` |

> 纯会话级，无 messageId/role/partId。`idle` → 前端 finalize 所有 streaming part。

---

### 7.13 `session.title` —— 会话标题更新

```json
{
  "type": "session.title",
  "seq": 52,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:12Z",
  "title": "JDK8 与 JDK21 的区别"
}
```

---

### 7.14 `session.error` —— 会话级错误

```json
{
  "type": "session.error",
  "seq": 53,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:13Z",
  "error": "Agent process crashed unexpectedly"
}
```

> 前端处理：finalize 所有 streaming part + `setError(msg.error)`。

---

### 7.15 `agent.online`

```json
{"type": "agent.online", "seq": 60}
```

> 最精简事件。**没有** welinkSessionId / emittedAt。

---

### 7.16 `agent.offline`

```json
{"type": "agent.offline", "seq": 61}
```

字段同 §7.15。

---

### 7.17 `error` —— 通用错误

```json
{
  "type": "error",
  "seq": 70,
  "welinkSessionId": "1789012345",
  "error": "Session not found"
}
```

> 不带 `emittedAt`（排除列表）。

---

### 7.18 `message.user` —— 多端同步用户消息

某一端通过 §5.2 发用户消息后，**所有**该用户的 WS 连接都收到这条事件（保证多端 UI 一致）。

```json
{
  "type": "message.user",
  "seq": 80,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:15Z",
  "messageId": "msg-user-002",
  "messageSeq": 5,
  "role": "user",
  "content": "Please help me with this bug"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `messageId` | String | ✅ | SS 持久化 ID |
| `messageSeq` | Integer | ✅ | |
| `role` | String | ✅ | 固定 `"user"` |
| `content` | String | ✅ | 用户输入文本 |

> 前端去重后插入 messages 列表。

---

### 7.19 `snapshot` —— 历史快照

WS 建连/重连时 SS 自动推送该用户所有 ACTIVE 会话的快照（`SkillStreamHandler.sendInitialStreamingState` → `SnapshotService.buildSnapshot`）。

```json
{
  "type": "snapshot",
  "seq": 1,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:50Z",
  "messages": [
    { "id": "msg-001", "role": "user", "content": "Hello", "parts": [] },
    { "id": "msg-002", "role": "assistant", "content": "Hi!", "parts": [] }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `messages` | List\<Object\> | ✅ | 完整历史消息（含 parts） |

> 前端处理：清空 assembler，用 snapshot 替换 messages 列表。

---

### 7.20 `streaming` —— 实时流状态

紧跟在 snapshot 之后发送，表示当前进行中的流式状态。

```json
{
  "type": "streaming",
  "seq": 2,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:51Z",
  "sessionStatus": "busy",
  "messageId": "msg-003",
  "messageSeq": 3,
  "role": "assistant",
  "parts": [
    { "type": "text.delta", "partId": "p1", "content": "I am currently..." }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sessionStatus` | String | ✅ | `"busy"` / `"idle"` / `"retry"` |
| `messageId` | String | | 进行中的消息 ID |
| `messageSeq` | Integer | | |
| `role` | String | | |
| `parts` | List\<Object\> | | 当前流式 part 缓冲快照 |

---

### 7.21 `planning.delta` —— 规划增量（云端扩展）

字段结构同 `text.delta`，前端 `type:'planning'` part。

```json
{
  "type": "planning.delta",
  "seq": 35,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:55Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-planning-01",
  "partSeq": 0,
  "content": "用户询问JDK对比，需要搜索"
}
```

---

### 7.22 `planning.done` —— 规划完成（云端扩展）

字段同 7.21，`content` 为完整规划文本。

```json
{
  "type": "planning.done",
  "seq": 36,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:56Z",
  "messageId": "msg-001",
  "sourceMessageId": "msg-001",
  "messageSeq": 1,
  "role": "assistant",
  "partId": "prt-planning-01",
  "partSeq": 0,
  "content": "用户询问JDK对比，需要分别搜索两者特性"
}
```

---

### 7.23 `searching` —— 搜索中（云端扩展）

```json
{
  "type": "searching",
  "seq": 37,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:56Z",
  "messageId": "msg-001",
  "keywords": ["JDK8特性", "JDK21特性"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keywords` | List\<String\> | ✅ | 搜索关键词列表 |

> 没有 partId/partSeq/role/content。

---

### 7.24 `search_result` —— 搜索结果（云端扩展）

```json
{
  "type": "search_result",
  "seq": 38,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:57Z",
  "messageId": "msg-001",
  "searchResults": [
    { "index": "1", "title": "Java学习系列15", "source": "CSDN博客" },
    { "index": "2", "title": "JAVA8新特性", "source": "菜鸟教程" }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `searchResults` | List\<SearchResultItem\> | ✅ | **字段名严格 `searchResults`，不是 `results`** |
| `searchResults[].index` | String | | 序号（字符串） |
| `searchResults[].title` | String | | 标题 |
| `searchResults[].source` | String | | 来源 |

---

### 7.25 `reference` —— 引用列表（云端扩展）

```json
{
  "type": "reference",
  "seq": 39,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:29:58Z",
  "messageId": "msg-001",
  "references": [
    {
      "index": "1",
      "title": "Java学习系列15",
      "url": "https://blog.csdn.net/xxx",
      "source": "CSDN博客",
      "content": "JDK8是Java开发工具包..."
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `references` | List\<ReferenceItem\> | ✅ | |
| `references[].index` | String | | |
| `references[].title` | String | | |
| `references[].url` | String | | |
| `references[].source` | String | | |
| `references[].content` | String | | 摘要 |

---

### 7.26 `ask_more` —— 追问建议（云端扩展）

```json
{
  "type": "ask_more",
  "seq": 49,
  "welinkSessionId": "1789012345",
  "emittedAt": "2026-05-12T08:30:09Z",
  "messageId": "msg-001",
  "askMoreQuestions": ["Lambda 表达式典型场景？", "JDK21 虚拟线程如何使用？"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `askMoreQuestions` | List\<String\> | ✅ | **字段名严格 `askMoreQuestions`，不是 `questions`** |

> 仅展示用，不触发 question_reply。

---

### 7.27 典型流序示例

#### 个人助手 - 简单对话

```
→ message.user      {messageId:"u-1", content:"你好"}
→ session.status    {sessionStatus:"busy"}
→ step.start        {messageId:"msg-001"}
→ thinking.delta    {partId:"prt-r1", content:"想想..."}
→ thinking.done     {partId:"prt-r1", content:"想想用户问的是什么"}
→ text.delta        {partId:"prt-t1", content:"您好，"}
→ text.delta        {partId:"prt-t1", content:"以下是..."}
→ text.done         {partId:"prt-t1", content:"您好，以下是..."}
→ step.done         {messageId:"msg-001", tokens:{input:100,output:50}, reason:"end_turn"}
→ session.status    {sessionStatus:"idle"}
```

#### 带 question

```
→ step.start
→ question(running)   {partId:"q-1", toolCallId:"call-q1", question:"选哪个？", options:["A","B"]}
   ↳ 用户调 POST /messages with toolCallId="call-q1", content="A"
→ message.user        {content:"A"}                       (多端同步)
→ question(completed) {partId:"q-1", toolCallId:"call-q1", output:"A"}
→ text.delta / text.done / step.done / session.status(idle)
```

#### 带 permission

```
→ step.start
→ text.delta          {partId:"t1", content:"需要执行命令"}
→ permission.ask      {partId:"p1", permissionId:"perm-001", permType:"Bash", title:"rm -rf /tmp"}
   ↳ 用户调 POST /permissions/perm-001 with response="once"
→ permission.reply    {permissionId:"perm-001", response:"once"}    (多端同步)
→ tool.update         {partId:"tool-1", toolName:"Bash", status:"completed"}
→ text.delta / text.done / step.done / session.status(idle)
```

#### 业务助手（云端）

```
→ session.status(busy)
→ planning.delta / planning.done
→ searching         {keywords:[...]}
→ search_result     {searchResults:[...]}
→ reference         {references:[...]}
→ thinking.* / text.*
→ ask_more          {askMoreQuestions:[...]}
→ session.status(idle)
```

#### WebSocket 重连

```
→ snapshot     {messages:[...完整历史...]}
→ streaming    {sessionStatus:"busy", parts:[...]}
→ ...继续正常流
```

---

## 8. 长连接保活与生命周期

### 8.1 连接建立

`SkillStreamHandler.afterConnectionEstablished`：

1. 读 Cookie → `userId`；空 → close。
2. 注册到 `userSubscribers[userId]`（多 tab 累加）。
3. 首次连接（counter=1）订阅用户级 Redis 频道。
4. 预加载该用户活跃会话归属到 `sessionOwners` 缓存。
5. 推送 `snapshot` + `streaming`（每个活跃会话各一对）。

### 8.2 心跳

- 客户端心跳：发 `{"action":"ping"}` 文本帧。SS 收到仅打 DEBUG，**不回包**（依赖 TCP keepalive + WS PONG 由 Spring/容器底层处理）。
- 服务端 PING：当前实现不主动发 ping。

### 8.3 断线重连

客户端重连后：

- 方案 A：建新连接 → SS 自动重发 snapshot + streaming（与首次建连等同）。
- 方案 B：在已建连接上发 `{"action":"resume"}` → SS 立即重发 snapshot + streaming（`SkillStreamHandler.handleTextMessage`）。

### 8.4 流式回放缓冲

`StreamMessageEmitter.emitToClientWithBuffer()` 会把消息写入 `StreamBufferService`，断线期间累积，重连时通过 snapshot/streaming 还原 part 状态。

### 8.5 关闭与清理

- 客户端 close → `afterConnectionClosed` → `unregisterSubscriber`（幂等）。
- 传输错误（IOException 等）→ `handleTransportError` → 同样 `unregisterSubscriber`。
- 用户最后一条连接关闭 → 取消 Redis 频道订阅 + 移除 counter。

---

## 9. 错误处理矩阵

### 9.1 入站 HTTP

| 场景 | code | message 示例 | 来源 |
|---|---|---|---|
| Cookie 无 userId | 400 | `userId is required` | `SessionAccessControlService.requireUserId` |
| 非法 sessionId 格式 | 400 | `Invalid session ID` | `ProtocolUtils.parseSessionId` |
| session 不存在 / userId 不匹配 | 403 | `Session access denied` | `SessionAccessControlService.requireSessionAccess` |
| session 已 CLOSED + 发消息/权限 | 409 | `Session is closed` | `SkillMessageController` |
| session 已 CLOSED + abort | 409 | `Session is already closed` | `SkillSessionController.abortSession` |
| 助理已删除 | 410 | `该助理已被删除`（可配置） | `AssistantAccountResolverService.check` |
| `assistantAccount` 空 + 开关 OFF | 400 | `assistantAccount is required` | 同上 |
| `content` 空白 | 400 | `Content is required` | `SkillMessageController.sendMessage` |
| `permission.response` 非法 | 400 | `Invalid response value. Must be one of: once, always, reject` | `SkillMessageController.replyPermission` |
| Agent 离线（个人助手） | 503 | 可配置文案（`AssistantOfflineMessageProvider`） | 同上 |
| 历史分页 size 超 200 | 400 | `Size must be between 1 and 200` | `SkillMessageController.getMessages` |
| `toolSessionId` 缺失（权限应答） | 500 | `No toolSessionId available` | 同上 |
| 无关联 IM chatId | 400 | `No IM chat ID associated with this session` | `sendToIm` |

### 9.2 WebSocket

| 场景 | SS 行为 | 客户端表现 |
|---|---|---|
| 握手缺 Cookie | `close(1003 BAD_DATA, "Missing userId cookie")` | onClose code=1003 |
| 序列化失败 | 丢消息 + ERROR 日志，不 close | 无影响（该条消息丢失） |
| 发送失败（IOException） | 自动 unregister 该连接 | onClose / onError |
| 业务侧异常 → 发 `error` 类型事件 | 通过 `StreamMessage.error(...)` 推到该会话 | 前端 finalize + setError |
| 业务侧异常 → 发 `session.error` | 同上但带 emittedAt | 前端 finalize + setError |

---

## 10. 配置项一览

| 配置项 | 默认 | 说明 |
|---|---|---|
| `skill.websocket.allowed-origins` | `*` | WS 允许的 Origin |
| `skill.assistant.existence-check.skip-on-null-assistant-account` | `true` | `assistantAccount` 空时是否放行 |
| `skill.assistant.deletion-message` | `该助理已被删除` | 助理删除文案 |
| `skill.assistant-id.enabled` | `true` | 是否启用个人助手在线检查 |
| `skill.session.idle-timeout-minutes` | 30 | 会话空闲超时（标 IDLE） |
| `skill.session.auto-create-timeout-seconds` | 30 | rebuild 等 toolSession 超时 |
| `skill.delivery.mode` | `rest` | 出站投递模式 |
| `skill.delivery.invoke-source-ttl-seconds` | 300 | invoke 路由 TTL |
| `spring.threads.virtual.enabled` | `true` | 虚拟线程开关（SS 处理高并发的关键） |

> 端口默认 `8082`（`server.port`）。

---

## 11. 字段↔代码映射（实现验证）

| 协议要素 | 代码源 |
|---|---|
| WS 端点注册 `/ws/skill/stream` | `skill-server` `SkillConfig.registerWebSocketHandlers()` line 47-54 |
| Cookie userId 解析（WS） | `skill-server` `SkillStreamHandler.extractUserIdFromCookie() / parseUserIdCookie()` line 402-425 |
| Cookie userId 解析（HTTP） | `skill-server` controllers 内 `@CookieValue("userId")` + `SessionAccessControlService.requireUserId()` |
| 会话归属校验 | `skill-server` `SessionAccessControlService.requireSessionAccess()` |
| WS 订阅注册 / Redis 频道订阅 | `skill-server` `SkillStreamHandler.registerUserSubscriber() / subscribeToUserStream()` line 169-219 |
| `seq` 分配（Redis INCR） | `skill-server` `SkillStreamHandler.nextTransportSeq()` → `RedisMessageBroker.nextStreamSeq()` |
| `welinkSessionId` 派生 | `skill-server` `StreamMessage.getWelinkSessionId()` 与 `StreamMessageEmitter.enrich()` |
| `emittedAt` 自动填充 + 排除集 | `skill-server` `StreamMessageEmitter.enrich()` line 64-83；`EMITTED_AT_EXCLUDED_TYPES` line 37-41 |
| `messageId` 持久化覆写 | `skill-server` `MessagePersistenceService.applyMessageContextIfPresent()`（由 `enrich()` 调用） |
| `snapshot` 构造 | `skill-server` `SnapshotService.buildSnapshot()` line 46-58 |
| `streaming` 构造 | `skill-server` `SnapshotService.buildStreamingState()` line 60+ |
| `resume` / `ping` 处理 | `skill-server` `SkillStreamHandler.handleTextMessage()` line 103-127 |
| `agent.online` / `agent.offline` 工厂 | `skill-server` `StreamMessage.agentOnline() / agentOffline()` line 260-273 |
| `message.user` 工厂 | `skill-server` `StreamMessage.userMessage()` line 278-288 |
| `error` 工厂 | `skill-server` `StreamMessage.error()` line 250-255 |
| `session.status` 工厂 | `skill-server` `StreamMessage.sessionStatus()` line 240-245 |
| 入站 `POST /api/skill/sessions` | `skill-server` `SkillSessionController.createSession()` line 74-140 |
| 入站 `GET /api/skill/sessions` | `skill-server` `SkillSessionController.listSessions()` line 146-164 |
| 入站 `DELETE /api/skill/sessions/{id}` | `skill-server` `SkillSessionController.closeSession()` line 186-209 |
| 入站 `POST /api/skill/sessions/{id}/abort` | `skill-server` `SkillSessionController.abortSession()` line 215-243 |
| 入站 `POST /api/skill/sessions/{id}/messages` | `skill-server` `SkillMessageController.sendMessage()` line 111-165 |
| 入站 chat vs question_reply 路由 | `skill-server` `SkillMessageController.routeToGateway()` line 170-242 |
| 入站 `POST /permissions/{permId}` | `skill-server` `SkillMessageController.replyPermission()` line 366-463 |
| 合法 permission response 校验 | `skill-server` `SkillMessageController.VALID_PERMISSION_RESPONSES` line 62 |
| 入站历史消息 | `skill-server` `SkillMessageController.getMessages() / getCursorMessages()` line 248-310 |
| 入站 send-to-im | `skill-server` `SkillMessageController.sendToIm()` line 316-359 |
| 在线 Agent 查询 | `skill-server` `AgentQueryController.getOnlineAgents()` line 39-46 |
| OpenCode → StreamMessage 翻译（text/thinking/tool/question/file/step/session.*） | `skill-server` `OpenCodeEventTranslator` line 55-560 |
| 云端 → StreamMessage 翻译（planning/searching/search_result/reference/ask_more） | `skill-server` `CloudEventTranslator` line 91-470 |
| 多端同步 `message.user` 广播 | `skill-server` `SkillMessageController.sendMessage()` → `GatewayMessageRouter.broadcastStreamMessage()` |
| 多端同步 `permission.reply` 广播 | `skill-server` `SkillMessageController.replyPermission()` → `GatewayRelayService.publishProtocolMessage()` |
| 用户级广播（多 tab 推送） | `skill-server` `SkillStreamHandler.pushStreamMessageToUser()` line 261-274；`StreamMessageEmitter.sendToUserChannel()` line 117-124 |
| `agent.online/offline` 排除 emittedAt + welinkSessionId | `StreamMessageEmitter.EMITTED_AT_EXCLUDED_TYPES`；`StreamMessage` 仅设 type/seq |

---

## 12. 给前端开发者的注意事项

### 12.1 高优先级 ⚠️

1. **`searchResults` 不是 `results`**（§7.24）：云端事件字段严格按 SS 出站名解析，写错前端拿不到数据。
2. **`askMoreQuestions` 不是 `questions`**（§7.26）：与 `question` 事件区分。
3. **`question` 事件两阶段不同字段集**：running 阶段有 `header/question/options`，completed 阶段**只有** `status/toolName/toolCallId/output`，前端需用 `partId` 关联回 running 缓存。
4. **`permission.reply` 极简**：无 `messageId/partId/partSeq/emittedAt`，通过 `permissionId` 匹配 ask part。
5. **`agent.online/offline` 极简**：只有 `type` + `seq`，无 `welinkSessionId`，应用全局而非会话级。
6. **`text.delta` 累加，`text.done` 替换**：前端 part.content 处理方式不同；`thinking.*` / `planning.*` 同理。
7. **`session.status=idle`**：前端必须把所有 streaming part 标记为 finalized；否则会有残留 streaming UI。
8. **重连必先 snapshot + streaming**：建连后会自动收到一对；不要在收到完整 snapshot 之前展示部分增量。
9. **WS 帧无外层 envelope**：直接是 StreamMessage JSON；不要尝试解 `event.properties` 这种云端云端协议的二层结构（那是 GW↔云端用的，不是 SS↔miniapp）。
10. **`seq` 不连续**：来自 Redis INCR 按 sessionId 维度，多 session 共享同一连接时各自递增；前端只用于该 sessionId 内的乱序检测，不要做全局校验。

### 12.2 易混字段速查

| 协议字段 | 易混点 | 正确 |
|---|---|---|
| 搜索结果列表 | `results` ❌ | `searchResults` ✅ |
| 追问列表 | `questions` ❌ | `askMoreQuestions` ✅ |
| 提问字段（form 1） | `text` / `prompt` ❌ | `question` ✅ |
| 多选标识 | `multi` / `multiple` ❌ | `multiSelect` ✅ |
| 选项数组 | `choices` ❌ | `options` ✅ |
| 应答数组（入站） | `answer` ❌（注意：入站 question_reply 字段叫 `content` + `toolCallId`，**没有** `answers`） | `content`（POST body 中） ✅ |
| 选项对象 description | `desc` / `detail` ❌ | `description` ✅ |
| 工具调用 ID | `callId` / `toolId` ❌ | `toolCallId` ✅ |
| 权限 ID | `permId`（URL 路径用） / `permissionID` ❌（body/事件用） | `permissionId` ✅ |
| 权限响应 | `result` / `decision` ❌ | `response` ✅ |
| 会话 ID（事件中） | `sessionId`（内部字段，被 @JsonIgnore） ❌ | `welinkSessionId` ✅ |
| 会话 ID（HTTP 路径中） | `welinkSessionId` ❌ | `sessionId`（path variable） ✅ |
| 用户身份 | `Authorization` header ❌ | Cookie `userId` ✅ |
| 业务扩展 | `extParam` / `bizExt` ❌（入站） | `businessExtParam` ✅（入站 body 字段名） |
| 业务扩展（云端事件） | `businessExtParam` ❌（出站 question） | `extParam` ✅（QuestionInfo 内字段） |
| token 用量字段 | `usage` / `tokenUsage` ❌ | `tokens` ✅（step.done 内） |
| 步骤结束原因 | `finishReason` / `stopReason` ❌ | `reason` ✅ |
| subagent 应答路由 | 忘记在 `question_reply` / `permission_reply` / `abort` 入站 payload 中回显 `subagentSessionId` ❌ | 出站事件带就必传；缺失 → 应答落到主对话或子 agent `tool_error`（§13.4） ✅ |
| subagent 嵌套表达 | `subagentName` 用 `/` 或 `->` ❌ | 路径分隔符为 `" > "`（含空格），且无嵌套字段（§13.3） ✅ |

### 12.3 关键不变量

- 同一 `partId` 内的 delta 事件**严格按 seq 递增**，前端可以无脑追加。
- `step.start` 一定先于该 messageId 的 part 事件；`step.done` 一定在该消息所有 part 之后。
- `session.status` 是非排他的：一个会话可在多次 step 之间反复 busy ↔ idle。
- `tool.update(status=completed)` 后该 `toolCallId` 不再有新事件（除非云端推 question/permission 触发新 callId）。
- 重连必有 `snapshot` 紧接 `streaming`（即使会话已 idle，`streaming.sessionStatus=idle`）。

---

## 13. Subagent 协议（子代理事件路由）

> 本节为业务方实现 subagent 支持的速查规范。完整设计见 [`2026-05-11-subagent-unified-design.md`](./2026-05-11-subagent-unified-design.md) 第 3 节；UI 渲染模式见 [`2026-04-01-subagent-miniapp-display-design.md`](./2026-04-01-subagent-miniapp-display-design.md)。

### 13.1 协议本质

整个 subagent 协议**只有 2 个字段**：

| 字段 | 含义 | 取值 |
|---|---|---|
| `subagentSessionId` | 子会话标识 | `null` = 主对话；非空 = 子 agent 会话 |
| `subagentName` | 子 agent 显示名 | 可用 `" > "` 分隔表达嵌套层级（例 `"代码审查 > 设计"`） |

**架构特征**：skill-server / miniapp / DB **零改动**——bridge plugin 在源头已完成父子 toolSession 映射重写，下游通道（GW → SS → WS → miniapp）仅作字段透传。

### 13.2 哪些 type 会带 subagent 字段

| 携带 | 不携带 |
|---|---|
| **所有 Part 级事件**：`text.delta` / `text.done` / `thinking.delta` / `thinking.done` / `tool.update` / `question` / `permission.ask` / `permission.reply` / `file` / `step.start` / `step.done` | **会话级事件**：`session.status` / `session.title` / `session.error` / `agent.online` / `agent.offline` / `error` / `snapshot` / `streaming` / `message.user` |

理由：subagent 字段标记的是「这条 Part 来自哪个子任务」，会话级事件属于主会话，本身没有子任务归属。

### 13.3 嵌套表达：路径化 `subagentName`，无 UI 嵌套

子任务再派生孙任务时，**不做嵌套渲染**、**无新增字段**，靠 `subagentName` 路径化携带层级：

```json
// parent 子 agent "代码审查" 派生 child 子 agent "设计" 后的 text.delta
{
  "type": "text.delta",
  "welinkSessionId": "1789012345",
  "partId": "part-x",
  "content": "考虑使用策略模式...",
  "subagentSessionId": "sub-002",
  "subagentName": "代码审查 > 设计"
}
```

miniapp 平铺为 1 个折叠块（名字含路径），不要尝试 2 层折叠。

### 13.4 入站应答的路由责任（关键）

出站 Part 级事件带 `subagentSessionId` 时，业务方在以下入站调用 payload 中**必须回显**该 ID：

| 入站接口 | 何时必传 | 缺失后果 |
|---|---|---|
| `POST /api/skill/sessions/{id}/messages`（`question_reply` 分支，§5.2） | 收到的 `question` 事件带 `subagentSessionId` | 应答落到主对话；子 agent 阻塞或 `tool_error` |
| `POST /api/skill/sessions/{id}/permissions/{permId}`（§5.3） | 收到的 `permission.ask` 事件带 `subagentSessionId` | 授权落到主对话；子 agent 报权限失败 |
| `POST /api/skill/sessions/{id}/abort`（§5.4） | 仅想中止某个子 agent，而非整条主对话链路 | 中止主会话，相当于全停 |

示例 — subagent 内 permission.ask → permission_reply 必须回显：

```json
// SS → miniapp（出站）
{
  "type": "permission.ask",
  "welinkSessionId": "1789012345",
  "partId": "part-perm-1",
  "permissionId": "perm-001",
  "subagentSessionId": "sub-001",
  "subagentName": "代码审查"
}

// miniapp → SS（入站，POST /api/skill/sessions/1789012345/permissions/perm-001）
{
  "response": "once",
  "subagentSessionId": "sub-001"   // ← 必须回显，否则授权走主对话
}
```

### 13.5 生命周期

subagent 完成**没有专门的 done 事件**：

- 子 agent 结束 = 它的 Part 流自然停止 + 最后一条 `tool.update` 的 `toolStatus` 取值：
  - `"completed"`：正常完成；
  - `"error"`：失败，`toolError` 字段携带失败原因。
- 父 agent 监听同 `toolCallId` 的 `tool.update` 即可，不需要订阅额外 done 通知。

### 13.6 UI 渲染模式（miniapp）

详见 [`2026-04-01-subagent-miniapp-display-design.md`](./2026-04-01-subagent-miniapp-display-design.md)；要点：

1. **折叠块**：以 `subagentSessionId` 为 key 聚合该子 agent 的所有 Part；默认折叠，展示 `agentName + prompt（首条 user-facing 文本）+ 状态点 + 工具数 + 时长`。
2. **阻塞性交互冒泡**：`permission.ask` / `question` 必须冒泡到主对话层，附带 agent 名称（路径形态 `subagentName`），避免用户在折叠态错过授权请求。
3. **嵌套子 agent**：不做 2 层 UI 嵌套，靠 `subagentName` 路径表达。

### 13.7 与上游 GW↔plugin 协议的接缝

详见 [`2026-05-12-gateway-plugin-protocol.md`](./2026-05-12-gateway-plugin-protocol.md)。下游通道只需注意：

| 关注点 | SS / miniapp 视角 |
|---|---|
| 子会话 idle 不补 tool_done | 上游 plugin 已处理；SS 不会看到孤立的子会话 `session.idle`，无需特殊兼容 |
| envelope 改写 | 在 GW↔plugin 层完成；进入 SS 的 StreamMessage 已是「父会话 sessionId + Part 级 subagent 字段」的最终形态 |
| `toolError` 字段透传 | SS `OpenCodeEventTranslator` 直接透传到 `tool.update`；miniapp 直接读取 |

### 13.8 常见反模式（避免）

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 把会话级事件（`session.status` 等）按 `subagentSessionId` 分发 | 会话级状态永远收不到（这些事件不带该字段） | 会话级状态以 `welinkSessionId` 为 key |
| 在 `permission_reply` payload 里把 `subagentSessionId` 透传成 `null`（明明出站事件有值） | plugin 路由到主对话 → 子 agent 报错 | 严格回显出站事件中的取值 |
| 用 `subagentName` 做唯一 key 去聚合 Part | 同名子 agent 多次启动会被混在一起 | 用 `subagentSessionId` 做聚合 key；`subagentName` 仅用于显示 |
| 把 `subagentName` 路径分隔符替换为 `/` 自行做嵌套展示 | 与协议命名约定不一致，下游/日志检索失配 | 保留 `" > "` 原样展示；嵌套渲染由折叠块自决 |

---

## 14. 变更记录

| 日期 | 版本 | 改动 |
|---|---|---|
| 2026-05-12 | v1.0 | 首发：合并 `2026-04-10-stream-protocol.md` 出站章节，新增入站 5 类接口、Cookie 鉴权、保活、错误矩阵、字段-代码映射 |
| 2026-05-13 | v1.1 | 新增 §13 Subagent 协议；升级出站/入站字段表中 `subagentSessionId` / `subagentName` 描述（"可选" → "协议路由字段，subagent 场景必传"）；§12.2 易混表新增 subagent 相关陷阱 |
