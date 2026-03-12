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

---

## 1. 创建会话接口

### 调用方

IM 客户端调用

### 接口说明

创建 Skill 会话，建立 SDK 与 Skill 服务端之间的 WebSocket 长连接。支持基于 `imGroupId` 一个群可以创建多个会话。

### 接口名

```typescript
createSession(params: CreateSessionParams): Promise<SkillSession>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ak | String | 是 | Agent Plugin 对应的 Access Key，用于定位 Agent 连接 |
| title | String | 否 | 会话标题，不填则由 AI 自动生成 |
| imGroupId | String | 是 | 关联的 IM 群组 ID |

### 入参示例

```json
{
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "imGroupId": "group_abc123"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `welinkSessionId` | number | 会话 ID |
| `userId` | String | 用户 ID（从 Cookie 解析） |
| `ak` | String | Access Key |
| `title` | String | 会话标题 |
| `imGroupId` | String | IM 群组 ID |
| `status` | String | 会话状态：`ACTIVE` |
| `toolSessionId` | String | OpenCode Session ID，创建时可为 `null`，后续异步填充 |
| `createdAt` | String | 创建时间，ISO-8601 |
| `updatedAt` | String | 更新时间，ISO-8601 |

### 出参示例

```json
{
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
```

### 实现方法

1. 建立 WebSocket 连接，若当前用户已有连接则复用，否则新建：
   - **URL**: `ws://host/ws/skill/stream`
   - 用于接收服务端推送的完整事件流
2. 调用服务端 REST API 查询会话列表，根据 `imGroupId` 查询活跃会话：
   - **URL**: `GET /api/skill/sessions`
   - **查询参数**:
     ```json
     {
       "imGroupId": "group_abc123",
       "status": "ACTIVE"
     }
     ```
3. 若不存在活跃会话，则调用 `POST /api/skill/sessions` 新建会话：
   - **请求体**:
     ```json
     {
       "ak": "ak_xxxxxxxx",
       "title": "帮我创建一个React项目",
       "imGroupId": "group_abc123"
     }
     ```
4. 建连后，当前 `welinkSessionId` 已注册的监听器可收到后续消息
5. 若监听器先于 `createSession` 注册，则先暂存，待连接建立后自动生效
6. `createSession` 只负责创建会话和建立连接，不发送消息；发送消息需要调用 `sendMessage` 接口

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少必填参数或参数格式错误 |
| 6000 | 网络错误 | WebSocket 连接失败或网络请求失败 |
| 7000 | 服务端错误 | 服务端创建会话失败 |
| 2000 | Agent 离线 | 对应的 Agent 未在线 |
| 2001 | 超出速率限制 | 短时间内创建会话过于频繁 |

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
    imGroupId: "group_abc123"
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
| `welinkSessionId` | number | 是 | 会话 ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `welinkSessionId` | number | 会话 ID |
| `status` | string | 中止结果，成功时为 `aborted` |

### 出参示例

```json
{
  "welinkSessionId": 42,
  "status": "aborted"
}
```

### 实现方法

1. 调用服务端 REST API：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/abort`
2. SDK收到成功响应后，触发 `onSessionStatusChange` 的 `stopped` 状态

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4001 | 会话已关闭 | 会话已被关闭，无法停止 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `stopSkill` 失败，不影响会话的其他操作
2. 停止后，仍可以继续发送新消息触发新一轮 AI 执行

### 调用示例

```typescript
try {
  const result = await stopSkill({ welinkSessionId: 42 });

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

监听会话状态变更。该接口是对通用 `registerSessionListener` 的二次封装，供 Mini Bar 或会话状态 UI 直接消费。

**重要说明**：

- 调用该接口**不会创建** WebSocket 连接
- 该接口依赖已建立的 WebSocket 连接
- 服务端原始状态为 `busy / idle / retry`
- 客户端 SDK 继续向上层暴露 `executing / stopped / completed` 三态
- 发送消息后，SDK 仅通过 WebSocket `onmessage` 报文中的 `session.status` 判断会话状态
- 当 `session.status=busy` 或 `session.status=retry` 时，返回 `executing`
- 当 `session.status=idle` 时，返回 `completed`
- 调用 `stopSkill()` 成功后，触发 `onSessionStatusChange` 的 `stopped` 状态
- 当重新执行 `sendMessage` 后，若 WebSocket 再次返回 `session.status=busy/retry`，再返回 `executing`

### 接口名

```typescript
onSessionStatusChange(params: OnSessionStatusChangeParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| callback | function | 是 | 状态变更回调函数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | SessionStatus | 会话状态：`executing` / `stopped` / `completed` |

### 状态映射

| WebSocket 消息 `type` / 触发 | 附加条件 | SDK 状态 | 说明 |
|-----------------------------|----------|----------|------|
| `session.status` | `sessionStatus = busy` 或 `retry`（在 `sendMessage` 之后收到） | `executing` | 发送消息后会话处理中或重试中 |
| `session.status` | `sessionStatus = idle` | `completed` | 会话回到空闲，表示当前轮完成 |
| SDK 本地触发 | 调用 `stopSkill()` 成功 | `stopped` | 触发 `onSessionStatusChange` 的 `stopped` 状态 |

### 补充说明

- `session.title` 暂不参与状态映射
- 仅 `session.status` 参与状态映射，其他流式事件（如 `text.delta`、`tool.update`、`step.done` 等）不改变状态
- `stopSkill()` 成功触发 `stopped` 后，状态不会自动回到 `executing`
- 只有重新执行 `sendMessage`，且后续收到 `session.status=busy/retry` 时，才再次回到 `executing`

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` 或 `callback` |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 3000 | 未建立连接 | WebSocket 连接未建立 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `onSessionStatusChange` 注册失败，不影响其他接口的调用
2. 建议在 `createSession` 成功后再注册回调，确保能接收到完整的状态变更

### 调用示例

```typescript
try {
  onSessionStatusChange({
    welinkSessionId: 42,
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
onSkillWecodeStatusChange(params: OnSkillWecodeStatusChangeParams): void
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
  onSkillWecodeStatusChange({
    callback: (result) => {
      switch (result.status) {
        case SkillWecodeStatus.CLOSED:
          console.log("小程序已关闭");
          break;
        case SkillWecodeStatus.MINIMIZED:
          console.log("小程序已最小化");
          break;
      }
    }
  });
} catch (error) {
  console.error("注册小程序状态回调失败:", error.errorCode, error.errorMessage);
}
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
| `welinkSessionId` | number | 是 | 会话 ID |

### 出参

与 `sendMessage` 返回保持一致：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 消息 ID |
| `welinkSessionId` | number | 所属会话 ID |
| `userId` | String | 发送用户 ID |
| `role` | String | 固定为 `"user"` |
| `content` | String | 重发的消息内容 |
| `messageSeq` | number | 该消息在会话内的顺序号 |
| `createdAt` | String | 创建时间，ISO-8601 |

### 实现方法

1. 根据 `welinkSessionId` 找到最后一条用户消息
2. 若 SDK 本地已缓存用户消息，则优先复用本地缓存
3. 若本地缓存不存在，可先从历史消息中定位最后一条 `role=user` 的消息
4. 调用服务端 REST API：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "{最后一条用户消息内容}"
     }
     ```
5. 通过 WebSocket 继续接收本轮新的流式回答

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
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
    welinkSessionId: 42
  });

  console.log("重新生成已启动，消息ID:", result.id);
} catch (error) {
  console.error("重新生成失败:", error.errorCode, error.errorMessage);
}
```

---

## 7. 发送 AI 生成消息结果接口
### 调用方

IM 客户端、we码调用
### 接口说明

将用户在 Skill 小程序中最终确认的文本内容发送到 IM 聊天，用于"选中文本发送到聊天"场景。

SDK 内部维护消息缓存，记录每条消息完成后的最终内容。调用此接口时，SDK 从缓存中获取消息的最终完整文本，然后发送到 IM。

**重要说明**：

- SDK 会记录每条消息完成后的最终消息内容
- 调用此接口时：
  - 若提供 `messageId`，则获取对应消息的最终内容
  - 若不提供 `messageId`，则获取当前会话最后一条最终消息的内容
- 服务端 `send-to-im` REST 接口已定义；SDK 负责从本地缓存组装请求内容并发起调用

### 接口名

```typescript
sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| messageId | string | 否 | 要发送到 IM 的消息 ID，SDK 会从缓存中获取该消息的最终完整内容。不填则获取当前会话最后一条最终消息的内容 |
| chatId | string | 否 | 目标 IM 群组 ID。SDK 仅透传给服务端，不做会话 `imGroupId` 到 `chatId` 的映射 |

