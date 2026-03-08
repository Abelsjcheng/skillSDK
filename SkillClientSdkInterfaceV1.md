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

## 1. 执行技能接口

### 调用方

IM 客户端调用

### 接口说明

创建或复用 Skill 会话，建立 SDK 与 Skill 服务端之间的 WebSocket 长连接，并发送首条用户消息触发首轮 AI 执行。

### 接口名

```typescript
executeSkill(params: ExecuteSkillParams): Promise<SkillSession>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ak | String | 是 | Agent Plugin 对应的 Access Key，用于定位 Agent 连接 |
| title | String | 否 | 会话标题，不填则由 AI 自动生成 |
| imGroupId | String | 是 | 关联的 IM 群组 ID |
| content | String | 是 | 用户输入的消息 |

### 入参示例

```json
{
  "ak": "ak_xxxxxxxx",
  "title": "帮我创建一个React项目",
  "imGroupId": "group_abc123",
  "content": "帮我发送一条消息"
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
4. 在拿到 `welinkSessionId` 后，立即调用服务端消息发送接口，发送本次新增入参 `content`，用于触发首轮 AI 执行：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "帮我创建一个React项目"
     }
     ```
5. 建连后，所有通过 `registerSessionListener` 注册的监听器都能收到后续消息
6. 若监听器先于 `executeSkill` 注册，则先暂存，待连接建立后自动生效
7. `executeSkill` 主要用于 IM 入口的首次触发；Skill 小程序中的后续多轮对话继续使用 `sendMessage`

### 调用示例

```typescript
try {
  const session = await executeSkill({
    ak: "ak_xxxxxxxx",
    title: "帮我创建一个React项目",
    imGroupId: "group_abc123",
    content: "帮我创建一个React项目"
  });

  console.log("会话创建成功:", session.welinkSessionId);
  console.log("会话状态:", session.status);
} catch (error) {
  console.error("执行技能失败:", error.message);
}
```

---

## 2. 关闭技能接口

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

### 调用示例

```typescript
try {
  const result = await closeSkill();

  if (result.status === "success") {
    console.log("WebSocket 已关闭");
  }
} catch (error) {
  console.error("关闭连接失败:", error.message);
}
```

---

## 3. 停止技能接口

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

### 调用示例

```typescript
try {
  const result = await stopSkill({ welinkSessionId: 42 });

  if (result.status === "aborted") {
    console.log("当前轮回答已停止");
  }
} catch (error) {
  console.error("停止会话失败:", error.message);
}
```

---

## 4. 会话状态变更回调接口

### 接口说明

监听会话状态变更。该接口是对通用 `registerSessionListener` 的二次封装，供 Mini Bar 或会话状态 UI 直接消费。

**重要说明**：

- 调用该接口**不会创建** WebSocket 连接
- 该接口依赖已建立的 WebSocket 连接
- 服务端原始状态为 `busy / idle / retry`
- 客户端 SDK 继续向上层暴露 `executing / stopped / completed` 三态

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

| WebSocket 消息 `type` | 附加条件 | SDK 状态 | 说明 |
|----------------------|----------|----------|------|
| `step.start` | 无 | `executing` | 一轮推理开始 |
| `session.status` | `sessionStatus = busy` | `executing` | 会话处理中 |
| `session.status` | `sessionStatus = retry` | `executing` | 会话重试中 |
| `text.delta` | 无 | `executing` | 正在流式输出文本 |
| `thinking.delta` | 无 | `executing` | 正在流式输出思维链 |
| `tool.update` | 无 | `executing` | 工具调用进行中或状态更新中 |
| `question` | 无 | `executing` | 当前轮进入提问交互，尚未结束 |
| `permission.ask` | 无 | `executing` | 当前轮进入权限确认，尚未结束 |
| `permission.reply` | `response = once` 或 `always` | `executing` | 权限已处理，执行继续 |
| `file` | 无 | `executing` | 文件/附件属于当前轮输出中的内容事件，不视为结束 |
| `step.done` | 无 | `completed` | 当前推理步骤完成 |
| `session.status` | `sessionStatus = idle` | `completed` | 会话回到空闲，表示当前轮完成 |
| `text.done` | 无 | `completed` | 文本部件完成 |
| `thinking.done` | 无 | `completed` | 思维链部件完成 |
| `permission.reply` | `response = reject` | `stopped` | 权限被拒绝，当前执行路径中断 |
| `session.error` | 无 | `stopped` | 会话级异常中断 |
| `error` | 无 | `stopped` | 系统级异常中断 |
| `agent.offline` | 无 | `stopped` | Agent 下线，当前轮无法继续 |

### 补充说明

- `session.title` 暂不参与状态映射
- `text.done`、`thinking.done` 属于部件级完成信号，会先映射为 `completed`
- 如果后续再次收到 `executing` 类事件，例如新的 `tool.update`、`text.delta` 或 `session.status=busy`，状态可再次切回 `executing`
- 更稳定的整轮完成信号优先看 `step.done` 或 `session.status=idle`
- `stopSkill()` 成功后，SDK 仍会额外触发一次 `stopped`，这是客户端补充行为，不属于服务端流式事件映射本身

### 调用示例

```typescript
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
```

---

## 5. 小程序状态变更回调接口

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

### 调用示例

```typescript
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
```

---

## 6. 重新生成问答接口

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

### 调用示例

```typescript
try {
  const result = await regenerateAnswer({
    welinkSessionId: 42
  });

  console.log("重新生成已启动，消息ID:", result.id);
} catch (error) {
  console.error("重新生成失败:", error.message);
}
```

---

## 7. 发送 AI 生成消息结果接口

### 接口说明

将用户在 Skill 小程序中最终确认的文本内容发送到 IM 聊天，用于“选中文本发送到聊天”场景。

SDK 接收的是**最终文本**，不负责传递选区坐标、消息偏移或 part 级定位信息。

**重要说明**：

- 当前仅补齐客户端 SDK 契约
- 服务端文档尚未补充对应 REST 接口定义
- 因此该能力在客户端侧已明确，但服务端闭环仍待后续补齐

### 接口名

```typescript
sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| content | string | 是 | 最终要发送到 IM 的文本内容 |

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

