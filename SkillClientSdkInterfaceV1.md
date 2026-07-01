# Skill SDK 工程文档

## 概述

Skill SDK 是 IM 客户端与 Skill 小程序共用的一层客户端 SDK，负责两类交互：

1. IM 客户端 / Skill 小程序 与 Skill 服务端之间的交互
2. IM 客户端 与 Skill 小程序之间的状态协同

本 SDK 面向以下典型场景：

- IM 客户端创建或复用 Skill 会话
- Skill 小程序接收服务端 WebSocket 流式事件并渲染
- 用户在小程序中继续多轮对话
- 用户处理 AI 提问、权限请求、工具调用结果
- 用户将最终确认的文本发送回 IM 聊天

本文档描述用于 IM 客户端、OpenCode Skill 服务端、小程序间交互的 Web 端 SDK 接口定义。
服务端 REST 接口统一返回 `ApiResponse`（`code`/`data`/`errormsg`），SDK 对外文档中的出参为 `data` 解包后的业务对象。

### SDK 与服务端接口映射（V1）

| SDK 接口 | 服务端接口 | 说明 |
|---|---|---|
| `createSession` | `POST /api/skill/sessions` | SDK 可在内部结合 `GET /api/skill/sessions` 做会话复用 |
| `sendMessage` | `POST /api/skill/sessions/{sessionId}/messages` | 出参按 `ProtocolMessageView` 对齐 |
| `getSessionMessage` | `GET /api/skill/sessions/{sessionId}/messages` | 出参按 `PageResult<ProtocolMessageView>` 对齐 |
| `getSessionMessageHistory` | `GET /api/skill/sessions/{sessionId}/messages/history` | 游标查询历史消息，适用于聊天首屏与上拉加载 |
| `sendMessageToIM` | `POST /api/skill/sessions/{sessionId}/send-to-im` | SDK 优先透传入参 `content`；未传时先查询当前会话最后一条完成消息内容，再透传 `chatId` |
| `replyPermission` | `POST /api/skill/sessions/{sessionId}/permissions/{permId}` | 出参字段与服务端一致 |
| `stopSkill` | `POST /api/skill/sessions/{id}/abort` | 中止当前轮回答，不关闭会话 |
| `closeSkill` | 无（仅 SDK 本地能力） | 仅关闭 WebSocket，不调用 `DELETE /api/skill/sessions/{id}` |
| `registerSessionListener` / `unregisterSessionListener` | `ws://{host}/ws/skill/stream` | 监听器管理为 SDK 本地能力，事件字段按 `StreamMessage` 对齐 |
| `onSessionStatusChange` / `onSkillWecodeStatusChange` / `offSkillWecodeStatusChange` / `regenerateAnswer` / `controlSkillWeCode` | 组合封装能力 | 基于 REST/WS 与本地状态派生，不新增服务端接口 |

> 说明：服务端 API-3（查询单会话）与 API-10（在线 Agent 列表）当前未作为 SDK V1 对外接口暴露。

---
### 接口总览

| 序号 | 接口名 | 作用 |
|---|---|---|
| 1 | `createSession` | 创建会话 |
| 2 | `closeSkill` | 关闭技能 |
| 3 | `stopSkill` | 停止当前轮回答 |
| 4 | `onSessionStatusChange` | 会话状态变更回调 |
| 5 | `onSkillWecodeStatusChange` | 小程序状态变更回调 |
| 5.1 | `offSkillWecodeStatusChange` | 取消小程序状态变更回调 |
| 6 | `regenerateAnswer` | 重新生成问答 |
| 7 | `sendMessageToIM` | 将 AI 结果发送到 IM |
| 8 | `getSessionMessage` | 获取当前会话消息列表 |
| 8.1 | `getSessionMessageHistory` | 获取当前会话历史消息 |
| 9 | `registerSessionListener` / `unregisterSessionListener` | 监听服务端流式消息 |
| 10 | `sendMessage` | 发送消息内容 |
| 11 | `replyPermission` | 权限确认 |
| 12 | `controlSkillWeCode` | 小程序控制 |
| 13 | `createNewSession` | 创建新会话 |
| 14 | `getHistorySessionsList` | 获取历史会话列表 |

## 1. 创建会话接口

### 调用方

IM 客户端调用

### 接口说明

创建 Skill 会话。

### 接口名