> 说明：`chatId` 为可选入参并对外暴露。SDK 不会从当前会话 `imGroupId` 自动获取 `chatId`，仅按入参透传给服务端。

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 发送结果：`success` / `failed` |

### 出参示例

```json
{
  "status": "success"
}
```

### 实现方法

1. SDK 内部维护消息缓存，记录每条消息完成后的最终内容：
   - 监听 `text.done` / `thinking.done` 事件，落定最终内容
   - 按 `welinkSessionId + messageStableId` 存储消息的最终聚合文本（`messageStableId` 来源于 `messageId` 或 `snapshot.messages[].id`）
   - 同时维护每个会话的消息顺序，以便获取最后一条消息
   - 缓存结构与 `getSessionMessage` 共享，确保数据一致性
2. 调用 `sendMessageToIM` 时：
   - 若提供 `messageId`：根据 `welinkSessionId` 和 `messageId` 从 SDK 缓存中获取该消息的最终完整内容
   - 若未提供 `messageId`：获取当前会话最后一条最终消息的内容
   - 若缓存中不存在对应消息的最终内容，返回错误
   - `messageId` 仅用于 SDK 本地缓存定位，不会透传到服务端请求体
3. SDK 调用 Skill 服务端“发送到 IM”接口时，会传入：
   - `content`：从 SDK 缓存中获取的最终内容
   - `chatId`：若入参提供则原样透传；若未提供则不由 SDK 补齐，按服务端接口规则处理