1. 上层应用从 Skill 小程序中获取用户最终确认的文本
2. SDK 调用 Skill 服务端“发送到 IM”接口，传入 `welinkSessionId` 和 `content`
3. Skill 服务端再调用 IM 平台 API 发送该文本

### 注意事项

- SDK 不维护选区本身，只接收最终文本
- 当前服务端接口文档未闭环定义该能力，落地前需与服务端接口同步补齐

### 调用示例

```typescript
try {
  const result = await sendMessageToIM({
    welinkSessionId: 42,
    content: "请先执行 npm install，再运行 npm run dev。"
  });

  console.log("发送到聊天结果:", result.status);
} catch (error) {
  console.error("发送到聊天失败:", error.message);
}
```

---

## 8. 获取当前会话的消息列表接口

### 接口说明

获取当前会话的消息列表。SDK 会将服务端历史消息与本地尚未落库的流式消息缓存合并后返回。

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

SDK 内部维护流式消息缓存，用于存储尚未落库但已经通过 WebSocket 收到的事件，典型来源包括：

- `text.delta`
- `thinking.delta`
- `tool.update`
- `question`
- `permission.ask`
- `file`
- `streaming`

#### 3. 缓存更新逻辑

收到流式消息后，SDK 按 `welinkSessionId + messageId + partId` 更新缓存：

- `text.delta` / `thinking.delta`：追加内容
- `text.done` / `thinking.done`：落定最终内容
- `tool.update`：更新同一工具部件状态和结果
- `question` / `permission.ask` / `file`：追加或更新对应 part
- `snapshot` / `streaming`：用于断线重连恢复本地状态

#### 4. 返回结果

调用 `getSessionMessage` 时，SDK 执行以下步骤：

1. 获取服务端历史消息
2. 获取本地流式缓存
3. 对同一 `messageId` 做去重和合并
4. 若当前存在未持久化的进行中消息，将其追加到返回列表

### 消息角色说明