```typescript
createSession(params: CreateNewSessionParams): Promise<Session>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ak | String | 否 | Agent Plugin 对应的 Access Key，用于定位 Agent 连接 |
| title | String | 否 | 会话标题，不填则由 AI 自动生成 |
| businessSessionDomain | String | 是 | 会话关联场域。`createSession` 调用时传入值 `skill` |
| businessSessionId | String | 是 | 会话归属ID，单聊为用户ID，群聊为群Id |
| businessSessionType | String | 是 | 会话类型。`createSession` 调用时传入值 `skill` |
| assistantAccount | String | 否 | 助理ID |

### 入参示例

```json
{
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "businessSessionDomain": "skill",
  "businessSessionType": "skill",
  "assistantAccount": "x00_1",
  "businessSessionId": "x00123456"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `welinkSessionId` | string | 会话 ID |
| `userId` | String | 用户 ID（从 Cookie 解析） |
| `ak` | String \| null | Access Key，未关联 Agent 时为 `null` |
| `title` | String \| null | 会话标题，未设置时为 `null` |
| `businessSessionDomain` | String \| null | 会话关联场域 |
| `businessSessionType` | String \| null | 会话类型 |
| `businessSessionId` | String \| null | 单聊场景为对话所属人Id，群里则为群Id |
| `assistantAccount` | String \| null | 助理Id |
| `status` | String | 会话状态：`ACTIVE` / `IDLE` / `CLOSED` |
| `toolSessionId` | String \| null | OpenCode Session ID，创建时可为 `null`，后续异步填充 |
| `createdAt` | String | 创建时间，ISO-8601 |
| `updatedAt` | String | 更新时间，ISO-8601 |

### 出参示例

```json
{
  "welinkSessionId": "42",
  "userId": "10001",
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "businessSessionDomain": "skill",
  "businessSessionType": "skill",
  "businessSessionId": "x00123456",
  "assistantAccount": "group_abc123",
  "status": "ACTIVE",
  "toolSessionId": null,
  "createdAt": "2026-03-08T00:15:00",
  "updatedAt": "2026-03-08T00:15:00"
}
```

### 实现方法

1. 建立 WebSocket 连接，若当前用户已有连接则复用，否则新建：
   - **URL**: `ws://host/ws/skill/stream`
   - 用于接收服务端推送的完整事件流
2. 调用服务端 REST API 前先检查 WebSocket 连接状态，若未连接则先重连；然后请求服务端接口 `GET /api/skill/sessions` 查询历史会话列表：
   - **服务端 URL**: `GET /api/skill/sessions`
   - **查询参数**:
     ```json
     {
        "ak": "ak_xxxxxxxx",
        "businessSessionId": "group_abc123",
        "businessSessionDomain": "skill",
        "page": 0,
        "size": 50,
        "assistantAccount": "x001_1"
     }
     ```
   - 查询会话列表透传 `createSession` 中含有的对应查询参数即可
   - 查询会话列表时，SDK 按服务端接口口径直接透传 `businessSessionDomain`、`businessSessionType`、`businessSessionId`
   - 若 `businessSessionDomain` 未传，则查询时不传 `businessSessionDomain`
   - `createSession` 查询时不传 `status`
3. 若历史会话列表不为空，则先根据 `status !== CLOSED` 筛选出未关闭的会话，再根据 `updatedAt` 取最新的会话作为当前会话
4. 若不存在可复用会话（历史列表为空，或筛选后无未关闭会话），则调用 `POST /api/skill/sessions` 新建会话：
   - **请求体**:
     ```json
     {
       "ak": "ak_xxxxxxxx",
       "title": "帮我创建一个React项目",
       "businessSessionDomain": "skill",
       "businessSessionType": "skill",
       "assistantAccount": "x00_1",
       "businessSessionId": "x00123456"
     }
     ```
5. 建连后，当前 `welinkSessionId` 已注册的监听器可收到后续消息
6. 若监听器先于 `createSession` 注册，则先暂存，待连接建立后自动生效
7. `createSession` 只负责创建会话和建立连接，不发送消息；发送消息需要调用 `sendMessage` 接口

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少必填参数或参数格式错误 |
| 6000 | 网络错误 | WebSocket 连接失败或网络请求失败 |
| 7000 | 服务端错误 | 服务端创建会话失败 |

### 组合调用场景

在与 `sendMessage` 组合调用时：
1. 若 `createSession` 失败，应捕获错误并停止后续 `sendMessage` 调用
2. 若 `createSession` 成功但 `sendMessage` 失败，会话仍然存在，可稍后重试发送消息

### 调用示例

```typescript
try {
  const session = await createSession({
    ak: "ak_xxxxxxxx",
    title: "帮我创建一个React项目",
    businessSessionDomain: "skill",
    businessSessionType: "skill",
    assistantAccount: "x00_1",
    businessSessionId: "x00123456"
  });

  console.log("会话创建成功:", session.welinkSessionId);
  console.log("会话状态:", session.status);
} catch (error) {
  console.error("创建会话失败:", error.errorCode, error.errorMessage);
}
```

---

## 2. 关闭技能接口
### 调用方

sdk内部
### 接口说明

关闭 SDK 与 Skill 服务端之间的 WebSocket 连接，释放本地资源。

**重要说明**：

- `closeSkill` 在 V1 中只负责关闭 WebSocket 连接
- 该接口**不会**关闭服务端会话，也**不会**调用服务端的 `DELETE /api/skill/sessions/{welinkSessionId}`
- 因此关闭窗口后的服务端会话生命周期仍需上层自行处理

### 接口名

```typescript
closeSkill(): Promise<CloseSkillResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| 无 | 无 | 无 | 无 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 关闭状态：`success` / `failed` |

### 出参示例

```json
{
  "status": "success"
}
```

### 实现方法

1. 关闭当前 SDK 维护的 WebSocket 连接
2. 清理本地监听器、重连状态和流式缓存

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 3000 | 未建立连接 | WebSocket 连接未建立 |
| 6000 | 网络错误 | 关闭连接时出现网络错误 |
| 5000 | 内部错误 | SDK 内部处理错误 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `closeSkill` 失败，不影响其他接口的调用
2. 关闭连接后，所有依赖 WebSocket 的接口将无法正常工作，需要重新调用 `createSession` 建立连接

### 调用示例

```typescript
try {
  const result = await closeSkill();

  if (result.status === "success") {
    console.log("WebSocket 已关闭");
  }
} catch (error) {
  console.error("关闭连接失败:", error.errorCode, error.errorMessage);
}
```

---

## 3. 停止技能接口
### 调用方

IM 客户端、we码调用
### 接口说明

停止指定会话当前轮回答生成，但保持 WebSocket 连接和 Skill 会话本身继续可用。调用后用户仍可继续发送新消息。

### 接口名

```typescript
stopSkill(params: StopSkillParams): Promise<StopSkillResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `welinkSessionId` | string | 是 | 会话 ID |
| `subagentSessionId` | string | 否 | subagent 场景必传。传入时仅中止指定子 agent 链路；不传则中止主会话当前回答 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `welinkSessionId` | string | 会话 ID |
| `status` | string | 中止结果，成功时为 `aborted` |

### 出参示例

```json
{
  "welinkSessionId": "42",
  "status": "aborted"
}
```

### 实现方法

1. 调用服务端 REST API 前先检查 WebSocket 连接状态，若未连接则先重连
2. 调用服务端 REST API：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/abort`
   - **请求体**:
     ```json
     {
       "subagentSessionId": "child-session-001"
     }
     ```
3. SDK收到成功响应后，触发 `onSessionStatusChange` 的 `stopped` 状态

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4001 | 会话已关闭 | 会话已被关闭，无法停止 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `stopSkill` 失败，不影响会话的其他操作
2. 停止后，仍可以继续发送新消息触发新一轮 AI 执行
3. 若当前只想中止子 agent，而不是整条主对话链路，则必须透传原始 `subagentSessionId`

### 调用示例

```typescript
try {
  const result = await stopSkill({
    welinkSessionId: "42",
    subagentSessionId: "child-session-001"
  });

  if (result.status === "aborted") {
    console.log("当前轮回答已停止");
  }
} catch (error) {
  console.error("停止会话失败:", error.errorCode, error.errorMessage);
}
```

---

## 4. 会话状态变更回调接口
### 调用方

IM 客户端调用
### 接口说明

监听会话状态变更。

**重要说明**：

- 调用该接口**不会创建** WebSocket 连接
- 该接口依赖已建立的 WebSocket 连接
- 服务端原始状态为 `busy / idle / retry`
- 客户端 SDK 继续向上层暴露 `executing / stopped / completed` 三态
- SDK 主要通过 WebSocket `onmessage` 报文中的 `session.status` 判断会话状态，`stopSkill()` 成功是唯一的本地主动状态触发
- 当 `session.status=busy` 或 `session.status=retry` 时，返回 `executing`
- 当 `session.status=idle` 且不处于 `stopSkill()` 后的 `stopped` 保持阶段时，返回 `completed`
- 调用 `stopSkill()` 成功后，触发 `onSessionStatusChange` 的 `stopped` 状态
- 当重新执行 `sendMessage` 或 `regenerateAnswer` 后，若 WebSocket 再次返回 `session.status=busy/retry`，再返回 `executing`

### 接口名

```typescript
onSessionStatusChange(params: OnSessionStatusChangeParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| callback | function | 是 | 状态变更回调函数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | SessionStatus | 会话状态：`executing` / `stopped` / `completed` |

### 状态映射

| WebSocket 消息 `type` / 触发 | 附加条件 | SDK 状态 | 说明 |
|-----------------------------|----------|----------|------|
| `session.status` | `sessionStatus = busy` 或 `retry`（在 `sendMessage`/`regenerateAnswer` 触发新一轮后收到） | `executing` | 会话处理中或重试中 |
| `session.status` | `sessionStatus = idle` 且当前不在 `stopped` 保持阶段 | `completed` | 会话自然回到空闲，表示当前轮完成 |
| `session.status` | `sessionStatus = idle` 且当前在 `stopped` 保持阶段 | 不回调（保持 `stopped`） | `stopSkill()` 后服务端返回的中止完成状态，不映射为 `completed` |
| SDK 本地触发 | 调用 `stopSkill()` 成功 | `stopped` | 触发 `onSessionStatusChange` 的 `stopped` 状态 |

### 补充说明

- `session.title` 暂不参与状态映射
- 仅 `session.status` 参与状态映射，其他流式事件（如 `text.delta`、`tool.update`、`step.done` 等）不改变状态
- `stopSkill()` 成功后，SDK 进入 `stopped` 保持阶段；此阶段内若收到 `session.status=idle`，不触发 `completed`
- `stopped` 保持阶段仅在重新触发新一轮（`sendMessage` 或 `regenerateAnswer`）并收到后续 `session.status=busy/retry` 后结束

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` 或 `callback` |
| 3000 | 未建立连接 | WebSocket 连接未建立 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `onSessionStatusChange` 注册失败，不影响其他接口的调用
2. 建议在 `createSession` 成功后再注册回调，确保能接收到完整的状态变更

### 调用示例

```typescript
try {
  onSessionStatusChange({
    welinkSessionId: "42",
    callback: (result) => {
      switch (result.status) {
        case SessionStatus.EXECUTING:
          console.log("AI 正在处理中...");
          break;
        case SessionStatus.STOPPED:
          console.log("当前轮已停止");
          break;
        case SessionStatus.COMPLETED:
          console.log("当前轮已完成");
          break;
      }
    }
  });
} catch (error) {
  console.error("注册会话状态回调失败:", error.errorCode, error.errorMessage);
}
```

---

## 5. 小程序状态变更回调接口
### 调用方

IM 客户端调用
### 接口说明

监听小程序的状态变化，当小程序被关闭或最小化时触发回调，通知上层应用进行相应处理。

### 触发条件

| 触发场景 | 回调状态 |
|----------|----------|
| 调用 `controlSkillWeCode("close")` | `closed` |
| 调用 `controlSkillWeCode("minimize")` | `minimized` |

### 接口名

```typescript
onSkillWecodeStatusChange(callback: function): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| callback | function | 是 | 小程序状态变更回调函数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | SkillWecodeStatus | 小程序状态：`closed` / `minimized` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `callback` 参数 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `onSkillWecodeStatusChange` 注册失败，不影响其他接口的调用
2. 建议在小程序初始化时注册此回调，确保能接收到完整的状态变更

### 调用示例

```typescript
try {
  onSkillWecodeStatusChange((result) => {
    switch (result.status) {
      case SkillWecodeStatus.CLOSED:
        console.log("小程序已关闭");
        break;
      case SkillWecodeStatus.MINIMIZED:
        console.log("小程序已最小化");
        break;
    }
  });
} catch (error) {
  console.error("注册小程序状态回调失败:", error.errorCode, error.errorMessage);
}
```

---

## 5.1. 取消小程序状态变更回调接口
### 调用方

IM 客户端调用
### 接口说明

取消通过 `onSkillWecodeStatusChange` 注册的小程序状态变更回调。接口直接接收注册时使用的同一个 `callback` 引用，并仅取消该回调对应的监听。

### 接口名

```typescript
offSkillWecodeStatusChange(callback: function): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| callback | function | 是 | 需要取消监听的回调函数；必须与 `onSkillWecodeStatusChange` 注册时传入的 callback 引用一致 |

### 出参

无。

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `callback` 参数 |

若传入的 `callback` 未注册，SDK 按成功语义处理，不抛出异常。

### 组合调用场景

在与其他接口组合调用时：
1. 建议在小程序页面卸载、IM 容器销毁或不再需要监听小程序状态时调用。
2. 必须传入与 `onSkillWecodeStatusChange` 注册时相同的 `callback` 引用，否则无法匹配并移除原监听。
3. 调用后再次需要监听小程序状态时，可重新调用 `onSkillWecodeStatusChange` 注册回调。

### 调用示例

```typescript
try {
  offSkillWecodeStatusChange(handleSkillWecodeStatusChange);
} catch (error) {
  console.error("取消小程序状态回调失败:", error.errorCode, error.errorMessage);
}
```

```typescript
const handleSkillWecodeStatusChange = (result) => {
  console.log("小程序状态:", result.status);
};

onSkillWecodeStatusChange(handleSkillWecodeStatusChange);

offSkillWecodeStatusChange(handleSkillWecodeStatusChange);
```

---

## 6. 重新生成问答接口
### 调用方

IM 客户端、we码调用
### 接口说明

根据当前会话的最后一条用户消息重新触发回答生成。

### 接口名

```typescript
regenerateAnswer(params: RegenerateAnswerParams): Promise<SendMessageResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `welinkSessionId` | string | 是 | 会话 ID |

### 出参

与 `sendMessage` 返回保持一致（即服务端 API-6 的 `ProtocolMessageView`）：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `id` | string | 消息 ID |
| `welinkSessionId` | string | 所属会话 ID |
| `seq` | number \| null | 数据库排序序号，用户消息可能为 `null` |
| `messageSeq` | number \| null | 会话内消息序号，由 OpenCode 分配 |
| `role` | String | 当前服务端返回值为 `user` / `assistant` |
| `content` | String \| null | 消息纯文本内容 |
| `contentType` | String \| null | 内容类型：`plain` / `markdown` |
| `createdAt` | String | 创建时间，ISO-8601 |
| `meta` | object \| null | 元信息对象（tokens、cost 等） |
| `parts` | Array<SessionMessagePart> \| null | 消息 Part 列表 |

### 实现方法

1. 根据 `welinkSessionId` 找到最后一条用户消息
2. 若 SDK 本地已缓存用户消息，则优先复用本地缓存
3. 若本地缓存不存在，可先从历史消息中定位最后一条 `role=user` 的消息
4. 调用服务端 REST API 前先检查 WebSocket 连接状态，若未连接则先重连
5. 调用服务端 REST API：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/messages`
   - **请求体**:
      ```json
      {
        "content": "{最后一条用户消息内容}"
      }
      ```
6. 通过 WebSocket 继续接收本轮新的流式回答

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4001 | 会话已关闭 | 会话已被关闭，无法重新生成 |
| 4002 | 无用户消息 | 会话中没有用户消息可用于重新生成 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `regenerateAnswer` 失败，不影响会话的其他操作
2. 重新生成过程中，建议暂停其他消息发送，避免干扰

### 调用示例

```typescript
try {
  const result = await regenerateAnswer({
    welinkSessionId: "42"
  });

  console.log("重新生成已启动，消息ID:", result.id);
} catch (error) {
  console.error("重新生成失败:", error.errorCode, error.errorMessage);
}
```

---

## 7. 发送AI生成消息结果接口
### 调用方

IM 客户端、We码调用
### 接口说明

将用户在 Skill 小程序中最终确认的消息内容（已完成的消息内容）发送到 IM 聊天，用于“选中消息发送到聊天”场景。

**重要说明**：

- 调用此接口时：
  - 若提供 `content`，则 SDK 直接将该内容透传给服务端
  - 若不提供 `content`，则 SDK 先请求 `/api/skill/sessions/{welinkSessionId}/messages/history`，获取当前会话最后一条完成的消息内容，再发送到 IM
- 服务端 `send-to-im` REST 接口已定义；SDK 负责组装请求内容并发起调用

### 接口名

```typescript
sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| content | string | 否 | 要发送到 IM 的消息内容。若传入则直接透传给服务端；不传则由 SDK 查询当前会话最后一条完成的消息内容 |
| chatId | string | 否 | 目标 IM 群组 ID。SDK 仅透传给服务端，不做会话 `imGroupId` 到 `chatId` 的映射 |

> 说明：
> - `content` 为可选入参；若传入则建议使用最终确认后的完整文本内容
> - `chatId` 为可选入参并对外暴露。SDK 不会从当前会话 `imGroupId` 自动获取 `chatId`，仅按入参透传给服务端。

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 发送是否成功（服务端返回字段） |

### 出参示例

```json
{
  "success": true
}
```

### 实现方法

1. 调用 `sendMessageToIM` 时：
   - 若提供 `content`：SDK 直接使用该内容作为发送到 IM 的消息内容
   - 若未提供 `content`：SDK 先请求 `GET /api/skill/sessions/{welinkSessionId}/messages/history` 获取当前会话历史消息，并从返回结果中取当前会话最后一条完成的消息内容
   - 若未提供 `content` 且历史接口中不存在可用的完成消息内容，则返回错误
2. 当 `content` 为空时，SDK 查询历史消息：
   - **URL**: `GET /api/skill/sessions/{welinkSessionId}/messages/history`
   - **查询参数**: 首次请求不传 `beforeSeq`，`size` 使用服务端 / SDK 默认值或按实现侧约定传入
   - **消息选择规则**: 以历史接口返回的当前批次消息为准，取其中最后一条完成消息的内容；若该消息 `content` 为空，可按其 `parts` 聚合最终展示内容
3. SDK 调用 Skill 服务端“发送到 IM”接口时，会传入：
   - `content`：来自入参 `content`，或由历史接口解析出的最后一条完成消息内容
   - `chatId`：若入参提供则原样透传；若未提供则不由 SDK 补齐，按服务端接口规则处理
4. 调用服务端 REST API 发送消息到 IM：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/send-to-im`
   - **请求体**:
     ```json
     {
       "content": "代码重构已完成，请查看 PR #42",
       "chatId": "group_abc123"
     }
     ```
   - **响应**:
     ```json
     {
       "success": true
     }
     ```

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误，或 `content` 传入后为空字符串 |
| 4005 | 无完成消息 | 会话中没有已完成的消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若页面已拿到最终确认的消息内容，建议直接传入 `content` 调用 `sendMessageToIM`，避免额外查询历史接口
2. 若 `sendMessageToIM` 失败，可重试发送，但需注意避免重复发送

### 调用示例

#### 示例 1：直接透传内容

```typescript
try {
  const result = await sendMessageToIM({
    welinkSessionId: "42",
    content: "代码重构已完成，请查看 PR #42",
    chatId: "group_abc123"
  });

  if (result.success) {
    console.log("发送到 IM 成功");
  }
} catch (error) {
  console.error("发送到 IM 失败:", error.errorCode, error.errorMessage);
  // 可能原因：content 非法、网络错误等
}
```

#### 示例 2：未传 `content`，自动取最后一条完成消息

```typescript
try {
  const result = await sendMessageToIM({
    welinkSessionId: "42",
    // 不提供 content，SDK 自动查询当前会话最后一条完成的消息内容
    // 不提供 chatId，按服务端接口规则处理
  });

  if (result.success) {
    console.log("发送到 IM 成功");
  }
} catch (error) {
  console.error("发送到 IM 失败:", error.errorCode, error.errorMessage);
  // 可能原因：无已完成消息、网络错误等
}
```

---

## 8. 获取当前会话的消息列表接口
### 调用方

we码调用
### 接口说明

获取当前会话的消息列表。SDK 会将服务端历史消息与本地尚未落库的流式消息缓存合并后返回，特别适用于以下场景：
- 原生侧 SDK 已通过 `createSession` 建立 WebSocket 会话连接并发送消息
- AI 已持续返回回答内容，但还没回答结束
- 此时调用 `getSessionMessage` 接口需要获取当前会话所有历史消息和当前已连接会话所持续返回的消息内容

补充说明：新增 `isFirst` 入参用于区分首次获取与后续分页获取。

### 接口名

```typescript
getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<SessionMessage>>
```

### 入参

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| welinkSessionId | string | 是 | - | 会话 ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |
| isFirst | boolean | 否 | false | 是否首次获取。`true` 时合并本地流式缓存并将该消息插入返回 `content` 首位；`false` 时直接返回服务端内容（保持服务端时间降序） |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<SessionMessage> | 历史消息列表（按时间降序：从最新到最旧） |
| page | number | 当前页码（从 0 开始，透传服务端返回） |
| size | number | 每页大小（透传服务端返回） |
| total | number | 总记录数（透传服务端返回） |
| totalPages | number | 总页数（透传服务端返回） |

### 实现方法

#### 1. 获取历史消息

调用服务端 REST API 前先检查 WebSocket 连接状态，若未连接则先重连，然后再请求历史消息：

- **URL**: `GET /api/skill/sessions/{welinkSessionId}/messages`

#### 2. 合并本地流式缓存

SDK 内部维护流式消息缓存，用于存储尚未落库但已经通过 WebSocket 收到的消息级事件，典型来源包括：

- `text.delta`
- `thinking.delta`
- `tool.update`
- `question`
- `permission.ask`
- `file`
- `step.start` / `step.done`
- `streaming`

以下仅传输层事件不进入 `SessionMessage` 聚合缓存：`session.status` / `session.title` / `session.error` / `agent.online` / `agent.offline` / `error`。

#### 3. 缓存更新逻辑

收到流式消息后，SDK 按 `welinkSessionId + messageStableId + partId` 更新缓存（`messageStableId` 来源于 `messageId` 或 `snapshot.messages[].id`）：

- `text.delta` / `thinking.delta`：追加内容到临时缓存，保持实时更新
- `text.done` / `thinking.done`：落定最终内容，更新缓存为最终状态
- `tool.update`：更新同一工具部件状态和结果
- `question` / `permission.ask` / `file`：追加或更新对应 part
- `snapshot`：恢复已完成消息；`messages[]` 结构与 REST `ProtocolMessageView` 一致（包含 `seq` 与可选 `messageSeq`）
- `streaming`：恢复进行中消息；其中 `parts[].status` 对应工具状态字段

#### 4. 返回结果

调用 `getSessionMessage` 时，SDK 执行以下步骤：

1. 获取服务端历史消息（服务端 `content` 已按时间降序返回，即从最新到最旧）
2. 若 `isFirst=false`，直接返回服务端获取的内容，并保持服务端原始顺序（不做二次重排）
3. 若 `isFirst=true`，获取本地流式缓存中的所有消息，包括：
   - 已完成的消息（`text.done` / `thinking.done` 标记的）
   - 进行中的消息（仅通过 `text.delta` 等增量事件接收的）
4. 对同一稳定消息 ID（`messageId` 或 `snapshot.messages[].id`）做去重和合并，确保消息的完整性和一致性
5. 将本地流式缓存聚合出的消息插入最终返回 `content` 的第一个位置
6. 除首位插入的本地聚合消息外，其余消息保持服务端时间降序（从最新到最旧）
7. 返回最终结果；其中 `page` / `size` / `total` / `totalPages` 透传服务端返回值，不因本地首位插入消息变化

### 缓存实现细节

#### 缓存结构

```typescript
// 缓存结构示例
interface MessageCache {
  [welinkSessionId: string]: {
    messages: {
      [messageStableId: string]: {
        id: string;
        seq: number | null;
        messageSeq: number | null;
        role: string;
        content: string; // 聚合后的内容
        parts: {
          [partId: string]: {
            partId: string;
            partSeq: number;
            type: string;
            content: string;
            // 其他 part 相关字段
          };
        };
        isCompleted: boolean; // 标记消息是否已完成
        createdAt: string;
      };
    };
    messageSeqOrder: string[]; // 用于缓存合并的稳定消息 ID 列表（不作为对外返回顺序依据）
  };
}
```

#### 实时消息处理

当 WebSocket 连接已建立并持续返回消息时：
1. SDK 实时接收并解析 WebSocket 消息
2. 根据消息类型更新本地缓存
3. 对于增量消息（如 `text.delta`），实时更新缓存中的内容
4. 对于完成消息（如 `text.done`），标记消息为已完成并更新最终内容
5. 当调用 `getSessionMessage` 且 `isFirst=true` 时，SDK 会将这些实时消息与历史消息合并后返回

#### 数据一致性保证

- **去重机制**：通过稳定消息 ID（`messageId` 或 `snapshot.messages[].id`）确保消息不重复
- **首次控制**：`isFirst=true` 时合并本地流式缓存并插入首位，`isFirst=false` 时直接返回服务端结果
- **顺序保证**：返回 `content` 统一按时间降序（从最新到最旧）；`isFirst=true` 时本地聚合消息固定插入 `content[0]`
- **分页元信息透传**：`page` / `size` / `total` / `totalPages` 透传服务端返回，不受本地首位插入消息影响
- **完整性保证**：对于进行中的消息，返回当前已接收的所有内容
- **实时性保证**：缓存实时更新，确保获取到最新的消息状态

### 消息角色说明

| role 值 | 说明 |
|---------|------|
| user | 用户消息 |
| assistant | AI 回答 |
| system | 系统消息 |
| tool | 工具消息 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在 `createSession` 成功后再调用 `getSessionMessage`，确保能获取到最新的消息
2. 若 `getSessionMessage` 失败，不影响其他接口的调用

### 调用示例

```typescript
try {
  const result = await getSessionMessage({
    welinkSessionId: "42",
    page: 0,
    size: 50,
    isFirst: true
  });

  console.log("总消息数:", result.total);
  console.log("当前页:", result.page);

  result.content.forEach((message) => {
    console.log(`[${message.role}] ${message.content}`);
  });
} catch (error) {
  console.error("获取消息列表失败:", error.errorCode, error.errorMessage);
}
```

### 8.1 新增：获取当前会话历史消息（游标查询）接口

#### 调用方

we码调用

#### 接口说明

新增游标查询能力，用于聊天页首屏加载和上拉加载更早消息。该接口不依赖 `page/total`，通过游标 `nextBeforeSeq` 逐批次向前翻页。

#### 接口名

```typescript
getSessionMessageHistory(params: GetSessionMessageHistoryParams): Promise<CursorResult<SessionMessage>>
```

#### 入参

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| welinkSessionId | string | 是 | - | 会话 ID |
| beforeSeq | number | 否 | - | 查询该序号之前的更早消息；首屏加载不传 |
| size | number | 否 | 50 | 每次拉取条数 |

#### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<SessionMessage> | 当前批次消息列表（SDK 透传服务端顺序；当前服务端为消息时间正序） |
| size | number | 本次查询的 page size |
| hasMore | boolean | 是否还有更早消息 |
| nextBeforeSeq | number \| null | 下次继续向前翻页时使用的游标 |

#### 实现方法

1. 调用服务端 REST API 前先检查 WebSocket 连接状态，若未连接则先重连。
2. 调用服务端：
   - **URL**: `GET /api/skill/sessions/{welinkSessionId}/messages/history`
   - **查询参数**: `beforeSeq`（可选）、`size`（可选，默认 50）
3. SDK 直接透传服务端返回的 `content` / `size` / `hasMore` / `nextBeforeSeq`。

#### 组合调用建议

1. 首屏加载：不传 `beforeSeq`，仅传 `size`。
2. 上拉加载更早消息：传上一次响应中的 `nextBeforeSeq`。
3. 当 `hasMore=false` 时停止继续请求。

#### 调用示例

```typescript
try {
  // 首屏加载
  const firstPage = await getSessionMessageHistory({
    welinkSessionId: "42",
    size: 50
  });

  // 上拉加载更早消息
  if (firstPage.hasMore && firstPage.nextBeforeSeq !== null) {
    const olderPage = await getSessionMessageHistory({
      welinkSessionId: "42",
      size: 50,
      beforeSeq: firstPage.nextBeforeSeq
    });

    console.log("更早消息条数:", olderPage.content.length);
  }
} catch (error) {
  console.error("游标查询消息失败:", error.errorCode, error.errorMessage);
}
```

### Subagent 支持说明（V1 增量）

为支持 OpenCode subagent / task 场景，V1 在现有主会话协议之上补充以下约定：

1. SDK 仍以主会话 `welinkSessionId` 为监听与查询入口，不新增第二条 WebSocket 监听通道。
2. 当服务端事件来自子 agent 时，会在 `StreamMessage`、`SessionMessagePart`、`snapshot.messages[].parts[]`、`streaming.parts[]` 中附带 subagent 扩展字段。
3. 客户端可按 `subagentSessionId` 对子 agent 产生的 `text` / `thinking` / `tool` / `file` / `permission` / `question` 进行分组展示。
4. 当用户回复子 agent 发起的 `permission.ask` 或 `question` 时，应在 `replyPermission` 或 `sendMessage` 中透传 `subagentSessionId`，用于服务端路由到真实子会话。
5. 所有 subagent 扩展字段均为可选字段；未携带时，按普通主会话消息处理，保持与旧版本兼容。

---

## 9. 注册会话监听器接口
### 调用方

we码调用
### 接口说明

注册会话监听器，用于接收 WebSocket 推送的完整事件流、错误信息和连接关闭事件。该接口独立于消息发送操作，支持在任何时机注册监听器，SDK 会确保不会因调用时序问题遗漏消息。

同一个 `welinkSessionId` 只允许注册一次监听；若已注册，再次注册不做任何处理，仍返回 `status: success`。

SDK 对外暴露的 `StreamMessage` 与服务端 WebSocket 协议保持对齐，覆盖以下事件：

- 文本流：`text.delta` / `text.done`
- 思维链：`thinking.delta` / `thinking.done`
- 工具调用：`tool.update`
- 提问交互：`question`
- 权限交互：`permission.ask` / `permission.reply`
- 附件：`file`
- 用户消息回放：`message.user`
- 推理步骤：`step.start` / `step.done`
- 会话状态：`session.status` / `session.title` / `session.error`
- 断线恢复：`snapshot` / `streaming`
- 云端扩展：`planning.delta` / `planning.done` / `searching` / `search_result` / `reference` / `ask_more`
- 系统事件：`agent.online` / `agent.offline` / `error`

#### 字段对齐说明（重要）

- WebSocket 每帧直接返回一个平铺的 `StreamMessage` JSON，对外**没有外层 envelope**
- 服务端 WebSocket `onmessage` 中 `question` 事件新增 `questions` 字段；字段格式为 `QuestionItem[]`，用于一次返回多组问题。
- `snapshot.messages[].id` 类型为 `string`（稳定消息 ID）
- `snapshot.messages[].seq` 类型为 `number | null`（数据库排序序号，用户消息可能为 `null`）
- `snapshot.messages[].messageSeq` 类型为 `number | null`（会话内消息序号）
- `snapshot.messages[].contentType` 类型为 `string`（`plain` / `markdown`）
- `streaming.messageId` 类型为 `string | null`（仅 `parts` 非空时出现）
- `streaming.parts[].status` 为工具状态字段（字段名为 `status`）
- `question` 事件分为两阶段：`running` 阶段带 `header` / `question` / `options` / `questions`，`completed` / `error` 阶段主要返回 `status` / `toolName` / `toolCallId` / `output`
- `permission.reply` 为极简事件，通常不带 `messageId` / `partId` / `partSeq` / `emittedAt`
- `agent.online` / `agent.offline` 为极简事件，仅包含 `type` 与 `seq`；其中 `agent.offline` 可能重复下发，前端建议按离线周期去重
- `search_result` 使用字段 `searchResults`，`ask_more` 使用字段 `askMoreQuestions`
- `session.status` / `session.title` / `session.error` / `agent.online` / `agent.offline` / `error` 属于传输层事件，不应作为 `SessionMessage` 聚合入消息列表

### 接口名

```typescript
registerSessionListener(params: RegisterSessionListenerParams): RegisterSessionListenerResult
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| onMessage | function | 是 | 消息回调函数，接收 `StreamMessage` |
| onError | function | 否 | 错误回调函数，接收错误信息 |
| onClose | function | 否 | 连接关闭回调函数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作结果，固定为 `success` |

### SessionListener 类型定义

```typescript
interface SessionListener {
  onMessage: (message: StreamMessage) => void;
  onError?: (error: SessionError) => void;
  onClose?: (reason: string) => void;
}
```

### SessionError 类型定义

```typescript
interface SessionError {
  code: string;
  message: string;
  timestamp: number;
}
```

### 实现方法

1. SDK 内部维护每个会话唯一监听器（`onMessage`/`onError`/`onClose`）记录
2. 同一 `welinkSessionId` 仅允许注册一次；重复注册不做任何处理并返回 `status: success`
3. 若 WebSocket 已建立，则监听器立即生效；若 WebSocket 尚未建立，则监听器先暂存，待连接建立后自动生效
4. 连接错误时触发 `onError`
5. 连接关闭时触发 `onClose`

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` 或 `onMessage` |

### 组合调用场景

在与其他接口组合调用时：
1. 若页面可能晚于会话开始时机打开，建议在页面初始化阶段尽早调用 `registerSessionListener`
2. 若 `registerSessionListener` 失败，不影响其他接口的调用

### 注意事项

- 回调注册是异步安全的，可在任何时机调用
- 同一个 `welinkSessionId` 重复注册时，SDK 不做任何处理并返回 `status: success`
- 如需替换监听器，需先调用 `unregisterSessionListener({ welinkSessionId })` 清理后再注册

### 调用示例

```typescript
try {
  const onMessage = (message: StreamMessage) => {
    switch (message.type) {
      case "text.delta":
        console.log("AI响应片段:", message.content);
        break;
      case "text.done":
        console.log("AI响应完成:", message.content);
        break;
      case "tool.update":
        console.log("工具状态:", message.toolName, message.status);
        break;
      case "question":
        if (message.status === "running") {
          console.log("AI提问:", message.question, message.options, message.questions);
        } else {
          console.log("AI提问已完成:", message.toolCallId, message.output);
        }
        break;
      case "permission.ask":
        console.log("权限请求:", message.permissionId, message.title);
        break;
      case "permission.reply":
        console.log("权限请求已应答:", message.permissionId, message.response);
        break;
      case "message.user":
        console.log("收到用户消息回放:", message.content);
        break;
      case "session.status":
        console.log("原始会话状态:", message.sessionStatus);
        break;
      case "snapshot":
        console.log("收到断线恢复快照，消息数:", message.messages?.length ?? 0);
        break;
      case "streaming":
        console.log("收到进行中流状态:", message.sessionStatus, message.parts?.length ?? 0);
        break;
      case "searching":
        console.log("搜索中:", message.keywords);
        break;
      case "search_result":
        console.log("搜索结果:", message.searchResults);
        break;
      case "reference":
        console.log("引用列表:", message.references);
        break;
      case "ask_more":
        console.log("追问建议:", message.askMoreQuestions);
        break;
      case "agent.online":
      case "agent.offline":
        console.log("Agent状态事件:", message.type);
        break;
      case "session.error":
      case "error":
        console.error("处理错误:", message.error);
        break;
    }
  };

  const onError = (error: SessionError) => {
    console.error("连接错误:", error.code, error.message);
  };

  const onClose = (reason: string) => {
    console.log("连接关闭:", reason);
  };

  registerSessionListener({
    welinkSessionId: "42",
    onMessage,
    onError,
    onClose
  });
} catch (error) {
  console.error("注册会话监听器失败:", error.errorCode, error.errorMessage);
}
```

---

## 10. 移除会话监听器接口
### 调用方

we码调用
### 接口说明

移除已注册的会话监听器。当监听器不再需要接收消息时调用，例如小程序关闭或页面销毁。

该接口只需要 `welinkSessionId`，SDK 会移除该会话下当前已注册的 `onMessage` / `onError` / `onClose` 全部监听。
该接口仅移除监听器，不会执行关闭 WebSocket 连接操作。

### 接口名

```typescript
unregisterSessionListener(params: UnregisterSessionListenerParams): UnregisterSessionListenerResult
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作结果，固定为 `success` |

### 实现方法

1. 根据 `welinkSessionId` 移除该会话已注册的全部监听器（`onMessage` / `onError` / `onClose`）
2. 不执行 WebSocket 连接关闭操作；连接生命周期由 `closeSkill` 独立管理

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` |
| 4006 | 监听器不存在 | 当前 `welinkSessionId` 未注册监听器 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在组件卸载时调用 `unregisterSessionListener`，避免内存泄漏
2. 若 `unregisterSessionListener` 失败，不影响其他接口的调用

### 调用示例

```typescript
try {
  onUnmounted(() => {
    unregisterSessionListener({
      welinkSessionId: "42"
    });
  });
} catch (error) {
  console.error("移除会话监听器失败:", error.errorCode, error.errorMessage);
}
```

---

## 11. 发送消息内容接口
### 调用方

IM客户端、we码调用
### 接口说明

发送用户输入内容，触发会话的新一轮回答。支持首次发送消息和后续多轮对话。AI 响应通过 `registerSessionListener` 注册的回调接收。

### 接口名

```typescript
sendMessage(params: SendMessageParams): Promise<SendMessageResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| content | string | 是 | 用户输入的消息内容 |
| toolCallId | string | 否 | 回答 AI `question` 时携带对应的工具调用 ID |
| questionId | string | 否 | 回答 AI `question` 时携带的问题 ID。服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId` |
| subagentSessionId | string | 否 | subagent 场景必传。回答子 agent 发起的 `question` 时，必须回传事件中的真实子会话 ID |
| businessExtParam | object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `id` | string | 消息 ID |
| `welinkSessionId` | string | 所属会话 ID |
| `seq` | number \| null | 数据库排序序号，用户消息可能为 `null` |
| `messageSeq` | number \| null | 会话内消息序号，由 OpenCode 分配 |
| `role` | String | 当前服务端返回值为 `user` / `assistant` |
| `content` | String \| null | 消息纯文本内容 |
| `contentType` | String \| null | 内容类型：`plain` / `markdown` |
| `createdAt` | String | 创建时间，ISO-8601 |
| `meta` | object \| null | 元信息对象（tokens、cost 等） |
| `parts` | Array<SessionMessagePart> \| null | 消息 Part 列表 |

### 实现方法

1. 检查 WebSocket 连接状态，若未连接则自动重连：
   - **URL**: `ws://host/ws/skill/stream`
   - 用于接收服务端推送的完整事件流
2. 调用服务端 REST API 发送消息：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "请帮我重构登录模块的校验逻辑",
       "toolCallId": "call_2",
       "questionId": "question_2",
       "subagentSessionId": "child-session-001",
       "businessExtParam": {
         "scene": "miniapp"
       }
     }
     ```
3. AI 流式响应由 WebSocket 推送到 SDK，再通过监听器分发
4. 对于首次发送消息的场景，此接口会触发首轮 AI 执行
5. 若当前回复的是 `question`，且服务端事件中带有问题 ID，则 SDK 应按对外文档口径透传 `questionId`
6. 若当前回复的是子 agent 发起的 `question`，必须同时透传 `toolCallId` 与 `subagentSessionId`，否则服务端会把应答路由到主对话

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 或 `content` 缺失或格式错误 |
| 4001 | 会话已关闭 | 会话已被关闭，无法发送消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |
| 7001 | AI 网关错误 | AI-Gateway 调度失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `sendMessage` 失败，不影响会话的其他操作
2. 建议在 `createSession` 成功后再调用 `sendMessage`，确保能正常发送消息
3. 发送消息后，应注册 `registerSessionListener` 来接收 AI 的响应
4. 若当前回复的是 `question`，且服务端事件中带有问题 ID，则 SDK 应透传 `questionId`
5. 若当前回复的是子 agent 发起的 `question`，必须同时透传 `toolCallId` 与 `subagentSessionId`

### 调用示例

#### 示例 1：首次发送消息（创建会话后）

```typescript
try {
  // 先创建会话
  const session = await createSession({
    ak: "ak_xxxxxxxx",
    title: "帮我创建一个React项目",
    businessSessionDomain: "skill",
    businessSessionType: "skill",
    assistantAccount: "x00_1",
    businessSessionId: "x00123456"
  });

  // 然后发送首条消息
  const result = await sendMessage({
    welinkSessionId: session.welinkSessionId,
    content: "帮我创建一个React项目"
  });

  console.log("消息发送成功:", result.id);
  console.log("创建时间:", result.createdAt);
} catch (error) {
  console.error("操作失败:", error.errorCode, error.errorMessage);
}
```

#### 示例 2：后续多轮对话

```typescript
try {
  const result = await sendMessage({
    welinkSessionId: "42",
    content: "请帮我重构登录模块的校验逻辑"
  });

  console.log("消息发送成功:", result.id);
  console.log("创建时间:", result.createdAt);
} catch (error) {
  console.error("发送消息失败:", error.errorCode, error.errorMessage);
}
```

#### 示例 3：回复子 agent 发起的 question

```typescript
try {
  const result = await sendMessage({
    welinkSessionId: "42",
    content: "继续执行",
    toolCallId: "call_q_1",
    questionId: "question_q_1",
    subagentSessionId: "child-session-001"
  });

  console.log("子 agent 应答发送成功:", result.id);
} catch (error) {
  console.error("发送子 agent 应答失败:", error.errorCode, error.errorMessage);
}
```

---

## 12. 权限确认接口
### 调用方

we码调用
### 接口说明

对 AI 发起的权限确认请求进行批准或拒绝。当 AI 需要执行文件修改、命令执行等敏感操作时，前端展示确认 UI，用户决策后调用此接口回复。

### 接口名

```typescript
replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `welinkSessionId` | string | 是 | 会话 ID |
| `permId` | String | 是 | 权限请求 ID |
| `response` | String | 是 | `once` / `always` / `reject` |
| `subagentSessionId` | String | 否 | subagent 场景必传。回复子 agent 发起的 `permission.ask` 时，必须回传事件中的真实子会话 ID |
| `businessExtParam` | Object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `welinkSessionId` | string | 会话 ID |
| `permissionId` | String | 权限请求 ID |
| `response` | String | 回复值 |

### 实现方法

1. 调用服务端 REST API 前先检查 WebSocket 连接状态，若未连接则先重连
2. 调用服务端 REST API：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/permissions/{permId}`
   - **请求体**:
     ```json
     {
       "response": "once",
       "subagentSessionId": "child-session-001",
       "businessExtParam": {
         "scene": "miniapp"
       }
     }
     ```
3. 若收到的 `permission.ask` 事件带有 `subagentSessionId`，则该字段必须原样回传，否则服务端会把授权路由到主对话
4. 若业务侧传入 `businessExtParam`，SDK 应原样透传给服务端

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId`、`permId` 或 `response` 无效 |
| 4007 | 权限请求不存在 | 指定的权限请求 ID 不存在 |
| 4008 | 权限请求已过期 | 权限请求已超时或已处理 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在收到 `permission.ask` 事件后再调用 `replyPermission`，确保权限请求有效
2. 若 `replyPermission` 失败，可重试发送，但需注意避免重复处理
3. 若权限请求来自子 agent，调用时必须透传 `subagentSessionId`

### 调用示例

```typescript
try {
  const result = await replyPermission({
    welinkSessionId: "42",
    permId: "perm_1",
    response: "once",
    subagentSessionId: "child-session-001"
  });

  console.log("权限确认结果:", result.response);
} catch (error) {
  console.error("回复权限确认失败:", error.errorCode, error.errorMessage);
}
```

---

## 13. 小程序控制接口
### 调用方

we码调用
### 接口说明

执行小程序的关闭或最小化操作，用于控制小程序生命周期。

**重要说明**：

- 当前 V1 保持现状：`close` 只处理小程序侧关闭逻辑
- 上层可在 `close` 成功后继续调用 `closeSkill()` 释放 WebSocket
- 是否关闭服务端会话仍由上层自行决定，当前客户端文档未新增该能力

### 接口名

```typescript
controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | SkillWeCodeAction | 是 | 操作类型：`close` / `minimize` |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作状态：`success` / `failed` |

### 实现方法

1. `close`：
   - 触发 `onSkillWecodeStatusChange`，状态为 `closed`
   - 上层可选择继续调用 `closeSkill` 释放 WebSocket
2. `minimize`：
   - 触发 `onSkillWecodeStatusChange`，状态为 `minimized`
   - WebSocket 保持连接，后续可恢复

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `action` 缺失或值无效 |
| 4009 | 小程序不存在 | 小程序未初始化或已关闭 |
| 4010 | 操作失败 | 小程序操作执行失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `controlSkillWeCode` 失败，不影响其他接口的调用
2. 建议在 `close` 操作后调用 `closeSkill` 释放 WebSocket 连接

### 调用示例

```typescript
try {
  await controlSkillWeCode({
    action: SkillWeCodeAction.CLOSE
  });

  await controlSkillWeCode({
    action: SkillWeCodeAction.MINIMIZE
  });
} catch (error) {
  console.error("控制小程序失败:", error.errorCode, error.errorMessage);
}
```

---
## 14. 创建新会话

### 调用方

IM 客户端调用

### 接口说明

创建新的 Skill 会话。

### 接口名

```typescript
createNewSession(params: CreateNewSessionParams): Promise<Session>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ak | String | 否 | 应用 AK；无 AK 的纯本地会话也合法 |
| title | String | 否 | 会话标题；缺省时由服务端后续推送 `session.title` 填充 |
| assistantAccount | String | 否 | 助理账号；为空时是否允许创建由服务端开关控制 |
| businessSessionDomain | String | 是 | 业务侧外部 ID 三元组中的 domain；miniapp 场景通常传 `skill` |
| businessSessionType | String | 是 | 业务侧外部 ID 三元组中的 type；miniapp 场景通常传 `skill` |
| businessSessionId | String | 是 | 业务侧外部 ID 三元组中的 id；单聊传用户 ID，群聊传群 ID |

### 入参示例

```json
{
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "assistantAccount": "x00_1",
  "businessSessionDomain": "skill",
  "businessSessionType": "skill",
  "businessSessionId": "x00123456"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
 | `welinkSessionId` | string | 会话 ID |
 | `userId` | String | 用户 ID（从 Cookie 解析） |
 | `ak` | String \| null | Access Key，未关联 Agent 时为 `null` |
 | `title` | String \| null | 会话标题，未设置时为 `null` |
 | `businessSessionDomain` | String \| null | 业务侧外部 ID 三元组中的 domain |
 | `businessSessionType` | String \| null | 业务侧外部 ID 三元组中的 type |
 | `businessSessionId` | String \| null | 业务侧外部 ID 三元组中的 id |
 | `assistantAccount` | String \| null | 助理Id |
| `status` | String | 会话状态：`ACTIVE` / `IDLE` / `CLOSED` |
| `toolSessionId` | String \| null | OpenCode Session ID，创建时可为 `null`，后续异步填充 |
| `createdAt` | String | 创建时间，ISO-8601 |
| `updatedAt` | String | 更新时间，ISO-8601 |

### 出参示例

```json
{
  "welinkSessionId": "42",
  "userId": "10001",
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "businessSessionDomain": null,
  "businessSessionType": null,
  "businessSessionId": null,
  "assistantAccount": "group_abc123",
  "status": "ACTIVE",
  "toolSessionId": null,
  "createdAt": "2026-03-08T00:15:00",
  "updatedAt": "2026-03-08T00:15:00"
}
```

### 实现方法

1. 建立 WebSocket 连接，若当前用户已有WS连接则复用，否则新建：
   - **URL**: `ws://host/ws/skill/stream`
   - 用于接收服务端推送的完整事件流
2. 调用 `POST /api/skill/sessions` 新建会话：
   - **请求体**:
     ```json
     {
       "ak": "ak_xxxxxxxx",
       "title": "帮我创建一个React项目",
       "assistantAccount": "x00_1",
       "businessSessionDomain": null,
       "businessSessionType": null,
       "businessSessionId": "x00123456"
     }
     ```
3. 建连后，当前 `welinkSessionId` 已注册的监听器可收到后续消息

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少必填参数或参数格式错误 |
| 6000 | 网络错误 | WebSocket 连接失败或网络请求失败 |
| 7000 | 服务端错误 | 服务端创建会话失败 |


### 调用示例

```typescript
try {
  const session = await createNewSession({
    ak: "ak_xxxxxxxx",
    title: "帮我创建一个React项目",
    assistantAccount: "x00_1",
    businessSessionDomain: null,
    businessSessionType: null,
    businessSessionId: "x00123456"
  });

  console.log("会话创建成功:", session.welinkSessionId);
  console.log("会话状态:", session.status);
} catch (error) {
  console.error("创建会话失败:", error.errorCode, error.errorMessage);
}
```

---
## 15. 获取历史会话列表

### 调用方

IM 客户端调用

### 接口说明

获取用户历史会话列表。
支持通过新增入参 `businessSessionDomain` 按会话来源域过滤（`miniapp` / `im`）。

### 接口名

```typescript
getHistorySessionsList(params: HistorySessionsParams): Promise<PageResult<Session>>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 |  页码，默认值为0 |
| size | number | 否 |   每页大小，默认值为50 |
| status | string | 否   | 按状态过滤（`ACTIVE`/`IDLE`/`CLOSED`） |
| ak | string | 否 |   按agent ak过滤 |
| businessSessionId | string | 否 | 按会话所属Id过滤，单聊为用户Id，群聊为群Id  |
| assistantAccount | string | 否 |   按助理Id过滤 |
| businessSessionDomain | string | 否 | 会话来源域：`miniapp` / `im` |


### 入参示例

```json
{
  "ak": "ak_xxxxxxxx",
  "businessSessionId": "group_abc123",
  "businessSessionDomain": "miniapp",
  "page": 0,
  "size": 50,
  "status": "IDLE",
  "assistantAccount": "x001_1"
}
```

### 出参

| 字段 | 类型 | 说明 |
|------|------|------|
| content | Array<T> | 当前页数据 |
| page | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |
| total | number | 总记录数 |
| totalPages | number | 总页数 |

### 出参示例

```json
{
  "content": [
    {
      "welinkSessionId": "42",
        "userId": "10001",
        "ak": "ak_xxxxxxxx",
        "title": "帮我创建一个React项目",
        "businessSessionDomain": "miniapp",
        "businessSessionType": "direct",
        "businessSessionId": "x00123456",
        "assistantAccount": "group_abc123",
        "status": "ACTIVE",
        "toolSessionId": null,
        "createdAt": "2026-03-08T00:15:00",
        "updatedAt": "2026-03-08T00:15:00"
    }
  ],
  "page": 0,
  "size": 20,
  "total": 1,
  "totalPages": 1
}
```

### 实现方法

1. 建立 WebSocket 连接，若当前用户已有WS连接则复用，否则新建：
   - **URL**: `ws://host/ws/skill/stream`
   - 用于接收服务端推送的完整事件流
2. 调用 `GET /api/skill/sessions` 查询会话列表：
   - **查询参数**:
     ```json
     {
       "ak": "ak_xxxxxxxx",
       "businessSessionId": "group_abc123",
       "businessSessionDomain": "miniapp",
       "page": 0,
       "size": 50,
       "status": "IDLE",
       "assistantAccount": "x001_1"
     }
     ```

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少必填参数或参数格式错误 |
| 6000 | 网络错误 | WebSocket 连接失败或网络请求失败 |


### 调用示例

```typescript
try {
  const sessionsList = await getHistorySessionsList({
    ak: "ak_xxxxxxxx",
    businessSessionId: "group_abc123",
    businessSessionDomain: "miniapp",
    page: 0,
    size: 50,
    status: "IDLE",
    assistantAccount: "x001_1"
  });
} catch (error) {
  //
}
```

## 数据类型定义

> 说明：
> - 以下类型以客户端 SDK 对外契约为准
> - `StreamMessage` 与服务端 WebSocket 事件模型保持对齐
> - 本文档仅修订客户端契约；未在服务端文档中补齐的接口，仍需后续与服务端统一

### CreateNewSessionParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ak | String | 否 | 应用 AK；无 AK 的纯本地会话也合法 |
| title | String | 否 | 会话标题；缺省时由服务端后续推送 `session.title` 填充 |
| assistantAccount | String | 否 | 助理账号；为空时是否允许创建由服务端开关控制 |
| businessSessionDomain | String | 否 | 业务侧外部 ID 三元组中的 domain；miniapp 场景通常传 `null` |
| businessSessionType | String | 否 | 业务侧外部 ID 三元组中的 type；miniapp 场景通常传 `null` |
| businessSessionId | String | 是 | 业务侧外部 ID 三元组中的 id；单聊传用户 ID，群聊传群 ID |

### StopSkillParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 要停止的会话 ID |

### RegenerateAnswerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 需要重新生成的会话 ID |

### OnSessionStatusChangeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| callback | function | 是 | 状态变更回调函数 |

### GetSessionMessageParams

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| welinkSessionId | string | 是 | - | 会话 ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |
| isFirst | boolean | 否 | false | 是否首次获取。`true` 时合并本地流式缓存并将该消息插入返回 `content` 首位；`false` 时直接返回服务端内容（保持服务端时间降序） |

### GetSessionMessageHistoryParams

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| welinkSessionId | string | 是 | - | 会话 ID |
| beforeSeq | number | 否 | - | 查询该序号之前的更早消息；首屏加载不传 |
| size | number | 否 | 50 | 每次拉取条数 |

### RegisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| onMessage | function | 是 | 接收 `StreamMessage` 的回调 |
| onError | function | 否 | 错误回调 |
| onClose | function | 否 | 连接关闭回调 |

> 约束：同一个 `welinkSessionId` 只允许注册一次；重复注册不做任何处理并返回 `status: success`。

### UnregisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |

### SendMessageParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| content | string | 是 | 用户输入的消息内容 |
| toolCallId | string | 否 | 回答 AI `question` 时携带的工具调用 ID |
| questionId | string | 否 | 回答 AI `question` 时携带的问题 ID。服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId` |
| subagentSessionId | string | 否 | subagent 场景必传。回答子 agent 发起的 `question` 时，必须回传事件中的真实子会话 ID |
| businessExtParam | object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

### ReplyPermissionParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| permId | string | 是 | 权限请求 ID |
| response | string | 是 | `once` / `always` / `reject` |
| subagentSessionId | string | 否 | subagent 场景必传。回复子 agent 发起的 `permission.ask` 时，必须回传事件中的真实子会话 ID |
| businessExtParam | object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

### ControlSkillWeCodeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | SkillWeCodeAction | 是 | 操作类型：`close` / `minimize` |

### SendMessageToIMParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| content | string | 否 | 要发送到 IM 的消息内容。若传入则直接透传给服务端；不传则由 SDK 查询当前会话最后一条完成的消息内容 |
| chatId | string | 否 | 目标 IM 群组 ID。SDK 仅透传给服务端，不做会话 `imGroupId` 到 `chatId` 的映射 |

> 说明：
> - `content` 为可选入参；若传入则建议使用最终确认后的完整文本内容
> - `chatId` 为可选入参并对外暴露。SDK 不会从当前会话 `imGroupId` 自动获取 `chatId`，仅按入参透传给服务端。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| onMessage | function | 是 | 消息回调函数，接收完整 `StreamMessage` 事件 |
| onError | function | 否 | 错误回调函数 |
| onClose | function | 否 | 连接关闭回调函数 |

### SessionError

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | 错误码 |
| message | string | 错误信息 |
| timestamp | number | 时间戳（毫秒） |

### SDKError

| 字段 | 类型 | 说明 |
|------|------|------|
| errorCode | number | 错误码 |
| errorMessage | string | 错误消息 |

### PageResult<T>

| 字段 | 类型 | 说明 |
|------|------|------|
| content | Array<T> | 当前页数据 |
| page | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |
| total | number | 总记录数 |
| totalPages | number | 总页数 |

### CursorResult<T>

| 字段 | 类型 | 说明 |
|------|------|------|
| content | Array<T> | 当前批次数据 |
| size | number | 本次查询的 page size |
| hasMore | boolean | 是否还有更早数据 |
| nextBeforeSeq | number \| null | 下次继续向前翻页的游标 |

### SessionMessage

> 说明：服务端 `ProtocolMessageView` 使用 `@JsonInclude(NON_NULL)`，非必返字段会省略。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 消息 ID（稳定消息 ID，来源于服务端 `messageId` 或历史记录 `id`） |
| seq | number \| null | 数据库排序序号，用户消息可能为 `null` |
| welinkSessionId | string | 所属会话 ID |
| role | string | 当前服务端返回值为 `user` / `assistant` |
| content | string \| null | 消息纯文本内容（assistant 消息可能为 `null`） |
| contentType | string \| null | 内容类型：`plain` / `markdown` |
| meta | object \| null | 元信息（tokens、cost 等），通常仅 assistant 消息存在 |
| messageSeq | number \| null | 会话内消息序号，由 OpenCode 分配 |
| parts | Array<SessionMessagePart> \| null | 消息部件列表（通常仅 assistant 消息存在） |
| createdAt | string | 创建时间，ISO-8601 |

### SessionMessagePart

> 说明：`SessionMessagePart` 字段按 `type` 条件返回，服务端 `null` 字段会省略。

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string | Part 唯一 ID |
| partSeq | number | Part 在消息内的顺序 |
| type | string | `text` / `thinking` / `tool` / `question` / `permission` / `file` |
| content | string \| null | 文本内容（按 `type` 可选） |
| toolName | string \| null | 工具名（`tool` 类型） |
| toolCallId | string \| null | 工具调用 ID（`tool`/`question` 类型） |
| input | object \| null | 工具或问题输入参数（`tool` / `question` 类型） |
| output | string \| null | 工具输出（`tool` 类型） |
| error | string \| null | 工具错误信息（`tool` 类型） |
| title | string \| null | 标题（工具标题或权限标题） |
| header | string \| null | 问题分组标题（`question` 类型） |
| question | string \| null | 问题正文（`question` 类型） |
| questionId | string \| null | 问题 ID（`question` 类型）；服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId` |
| options | string[] \| null | 问题选项（`question` 类型） |
| questions | QuestionItem[] \| null | 多题结构（`question` 类型）；服务端 WebSocket `onmessage` 新增字段 |
| permissionId | string \| null | 权限请求 ID（`permission` 类型） |
| permType | string \| null | 权限类型（`permission` 类型） |
| metadata | object \| null | 权限元数据（`permission` 类型） |
| response | string \| null | 权限回复（`permission` 类型，已回复时出现） |
| status | string \| null | 状态字段（服务端原字段名，按 `type` 出现） |
| fileName | string \| null | 文件名（`file` 类型） |
| fileUrl | string \| null | 文件 URL（`file` 类型） |
| fileMime | string \| null | 文件 MIME 类型（`file` 类型） |

#### SessionMessagePart 的 Subagent 扩展字段

> 以下字段均为可选；仅当当前 Part 来源于子 agent 时返回。

| 字段 | 类型 | 说明 |
|------|------|------|
| subagentSessionId | string \| null | 子 agent 的真实会话 ID，建议客户端作为子任务分组主键 |
| subagentName | string \| null | 子 agent 显示名；若存在嵌套层级，使用 `" > "` 作为路径分隔符 |

### QuestionItem

`questions` 字段中的单个问题对象，用于 WebSocket `question` 事件、`SessionMessagePart.questions`、`streaming.parts[].questions` 等多题结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| header | string | 问题分组标题 |
| question | string | 问题正文 |
| options | string[] | 问题选项 |
| multiSelect | boolean | 是否支持多选 |

示例：

```json
[
  {
    "header": "编程",
    "question": "问题1",
    "options": ["python", "java"],
    "multiSelect": false
  }
]
```

### SessionStatusResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | SessionStatus | 会话状态：`executing` / `stopped` / `completed` |

### SessionStatus

| 枚举值 | 说明 |
|--------|------|
| executing | 执行中 |
| stopped | 已停止 |
| completed | 已完成 |

### SkillWecodeStatusResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | SkillWecodeStatus | 小程序状态：`closed` / `minimized` |
| timestamp | number | 状态变更时间戳（毫秒） |
| message | string | 状态变更说明（可选） |

### SkillWecodeStatus

| 枚举值 | 说明 |
|--------|------|
| closed | 小程序已关闭 |
| minimized | 小程序已缩小到后台 |

### SkillWeCodeAction

| 枚举值 | 说明 |
|--------|------|
| close | 关闭小程序 |
| minimize | 最小化小程序 |

### StreamMessage

> 说明：服务端 `StreamMessage` 使用 `@JsonInclude(NON_NULL)`，除各事件说明中的必返字段外，其余字段按事件类型返回并可能省略。

#### 公共字段

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 事件类型 |
| seq | number \| null | 递增序列号；大部分事件都有，个别极简事件也可能省略 |
| welinkSessionId | string | 所属会话 ID；`agent.online` / `agent.offline` 不携带 |
| emittedAt | string \| null | 事件产生时间，ISO-8601；`permission.reply` / `agent.online` / `agent.offline` / `error` 通常不携带 |

#### 消息级字段

> 以下字段按事件类型返回，不保证每个事件都包含。

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | string \| null | 稳定消息 ID |
| sourceMessageId | string \| null | 源消息 ID（服务端转译链路原始消息 ID） |
| messageSeq | number \| null | 会话内消息顺序 |
| role | string \| null | 当前服务端返回值为 `user` / `assistant`；常见于 Part 级事件、`message.user`、`streaming`、`permission.reply` |

#### Part级字段

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string \| null | Part 唯一 ID（仅 part 类事件出现） |
| partSeq | number \| null | Part 在消息内的顺序（仅 part 类事件出现；`permission.ask` / `permission.reply` 可能缺失） |

#### Question事件字段（`type = question`）

| 字段 | 类型 | 说明 |
|------|------|------|
| header | string \| null | 问题分组标题；`running` 阶段可返回 |
| question | string \| null | 问题正文；`running` 阶段可返回 |
| options | string[] \| null | 问题选项；`running` 阶段可返回 |
| questions | QuestionItem[] \| null | 多题结构；服务端 WebSocket `onmessage` 新增字段，`running` 阶段可返回 |
| questionId | string \| null | 问题 ID；服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId` |
| status | string \| null | question 状态：`running` / `completed` / `error` |
| toolName | string \| null | 工具名 |
| toolCallId | string \| null | 工具调用 ID |
| output | string \| null | `completed` 阶段返回的输出 |

> 说明：
> - `question` 事件分为两阶段：`running` 阶段返回 `header` / `question` / `options` / `questions` / `questionId`，`completed` 或 `error` 阶段前端应按 `partId` 关联此前的 question 状态展示。服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId`。
> - `permission.reply` 为极简事件，客户端应主要按 `permissionId` 匹配原始权限请求。

#### StreamMessage 的 Subagent 扩展字段

> 以下字段均为可选；仅出现在 Part 级事件，以及 `snapshot.messages[].parts[]` 和 `streaming.parts[]` 中。`session.status`、`session.title`、`session.error`、`agent.online`、`agent.offline`、`error`、`message.user` 等会话级事件不携带这些字段。

| 字段 | 类型 | 说明 |
|------|------|------|
| subagentSessionId | string \| null | 子 agent 的真实会话 ID，建议客户端作为子任务分组主键 |
| subagentName | string \| null | 子 agent 显示名；若存在嵌套层级，使用 `" > "` 作为路径分隔符 |

#### `snapshot` 事件字段（`type = snapshot`）

| 字段 | 类型 | 说明 |
|------|------|------|
| messages | array | 已完成消息快照列表（必返，可能为空数组） |
| messages[].id | string | 稳定消息 ID |
| messages[].welinkSessionId | string | 所属会话 ID |
| messages[].seq | number \| null | 数据库排序序号，用户消息可能为 `null` |
| messages[].messageSeq | number \| null | 会话内消息序号，由 OpenCode 分配 |
| messages[].role | string | 当前服务端返回值为 `user` / `assistant` |
| messages[].content | string \| null | 消息内容 |
| messages[].contentType | string \| null | `plain` / `markdown` |
| messages[].createdAt | string | 创建时间，ISO-8601 |
| messages[].meta | object \| null | 元信息（可选） |
| messages[].parts | array | Part 列表（可选） |

> 说明：若 `messages[].parts[]` 中存在 `subagentSessionId`，表示该 Part 属于某个子 agent；客户端恢复快照时应按 `subagentSessionId` 重新分组展示，而不是简单平铺到主消息流。
> 恢复场景下，服务端会先推送 `snapshot`，再推送 `streaming`；客户端不应在完整 `snapshot` 到达前按零散增量恢复界面。

#### `streaming` 事件字段（`type = streaming`）

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionStatus | string | `busy` / `idle` |
| parts | array | 进行中消息部件列表（必返，空闲时为空数组） |
| messageId | string \| null | 当前进行中消息稳定 ID（仅 `parts` 非空时出现） |
| messageSeq | number \| null | 当前进行中消息顺序（仅 `parts` 非空时出现） |
| role | string \| null | 当前服务端返回值为 `user` / `assistant`（仅 `parts` 非空时出现） |
| parts[].partId | string | Part 唯一 ID |
| parts[].partSeq | number | Part 在消息内的顺序 |
| parts[].type | string | `text` / `thinking` / `tool` / `question` / `permission` / `file` |
| parts[].content | string | 文本内容（可选） |
| parts[].toolName | string | 工具名（可选） |
| parts[].toolCallId | string | 工具调用 ID（可选） |
| parts[].status | string | 工具状态（可选） |
| parts[].input | object | 工具/问题输入参数（可选） |
| parts[].output | string | 工具输出（可选） |
| parts[].error | string | 工具错误信息（可选） |
| parts[].title | string | 工具或权限标题（可选） |
| parts[].header | string | question 分组标题（可选） |
| parts[].question | string | question 正文（可选） |
| parts[].options | string[] | question 选项（可选） |
| parts[].questions | QuestionItem[] | question 多题结构（可选） |
| parts[].permissionId | string | 权限请求 ID（可选） |
| parts[].permType | string | 权限类型（可选） |
| parts[].metadata | object | 权限元数据（可选） |
| parts[].response | string | 权限回复（可选） |
| parts[].fileName | string | 文件名（可选） |
| parts[].fileUrl | string | 文件 URL（可选） |
| parts[].fileMime | string | 文件 MIME 类型（可选） |

> 说明：`streaming.parts[]` 同样可能携带 `subagentSessionId` / `subagentName`；断线恢复补流时建议继续按子 agent 维度聚合当前进行中的 Part。
> 当 `streaming.sessionStatus = idle` 时，客户端应将当前所有 streaming part 视为已完成，避免残留流式展示状态。

#### 支持的事件类型

| type | 说明 | 关键附加字段 |
|------|------|--------------|
| `text.delta` | AI 文本增量 | `content` |
| `text.done` | AI 文本完成 | `content` |
| `thinking.delta` | 思维链增量 | `content` |
| `thinking.done` | 思维链完成 | `content` |
| `tool.update` | 工具调用状态更新 | `toolName` `toolCallId` `status` `input` `output` `error` `title` |
| `question` | AI 提问交互 | `toolName` `toolCallId` `status` `header` `question` `options` `questions` |
| `file` | 文件或图片附件 | `fileName` `fileUrl` `fileMime` |
| `step.start` | 推理步骤开始 | 无额外必填字段 |
| `step.done` | 推理步骤结束 | `tokens` `cost` `reason` |
| `session.status` | 会话状态变化 | `sessionStatus` |
| `session.title` | 会话标题变化 | `title` |
| `session.error` | 会话级错误 | `error` |
| `message.user` | 用户消息回放 | `content` `messageId` `messageSeq` `role` |
| `permission.ask` | 权限请求 | `permissionId` `permType` `title` `metadata` |
| `permission.reply` | 权限响应结果 | `permissionId` `response` |
| `agent.online` | Agent 上线 | 无额外字段 |
| `agent.offline` | Agent 下线 | 无额外字段；前端建议去重处理，并在首次收到时结束生成态、展示错误消息 `agent已离线` |
| `error` | 非会话级错误 | `error` |
| `snapshot` | 断线恢复快照 | `messages` |
| `streaming` | 断线恢复中的进行中消息 | `sessionStatus` `messageId` `messageSeq` `role` `parts` |
| `planning.delta` | 规划增量（云端扩展） | `content` |
| `planning.done` | 规划完成（云端扩展） | `content` |
| `searching` | 搜索中（云端扩展） | `keywords` |
| `search_result` | 搜索结果（云端扩展） | `searchResults` |
| `reference` | 引用列表（云端扩展） | `references` |
| `ask_more` | 追问建议（云端扩展） | `askMoreQuestions` |

#### Subagent 事件处理约定

1. SDK 监听器仍然只监听主会话 `welinkSessionId`，子 agent 相关事件不会额外开启独立通道。
2. 当事件、`snapshot.messages[].parts[]` 或 `streaming.parts[]` 中存在 `subagentSessionId` 时，表示该内容属于对应子 agent 上下文。
3. `text` / `thinking` / `tool` / `file` 等内容建议按 `subagentSessionId` 聚合成独立子任务块展示，而不是直接混排到主会话正文。
4. `permission.ask` 与 `question` 可以在主界面中承载交互，但客户端回复时必须透传原始 `subagentSessionId`，否则服务端无法路由到真实子会话。
5. 处理 `snapshot` 与 `streaming` 断线恢复数据时，也应延续同样的分组规则，避免恢复后子任务内容错挂到主消息。
6. 客户端必须以 `subagentSessionId` 作为聚合主键，`subagentName` 仅用于展示，不能作为唯一 key。
7. 若 `subagentName` 存在嵌套层级，应保留服务端约定的 `" > "` 路径分隔符，不要替换为 `/`、`->` 等其他符号。

#### Subagent 事件示例

`tool.update`（子 agent 任务执行中）：

```json
{
  "type": "tool.update",
  "welinkSessionId": "parent-session-001",
  "messageId": "msg_1001",
  "partId": "part_task_1",
  "toolName": "task",
  "status": "running",
  "subagentSessionId": "child-session-001",
  "subagentName": "代码审查 > 设计"
}
```

`permission.ask`（子 agent 发起权限确认）：

```json
{
  "type": "permission.ask",
  "welinkSessionId": "parent-session-001",
  "messageId": "msg_1001",
  "partId": "perm_1",
  "permissionId": "perm_xxx",
  "permType": "file_write",
  "title": "Request to modify src/auth/login.ts",
  "subagentSessionId": "child-session-001",
  "subagentName": "代码审查"
}
```

#### 常用附加字段

> 说明：以下字段均按事件类型按需返回，非必返；当服务端值为 `null` 时可能省略。

| 字段 | 类型 | 说明 |
|------|------|------|
| content | string \| null | 文本内容或最终完整内容（按事件可选） |
| toolName | string \| null | 工具名称 |
| toolCallId | string \| null | 工具调用 ID |
| status | string \| null | 工具状态或问题运行状态 |
| input | object \| null | 工具输入参数 |
| output | string \| null | 工具输出结果 |
| error | string \| null | 错误描述 |
| title | string \| null | 工具标题或会话标题 |
| header | string \| null | 问题分组标题 |
| question | string \| null | 问题正文 |
| options | string[] \| null | 问题预设选项 |
| fileName | string \| null | 文件名 |
| fileUrl | string \| null | 文件访问 URL |
| fileMime | string \| null | MIME 类型 |
| tokens | object \| null | token 使用统计 |
| cost | number \| null | 本步骤费用 |
| reason | string \| null | 结束原因 |
| sessionStatus | string \| null | 服务端原始状态：`busy` / `idle` / `retry` |
| permissionId | string \| null | 权限请求 ID |
| permType | string \| null | 权限类型 |
| metadata | object \| null | 权限请求详情 |
| response | string \| null | 权限回复值：`once` / `always` / `reject` |
| messages | array \| null | `snapshot` 携带的已完成消息快照，元素结构见上文 `snapshot` 事件字段 |
| parts | array \| null | `streaming` 携带的进行中消息部件，元素结构见上文 `streaming` 事件字段 |

### SendMessageResult

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 消息 ID |
| welinkSessionId | string | 所属会话 ID |
| seq | number \| null | 数据库排序序号，用户消息可能为 `null` |
| messageSeq | number \| null | 会话内消息序号，由 OpenCode 分配 |
| role | string | 当前服务端返回值为 `user` / `assistant` |
| content | string \| null | 消息内容 |
| contentType | string \| null | 内容类型：`plain` / `markdown` |
| createdAt | string | 创建时间，ISO-8601 |
| meta | object \| null | 元信息对象（tokens、cost 等） |
| parts | Array<SessionMessagePart> \| null | 消息 Part 列表 |

### StopSkillResult

| 字段 | 类型 | 说明 |
|------|------|------|
| welinkSessionId | string | 会话 ID |
| status | string | 中止结果，成功时为 `aborted` |

### RegisterSessionListenerResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 操作结果，固定为 `success` |

### UnregisterSessionListenerResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 操作结果，固定为 `success` |

### CloseSkillResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 关闭结果：`success` / `failed` |

### ReplyPermissionResult

| 字段 | 类型 | 说明 |
|------|------|------|
| welinkSessionId | string | 会话 ID |
| permissionId | string | 权限请求 ID |
| response | string | 回复值 |

### ControlSkillWeCodeResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 操作状态：`success` / `failed` |

### SendMessageToIMResult

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 发送是否成功（服务端字段） |

### Session
```typescript
interface Session {
  welinkSessionId: string;       // welinkSessionId（Snowflake ID，字符串化）
  userId?: string;               // 会话所有者
  ak?: string;                   // Agent Key
  title: string;                 // 会话标题
  businessSessionDomain: string; // 会话关联场域
  businessSessionType: string;   // 会话类型
  businessSessionId: string;     // 对话所属id，单聊为用户Id，群聊为群Id
  assistantAccount: string;      // 分身账号id
  status: 'ACTIVE' | 'IDLE' | 'CLOSED';
  toolSessionId?: string;        // OpenCode 侧会话 ID（可能未就绪）
  createdAt: string;             // ISO 时间戳
  updatedAt: string;
}
```