调用服务端 REST API 发送消息到 IM：
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
    "success": true,
    "chatId": "chat-789",
    "contentLength": 22
  }
  ```

### 缓存管理

#### 缓存键设计

| 键 | 说明 |
|---|---|
| `welinkSessionId` | 会话 ID |
| `messageStableId` | 稳定消息 ID（`messageId` 或 `snapshot.messages[].id`） |

#### 缓存更新时机

| 事件类型 | 缓存操作 |
|---------|---------|
| `text.delta` | 追加临时缓存，用于实时预览 |
| `text.done` | 落定最终内容，更新缓存为最终状态 |
| `thinking.done` | 可选：是否计入最终文本由上层决定 |
| `step.done` | 标记当前步骤完成，缓存已就绪 |
| `streaming` | 用于断线重连时恢复缓存状态 |

### 最终完整内容获取机制

#### 从缓存获取最终完整内容的流程

1. **定位消息**：根据 `welinkSessionId` 和稳定消息 ID（`messageId` 或 `snapshot.messages[].id`）定位缓存中的消息
2. **检查完整性**：验证消息是否已标记为 `isCompleted`
3. **内容聚合**：
   - 对于文本类型的消息，使用 `text.done` 事件中的最终完整内容
   - 对于包含多个 part 的消息，按 `partSeq` 顺序聚合所有 part 的内容
   - 对于工具调用等非文本消息，根据业务需求决定是否包含其结果
4. **返回内容**：返回聚合后的最终完整内容

#### 缓存一致性保证

- **实时更新**：当 WebSocket 收到 `text.delta` 等增量消息时，实时更新缓存
- **最终确认**：当收到 `text.done` 等完成消息时，更新为最终状态
- **顺序保证**：按 `messageSeq` 维护消息顺序，确保获取最后一条消息时的正确性
- **断线恢复**：通过 `snapshot` 和 `streaming` 事件恢复缓存状态，确保数据不丢失

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4003 | 消息不存在 | 请求的消息在缓存中不存在 |
| 4004 | 消息未完成 | 请求的消息尚未收到完成事件 |
| 4005 | 无最终消息 | 会话中没有已完成的消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在 `getSessionMessage` 获取消息后再调用 `sendMessageToIM`，确保消息已完成
2. 若 `sendMessageToIM` 失败，可重试发送，但需注意避免重复发送

### 调用示例

#### 示例 1：指定消息 ID

```typescript
try {
  const result = await sendMessageToIM({
    welinkSessionId: 42,
    messageId: "m_2",
    chatId: "group_abc123"
  });

  if (result.status === "success") {
    console.log("发送到 IM 成功:", result.chatId);
    console.log("内容长度:", result.contentLength);
  }
} catch (error) {
  console.error("发送到 IM 失败:", error.errorCode, error.errorMessage);
  // 可能原因：消息尚未完成、缓存不存在、网络错误等
}
```

#### 示例 2：使用最后一条消息

```typescript
try {
  const result = await sendMessageToIM({
    welinkSessionId: 42,
    // 不提供 messageId，使用最后一条最终消息
    // 不提供 chatId，按服务端接口规则处理
  });

  if (result.status === "success") {
    console.log("发送到 IM 成功:", result.chatId);
    console.log("内容长度:", result.contentLength);
  }
} catch (error) {
  console.error("发送到 IM 失败:", error.errorCode, error.errorMessage);
  // 可能原因：无消息缓存、网络错误等
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

### 接口名

```typescript
getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<SessionMessage>>
```

### 入参

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| welinkSessionId | number | 是 | - | 会话 ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<SessionMessage> | 历史消息列表 |
| page | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |
| total | number | 总记录数 |

### 实现方法

#### 1. 获取历史消息

调用服务端 REST API：

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
- `snapshot`：恢复已完成消息；其中 `messages[].id` 为 String 稳定消息 ID，`messages[].seq` 映射为 `messageSeq`
- `streaming`：恢复进行中消息；其中 `parts[].status` 对应工具状态字段

#### 4. 返回结果

调用 `getSessionMessage` 时，SDK 执行以下步骤：

1. 获取服务端历史消息
2. 获取本地流式缓存中的所有消息，包括：
   - 已完成的消息（`text.done` / `thinking.done` 标记的）
   - 进行中的消息（仅通过 `text.delta` 等增量事件接收的）
3. 对同一稳定消息 ID（`messageId` 或 `snapshot.messages[].id`）做去重和合并，确保消息的完整性和一致性
4. 按 `messageSeq` 排序，确保消息顺序正确
5. 若当前存在未持久化的进行中消息，将其追加到返回列表
6. 处理分页逻辑，确保返回指定页的消息

### 缓存实现细节

#### 缓存结构

```typescript
// 缓存结构示例
interface MessageCache {
  [welinkSessionId: string]: {
    messages: {
      [messageStableId: string]: {
        id: number | string;
        messageSeq: number;
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
    messageSeqOrder: string[]; // 按 messageSeq 排序的稳定消息 ID 列表
  };
}
```

#### 实时消息处理

当 WebSocket 连接已建立并持续返回消息时：
1. SDK 实时接收并解析 WebSocket 消息
2. 根据消息类型更新本地缓存
3. 对于增量消息（如 `text.delta`），实时更新缓存中的内容
4. 对于完成消息（如 `text.done`），标记消息为已完成并更新最终内容
5. 当调用 `getSessionMessage` 时，SDK 会将这些实时消息与历史消息合并后返回

#### 数据一致性保证

- **去重机制**：通过稳定消息 ID（`messageId` 或 `snapshot.messages[].id`）确保消息不重复
- **顺序保证**：通过 `messageSeq` 确保消息顺序正确
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
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
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
    welinkSessionId: 42,
    page: 0,
    size: 50
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
- 会话状态：`session.status` / `session.title` / `session.error`
- 断线恢复：`snapshot` / `streaming`
- 系统事件：`agent.online` / `agent.offline` / `error`

#### 字段对齐说明（重要）

- `snapshot.messages[].id` 类型为 `string`（稳定消息 ID）
- `snapshot.messages[].seq` 类型为 `number`（消息顺序，语义对应 `messageSeq`）
- `snapshot.messages[].contentType` 类型为 `string`（`plain` / `markdown` / `code`）
- `streaming.messageId` 类型为 `string`
- `streaming.parts[].status` 为工具状态字段（字段名为 `status`）
- `session.status` / `session.title` / `session.error` / `agent.online` / `agent.offline` / `error` 属于传输层事件，不应作为 `SessionMessage` 聚合入消息列表

### 接口名

```typescript
registerSessionListener(params: RegisterSessionListenerParams): RegisterSessionListenerResult
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
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
3. 若 WebSocket 已建立，则监听器立即生效
4. 若 WebSocket 尚未建立，则监听器先暂存，待连接建立后自动生效
5. 连接错误时触发 `onError`
6. 连接关闭时触发 `onClose`

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` 或 `onMessage` |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在 `createSession` 成功后再注册监听器，确保能接收到完整的消息流
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
      case "tool.update":
        console.log("工具状态:", message.toolName, message.status);
        break;
      case "question":
        console.log("AI提问:", message.question);
        break;
      case "permission.ask":
        console.log("权限请求:", message.permissionId, message.title);
        break;
      case "session.status":
        console.log("原始会话状态:", message.sessionStatus);
        break;
      case "snapshot":
        console.log("收到断线恢复快照，消息数:", message.messages.length);
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
    welinkSessionId: 42,
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
| welinkSessionId | number | 是 | 会话 ID |

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
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在组件卸载时调用 `unregisterSessionListener`，避免内存泄漏
2. 若 `unregisterSessionListener` 失败，不影响其他接口的调用

### 调用示例

```typescript
try {
  onUnmounted(() => {
    unregisterSessionListener({
      welinkSessionId: 42
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
| welinkSessionId | number | 是 | 会话 ID |
| content | string | 是 | 用户输入的消息内容 |
| toolCallId | string | 否 | 回答 AI `question` 时携带对应的工具调用 ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 消息 ID |
| `welinkSessionId` | number | 所属会话 ID |
| `userId` | String | 发送用户 ID |
| `role` | String | 固定为 `"user"` |
| `content` | String | 消息内容 |
| `messageSeq` | number | 该消息在会话内的顺序号 |
| `createdAt` | String | 创建时间，ISO-8601 |

### 实现方法

1. 检查 WebSocket 连接状态，若未建立则自动建立：
   - **URL**: `ws://host/ws/skill/stream`
   - 用于接收服务端推送的完整事件流
2. 调用服务端 REST API 发送消息：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "请帮我重构登录模块的校验逻辑",
       "toolCallId": "call_2"
     }
     ```
3. AI 流式响应由 WebSocket 推送到 SDK，再通过监听器分发
4. 对于首次发送消息的场景，此接口会触发首轮 AI 执行

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 或 `content` 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4001 | 会话已关闭 | 会话已被关闭，无法发送消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |
| 7001 | AI 网关错误 | AI-Gateway 调度失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 若 `sendMessage` 失败，不影响会话的其他操作
2. 建议在 `createSession` 成功后再调用 `sendMessage`，确保能正常发送消息
3. 发送消息后，应注册 `registerSessionListener` 来接收 AI 的响应

### 调用示例

#### 示例 1：首次发送消息（创建会话后）

```typescript
try {
  // 先创建会话
  const session = await createSession({
    ak: "ak_xxxxxxxx",
    title: "帮我创建一个React项目",
    imGroupId: "group_abc123"
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
    welinkSessionId: 42,
    content: "请帮我重构登录模块的校验逻辑"
  });

  console.log("消息发送成功:", result.id);
  console.log("创建时间:", result.createdAt);
} catch (error) {
  console.error("发送消息失败:", error.errorCode, error.errorMessage);
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
| `welinkSessionId` | number | 是 | 会话 ID |
| `permId` | String | 是 | 权限请求 ID |
| `response` | String | 是 | `once` / `always` / `reject` |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `welinkSessionId` | number | 会话 ID |
| `permissionId` | String | 权限请求 ID |
| `response` | String | 回复值 |

### 实现方法

调用服务端 REST API：

- **URL**: `POST /api/skill/sessions/{welinkSessionId}/permissions/{permId}`
- **请求体**:
  ```json
  {
    "response": "once"
  }
  ```

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId`、`permId` 或 `response` 无效 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4007 | 权限请求不存在 | 指定的权限请求 ID 不存在 |
| 4008 | 权限请求已过期 | 权限请求已超时或已处理 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 组合调用场景

在与其他接口组合调用时：
1. 建议在收到 `permission.ask` 事件后再调用 `replyPermission`，确保权限请求有效
2. 若 `replyPermission` 失败，可重试发送，但需注意避免重复处理

### 调用示例

```typescript
try {
  const result = await replyPermission({
    welinkSessionId: 42,
    permId: "perm_1",
    response: "once"
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

## 数据类型定义

> 说明：
> - 以下类型以客户端 SDK 对外契约为准
> - `StreamMessage` 与服务端 WebSocket 事件模型保持对齐
> - 本文档仅修订客户端契约；未在服务端文档中补齐的接口，仍需后续与服务端统一

### SkillSession

| 字段 | 类型 | 说明 |
|------|------|------|
| welinkSessionId | number | 会话 ID |
| userId | string | 用户 ID |
| ak | string | Access Key |
| title | string | 会话标题 |
| imGroupId | string | IM 群组 ID |
| status | string | 会话状态 |
| toolSessionId | string \| null | OpenCode Session ID |
| createdAt | string | 创建时间，ISO-8601 |
| updatedAt | string | 更新时间，ISO-8601 |

### CreateSessionParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ak | String | 是 | Agent Plugin 对应的 Access Key |
| title | String | 否 | 会话标题 |
| imGroupId | String | 是 | 关联的 IM 群组 ID |

### StopSkillParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 要停止的会话 ID |

### RegenerateAnswerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 需要重新生成的会话 ID |

### OnSessionStatusChangeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| callback | function | 是 | 状态变更回调函数 |

### OnSkillWecodeStatusChangeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| callback | function | 是 | 小程序状态变更回调函数 |

### GetSessionMessageParams

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| welinkSessionId | number | 是 | - | 会话 ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |

### RegisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| onMessage | function | 是 | 接收 `StreamMessage` 的回调 |
| onError | function | 否 | 错误回调 |
| onClose | function | 否 | 连接关闭回调 |

> 约束：同一个 `welinkSessionId` 只允许注册一次；重复注册不做任何处理并返回 `status: success`。

### UnregisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |

### SendMessageParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| content | string | 是 | 用户输入的消息内容 |
| toolCallId | string | 否 | 回答 AI `question` 时携带的工具调用 ID |

### ReplyPermissionParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| permId | string | 是 | 权限请求 ID |
| response | string | 是 | `once` / `always` / `reject` |

### ControlSkillWeCodeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | SkillWeCodeAction | 是 | 操作类型：`close` / `minimize` |

### SendMessageToIMParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| messageId | string | 否 | 要发送到 IM 的消息 ID，SDK 会从缓存中获取该消息的最终完整内容。不填则获取当前会话最后一条最终消息的内容 |
| chatId | string | 否 | 目标 IM 群组 ID。SDK 仅透传给服务端，不做会话 `imGroupId` 到 `chatId` 的映射 |

> 说明：`chatId` 为可选入参并对外暴露。SDK 不会从当前会话 `imGroupId` 自动获取 `chatId`，仅按入参透传给服务端。

### SessionListener

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

### SessionMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number \| string | 消息 ID（历史消息通常为 `number`；断线恢复/流式聚合场景可为 `string` 稳定消息 ID） |
| welinkSessionId | number | 所属会话 ID |
| userId | string \| null | 用户 ID |
| role | string | `user` / `assistant` / `system` / `tool` |
| content | string | 聚合后的消息内容 |
| messageSeq | number | 会话内消息顺序 |
| parts | Array<SessionMessagePart> | 消息部件列表 |
| createdAt | string | 创建时间，ISO-8601 |

### SessionMessagePart

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string | Part 唯一 ID |
| partSeq | number | Part 在消息内的顺序 |
| type | string | `text` / `thinking` / `tool` / `question` / `permission` / `file` |
| content | string | 文本内容 |
| toolName | string | 工具名 |
| toolCallId | string | 工具调用 ID |
| toolStatus | string | 工具状态（对应 WebSocket `status` 字段） |
| toolInput | object | 工具输入 |
| toolOutput | string | 工具输出 |
| question | string | 问题正文 |
| options | string[] | 问题选项 |
| permissionId | string | 权限请求 ID |
| fileName | string | 文件名 |
| fileUrl | string | 文件 URL |
| fileMime | string | 文件 MIME 类型 |

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

#### 公共字段

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 事件类型 |
| seq | number | 递增序列号 |
| welinkSessionId | string | 所属会话 ID |
| emittedAt | string | 事件产生时间，ISO-8601 |
| raw | object | 原始 OpenCode 事件，仅调试用 |

#### 消息级字段

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | string | 稳定消息 ID |
| messageSeq | number | 会话内消息顺序 |
| role | string | `user` / `assistant` / `system` / `tool` |

#### Part级字段

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string | Part 唯一 ID |
| partSeq | number | Part 在消息内的顺序 |

#### `snapshot` 事件字段（`type = snapshot`）

| 字段 | 类型 | 说明 |
|------|------|------|
| messages[].id | string | 稳定消息 ID |
| messages[].seq | number | 消息顺序（语义对应 `messageSeq`） |
| messages[].role | string | `user` / `assistant` / `system` / `tool` |
| messages[].content | string | 消息内容 |
| messages[].contentType | string | `plain` / `markdown` / `code` |
| messages[].createdAt | string | 创建时间，ISO-8601（可选） |
| messages[].parts | array | Part 列表（可选） |

#### `streaming` 事件字段（`type = streaming`）

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionStatus | string | `busy` / `idle` |
| messageId | string | 当前进行中消息稳定 ID |
| messageSeq | number | 当前进行中消息顺序 |
| role | string | `user` / `assistant` / `system` / `tool` |
| parts[].partId | string | Part 唯一 ID |
| parts[].partSeq | number | Part 在消息内的顺序（可选） |
| parts[].type | string | `text` / `thinking` / `tool` / `question` / `permission` / `file` |
| parts[].content | string | 文本内容（可选） |
| parts[].toolName | string | 工具名（可选） |
| parts[].toolCallId | string | 工具调用 ID（可选） |
| parts[].status | string | 工具状态（可选） |
| parts[].header | string | question 分组标题（可选） |
| parts[].question | string | question 正文（可选） |
| parts[].options | string[] | question 选项（可选） |
| parts[].fileName | string | 文件名（可选） |
| parts[].fileUrl | string | 文件 URL（可选） |
| parts[].fileMime | string | 文件 MIME 类型（可选） |

#### 支持的事件类型

| type | 说明 | 关键附加字段 |
|------|------|--------------|
| `text.delta` | AI 文本增量 | `content` |
| `text.done` | AI 文本完成 | `content` |
| `thinking.delta` | 思维链增量 | `content` |
| `thinking.done` | 思维链完成 | `content` |
| `tool.update` | 工具调用状态更新 | `toolName` `toolCallId` `status` `input` `output` `error` `title` |
| `question` | AI 提问交互 | `toolName` `toolCallId` `status` `header` `question` `options` |
| `file` | 文件或图片附件 | `fileName` `fileUrl` `fileMime` |
| `step.start` | 推理步骤开始 | 无额外必填字段 |
| `step.done` | 推理步骤结束 | `tokens` `cost` `reason` |
| `session.status` | 会话状态变化 | `sessionStatus` |
| `session.title` | 会话标题变化 | `title` |
| `session.error` | 会话级错误 | `error` |
| `permission.ask` | 权限请求 | `permissionId` `permType` `title` `metadata` |
| `permission.reply` | 权限响应结果 | `permissionId` `response` |
| `agent.online` | Agent 上线 | 无额外字段 |
| `agent.offline` | Agent 下线 | 无额外字段 |
| `error` | 非会话级错误 | `error` |
| `snapshot` | 断线恢复快照 | `messages` |
| `streaming` | 断线恢复中的进行中消息 | `sessionStatus` `messageId` `messageSeq` `role` `parts` |

#### 常用附加字段

| 字段 | 类型 | 说明 |
|------|------|------|
| content | string | 文本内容或最终完整内容 |
| toolName | string | 工具名称 |
| toolCallId | string | 工具调用 ID |
| status | string | 工具状态或问题运行状态 |
| input | object | 工具输入参数 |
| output | string | 工具输出结果 |
| error | string | 错误描述 |
| title | string | 工具标题或会话标题 |
| header | string | 问题分组标题 |
| question | string | 问题正文 |
| options | string[] | 问题预设选项 |
| fileName | string | 文件名 |
| fileUrl | string | 文件访问 URL |
| fileMime | string | MIME 类型 |
| tokens | object | token 使用统计 |
| cost | number | 本步骤费用 |
| reason | string | 结束原因 |
| sessionStatus | string | 服务端原始状态：`busy` / `idle` / `retry` |
| permissionId | string | 权限请求 ID |
| permType | string | 权限类型 |
| metadata | object | 权限请求详情 |
| response | string | 权限回复值：`once` / `always` / `reject` |
| messages | array | `snapshot` 携带的已完成消息快照，元素结构见上文 `snapshot` 事件字段 |
| parts | array | `streaming` 携带的进行中消息部件，元素结构见上文 `streaming` 事件字段 |

### SendMessageResult

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息 ID |
| welinkSessionId | number | 所属会话 ID |
| userId | string | 发送用户 ID |
| role | string | 固定为 `user` |
| content | string | 消息内容 |
| messageSeq | number | 该消息在会话中的顺序号 |
| createdAt | string | 创建时间，ISO-8601 |

### StopSkillResult

| 字段 | 类型 | 说明 |
|------|------|------|
| welinkSessionId | number | 会话 ID |
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
| welinkSessionId | number | 会话 ID |
| permissionId | string | 权限请求 ID |
| response | string | 回复值 |

### ControlSkillWeCodeResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 操作状态：`success` / `failed` |

### SendMessageToIMResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 发送是否成功 |