| role 值 | 说明 |
|---------|------|
| user | 用户消息 |
| assistant | AI 回答 |
| system | 系统消息 |
| tool | 工具消息 |

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
  console.error("获取消息列表失败:", error.message);
}
```

---

## 9. 注册会话监听器接口

### 接口说明

注册会话监听器，用于接收 WebSocket 推送的完整事件流、错误信息和连接关闭事件。该接口独立于消息发送操作，支持在任何时机注册监听器，SDK 会确保不会因调用时序问题遗漏消息。

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

### 接口名

```typescript
registerSessionListener(params: RegisterSessionListenerParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| onMessage | function | 是 | 消息回调函数，接收 `StreamMessage` |
| onError | function | 否 | 错误回调函数，接收错误信息 |
| onClose | function | 否 | 连接关闭回调函数 |

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

1. SDK 内部维护每个会话的监听器列表
2. 支持多个监听器同时注册同一会话
3. 若 WebSocket 已建立，则监听器立即生效
4. 若 WebSocket 尚未建立，则监听器先暂存，待连接建立后自动生效
5. 连接错误时触发 `onError`
6. 连接关闭时触发 `onClose`

### 注意事项

- 回调注册是异步安全的，可在任何时机调用
- 移除监听器需调用 `unregisterSessionListener({ welinkSessionId, onMessage, onError?, onClose? })`

### 调用示例

```typescript
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
```

---

## 10. 移除会话监听器接口

### 接口说明

移除已注册的会话监听器。当监听器不再需要接收消息时调用，例如小程序关闭或页面销毁。

### 接口名

```typescript
unregisterSessionListener(params: UnregisterSessionListenerParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| onMessage | function | 是 | 要移除的消息回调函数 |
| onError | function | 否 | 要移除的错误回调函数 |
| onClose | function | 否 | 要移除的连接关闭回调函数 |

### 实现方法

1. 从会话监听器列表中移除指定监听器
2. 如果移除后该会话无剩余监听器，且 SDK 配置为自动断开，则关闭 WebSocket 连接

### 调用示例

```typescript
onUnmounted(() => {
  unregisterSessionListener({
    welinkSessionId: 42,
    onMessage,
    onError,
    onClose
  });
});
```

---

## 11. 发送消息内容接口

### 接口说明

发送用户输入内容，触发会话的新一轮回答。AI 响应通过 `registerSessionListener` 注册的回调接收。

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

1. 调用服务端 REST API：
   - **URL**: `POST /api/skill/sessions/{welinkSessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "请帮我重构登录模块的校验逻辑",
       "toolCallId": "call_2"
     }
     ```
2. AI 流式响应由 WebSocket 推送到 SDK，再通过监听器分发

### 错误处理

| HTTP状态码 | 条件 | 说明 |
|------------|------|------|
| 400 | Bad Request | `content` 为空或空白字符串 |
| 404 | Not Found | 会话不存在 |
| 409 | Conflict | 会话已关闭 |
| 500 | Internal Server Error | AI-Gateway 调度失败 |

### 调用示例

```typescript
try {
  const result = await sendMessage({
    welinkSessionId: 42,
    content: "请帮我重构登录模块的校验逻辑"
  });

  console.log("创建时间:", result.createdAt);
} catch (error) {
  console.error("发送消息失败:", error.message);
}
```

---

## 12. 权限确认接口

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
  console.error("回复权限确认失败:", error.message);
}
```

---

## 13. 小程序控制接口

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

### 调用示例

```typescript
await controlSkillWeCode({
  action: SkillWeCodeAction.CLOSE
});

await controlSkillWeCode({
  action: SkillWeCodeAction.MINIMIZE
});
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

### ExecuteSkillParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ak | String | 是 | Agent Plugin 对应的 Access Key |
| title | String | 否 | 会话标题 |
| imGroupId | String | 是 | 关联的 IM 群组 ID |
| content | String | 是 | 首条用户消息内容，用于触发首轮 AI 执行 |

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

### UnregisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| onMessage | function | 是 | 要移除的消息回调函数 |
| onError | function | 否 | 要移除的错误回调函数 |
| onClose | function | 否 | 要移除的连接关闭回调函数 |

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
| content | string | 是 | 最终要发送到 IM 的文本内容 |

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
| id | number | 消息 ID |
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
| toolStatus | string | 工具状态 |
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
| messages | array | `snapshot` 携带的已完成消息快照 |
| parts | array | `streaming` 携带的进行中消息部件 |

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
