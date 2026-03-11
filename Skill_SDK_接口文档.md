# Skill SDK 工程文档

## 概述

本文档描述了用于IM客户端、OpenCode Skill服务端、小程序间交互的鸿蒙ArkTS SDK接口定义。
set OPENCODE_PERMISSION={"bash":"ask","edit":"ask","external_directory":"ask"}
opencode

---

## 1. 执行技能接口

### 接口说明

与Skill服务端建立WebSocket会话连接，并发送用户消息到服务端触发AI处理。

### 接口名

```typescript
executeSkill(params: ExecuteSkillParams): Promise<SkillSession>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| imChatId | string | 是 | IM聊天ID |
| skillDefinitionId | number | 是 | 技能定义 ID |
| userId | string | 是 | 用户ID |
| agentId | number | 否 | PCAgent ID，提供时将触发 AI-Gateway 创建 OpenCode 会话 |
| title | string | 否 | 会话标题 |
| skillContent | string | 是 | 用户输入的Skill指令内容，即用户发起技能请求的输入 |

### 出参

返回 `SkillSession` 对象，包含以下字段：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| sessionId | string | 会话ID，用于后续对该会话进行操作 |
| status | string | 会话状态：ACTIVE（活跃）、IDLE（空闲）、CLOSED（已关闭） |
| createdAt | string | 创建时间 |
| lastActiveAt | string | 最后活跃时间 |

### 出参示例

```json
{
  "sessionId": 42,
  "status": "ACTIVE",
  "createdAt": "2026-03-06T10:30:00",
  "lastActiveAt": "2026-03-06T10:30:00"
}
```

### 实现方法

1. 调用服务端REST API创建会话：
   - **URL**: `POST /api/skill/sessions`
   - **请求体**:
     ```json
     {
       "userId": 1001,
       "skillDefinitionId": 1,
       "agentId": 99,
       "title": "重构登录模块",
       "imChatId": "chat-789"
     }
     ```
   - **响应**: 返回 `SkillSession` 对象，包含会话ID

2. 建立WebSocket流式连接并注册内部缓存监听器：
   - **URL**: `ws://{host}:8082/ws/skill/stream`
   - **单例模式**：客户端只需建立一个WebSocket连接即可接收所有会话的消息推送
   - **内部缓存监听器**：SDK在建立WebSocket连接时，会自动注册一个内部监听器用于缓存流式消息数据，确保即使用户未调用 `registerSessionListener` 也不会丢失数据
   - 内部监听器职责：
     - 接收并缓存所有 `delta` 类型的增量消息
     - 在 `done` 类型消息到达时标记流式消息完成
     - 在 `error` 类型消息到达时清理缓存
   - 缓存的数据可通过 `getSessionMessage` 接口获取，会自动合并历史消息和流式缓存消息

3. 根据skillContent，自动发送首条用户消息触发AI处理：
   - **URL**: `POST /api/skill/sessions/{sessionId}/messages`
   - **请求体**: `{ "content": skillContent }`
   - **重要**：只有调用此API发送消息后，服务端才会开始推送AI响应流，触发WebSocket消息回调机制

4. **WebSocket消息回调机制**：
   - WebSocket连接建立后处于待机状态，等待消息触发
   - 调用消息发送API后，服务端开始推送AI响应流
   - 内部缓存监听器首先接收并缓存所有消息
   - 所有通过 `registerSessionListener` 注册的监听器会实时接收消息
   - 消息类型包括：
     - `delta`: AI生成的增量内容
     - `done`: AI处理完成，包含token用量统计
     - `error`: 处理错误
     - `agent_offline`: Agent离线
     - `agent_online`: Agent上线
   - 示例消息格式：
     ```json
     {
       "sessionId": "42",
       "type": "delta",
       "seq": 1,
       "content": "好的，我来分析一下登录模块的代码..."
     }
     ```

5. **数据缓存流程**：
   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │                    executeSkill 数据缓存流程                     │
   ├─────────────────────────────────────────────────────────────────┤
   │                                                                 │
   │  1. 创建会话 (REST API)                                         │
   │         │                                                       │
   │         ▼                                                       │
   │  2. 建立WebSocket连接                                           │
   │         │                                                       │
   │         ▼                                                       │
   │  ┌─────────────────┐                                           │
   │  │ 注册内部缓存监听器 │ ◄─── 自动注册，确保数据不丢失           │
   │  └────────┬────────┘                                           │
   │           │                                                     │
   │           ▼                                                     │
   │  3. 发送首条消息 (REST API)                                     │
   │         │                                                       │
   │         ▼                                                       │
   │  4. 服务端开始推送AI响应流                                      │
   │         │                                                       │
   │         ▼                                                       │
   │  ┌─────────────────┐                                           │
   │  │ 接收流式消息     │                                           │
   │  │ delta/done/error │                                          │
   │  └────────┬────────┘                                           │
   │           │                                                     │
   │           ▼                                                     │
   │  ┌─────────────────┐                                           │
   │  │ 更新流式消息缓存 │ ◄─── StreamingMessageCache               │
   │  └────────┬────────┘                                           │
   │           │                                                     │
   │           ▼                                                     │
   │  ┌─────────────────┐                                           │
   │  │ 分发给用户监听器 │ ◄─── registerSessionListener 注册的监听器 │
   │  └─────────────────┘                                           │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
   ```

### 调用示例

```typescript
try {
  const session = await executeSkill({
    imChatId: 'chat-789',
    skillDefinitionId: 1,
    userId: 'user-1001',
    skillContent: '请帮我重构登录模块',
    agentId: 99,           // 可选
    title: '重构登录模块'    // 可选，会话标题
  });
  
  console.log('会话创建成功:', session.sessionId);
  console.log('会话状态:', session.status);
} catch (error) {
  console.error('执行技能失败:', error.message);
  // 错误处理：会话创建失败、网络错误等
}
```

---

## 2. 关闭技能接口

### 接口说明

关闭与Skill服务端的WebSocket会话连接，释放资源。关闭会话后，该会话将不再接受新的消息，也无法恢复。

### 接口名

```typescript
closeSkill(params: CloseSkillParams): Promise<CloseSkillResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 要关闭的会话ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 关闭状态：success（成功）、failed（失败） |

### 出参示例

成功时：

```json
{
  "status": "success"
}
```

### 实现方法

1. 调用服务端REST API关闭会话：
   - **URL**: `DELETE /api/skill/sessions/{sessionId}`
   - **响应**: 
     ```json
     {
       "status": "closed",
       "sessionId": "42"
     }
     ```
   
2. 关闭WebSocket流式连接：
   - 断开与 `ws://{host}:8082/ws/skill/stream/{sessionId}` 的连接

3. 如果会话关联了agentId和toolSessionId，服务端会自动向AI-Gateway发送`close_session`调度指令

### 错误处理

| HTTP状态码 | 条件 | 说明 |
|------------|------|------|
| 404 | Not Found | 会话不存在 |
| 409 | Conflict | 会话已关闭 |

### 调用示例

```typescript
try {
  const result = await closeSkill({ sessionId: '42' });
  
  if (result.status === 'success') {
    console.log('会话关闭成功');
  }
} catch (error) {
  console.error('关闭会话失败:', error.message);
  // 错误处理：会话不存在、会话已关闭、网络错误等
}
```

---

## 3. 停止技能接口

### 接口说明

停止Skill服务端WebSocket会话的持续回调，中断当前正在进行的回答生成，但保持会话连接。调用此接口后，会话状态将变为`stopped`，用户可以后续发送新消息继续对话。

### 接口名

```typescript
stopSkill(params: StopSkillParams): Promise<StopSkillResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 要停止的会话ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 停止状态：success（成功）、failed（失败） |

### 出参示例

成功时：

```json
{
  "status": "success"
}
```


### 实现方法

1. 断开WebSocket流式连接：
   - 关闭与 `ws://{host}:8082/ws/skill/stream/{sessionId}` 的连接
   - 取消对该会话消息流的订阅

2. 更新本地会话状态为`stopped`

3. **注意**：此操作仅停止客户端接收WebSocket推送，服务端的AI处理可能仍在进行。如需完全停止AI处理，请使用`closeSkill`接口关闭会话。

### 与closeSkill的区别

| 特性 | stopSkill | closeSkill |
|------|-----------|------------|
| 会话连接 | 保持连接 | 释放资源 |
| 会话状态 | stopped | closed |
| 后续操作 | 可发送新消息继续对话 | 会话不可恢复 |
| WebSocket | 断开但不删除订阅 | 断开连接 |

### 调用示例

```typescript
try {
  const result = await stopSkill({ sessionId: '42' });
  
  if (result.status === 'success') {
    console.log('会话已停止，可继续发送消息');
  }
} catch (error) {
  console.error('停止会话失败:', error.message);
  // 错误处理：会话不存在、网络错误等
}
```

---

## 4. 会话状态变更回调接口

### 接口说明

监听会话消息状态变更的回调接口，包括执行中、停止、完成三种状态。通过注册回调函数的方式获取状态变化通知。

**重要说明**：
- 调用该接口**不会创建WebSocket连接**
- 该接口基于已创建的WebSocket会话连接，监听WebSocket消息
- 根据消息类型来更新会话状态并触发回调

### 接口名

```typescript
onSessionStatusChange(params: OnSessionStatusChangeParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| callback | function | 是 | 状态变更回调函数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | SessionStatus | 会话状态，枚举值：executing（执行中）、stopped（停止）、completed（完成） |

### 出参示例

回调函数接收的参数示例：

```typescript
// 执行中状态
{
  status: SessionStatus.EXECUTING,  // "executing"
}

// 停止状态
{
  status: SessionStatus.STOPPED,    // "stopped"
}

// 完成状态
{
  status: SessionStatus.COMPLETED,  // "completed"
}
```

### 实现方法

1. **前提条件**：
   - WebSocket会话连接必须已建立（通过 `executeSkill` 或 `registerSessionListener` 创建）
   - 该接口不会主动创建WebSocket连接

2. **监听WebSocket消息**，根据消息类型更新会话状态：

   | WebSocket消息type | 说明 | SessionStatus |
   |------------------|------|---------------|
   | `delta` | 增量内容更新中 | executing |
   | `done` | AI处理完成 | completed |
   | `error` | 发生错误 | stopped |
   | `agent_offline` | Agent离线 | stopped |
   | `agent_online` | Agent上线 | executing |

3. WebSocket推送消息格式：
   ```json
   {
     "type": "delta",
     "seq": 1,
     "content": "AI生成的文本片段"
   }
   ```

### 错误处理

| 场景 | 说明 |
|------|------|
| 连接缺少sessionId | 服务端立即关闭连接 |
| 传输错误 | 自动移除故障连接 |

### 调用示例

```typescript
try {
  onSessionStatusChange({
    sessionId: '42',
    callback: (result) => {
      switch (result.status) {
        case SessionStatus.EXECUTING:
          console.log('AI正在处理中...');
          break;
        case SessionStatus.STOPPED:
          console.log('会话已停止');
          break;
        case SessionStatus.COMPLETED:
          console.log('AI处理完成');
          break;
      }
    }
  });
} catch (error) {
  console.error('注册状态监听失败:', error.message);
  // 错误处理：连接失败、无效sessionId等
}
```

---

## 5. 小程序状态变更回调接口

### 接口说明

监听小程序的状态变化，当小程序被关闭或缩小到后台时触发回调，通知上层应用进行相应处理。该回调用于处理以下场景：
- 用户主动关闭或缩小小程序
- 系统触发的小程序后台化事件
- 调用`controlSkillWeCode`接口主动控制小程序状态

### 触发条件

| 触发场景 | 回调状态 |
|----------|----------|
| 用户关闭小程序 | closed |
| 系统锁屏 | minimized |
| 调用`controlSkillWeCode("close")` | closed |
| 调用`controlSkillWeCode("minimize")` | minimized |

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
| status | SkillWecodeStatus | 小程序状态，枚举值：closed（关闭）、minimized（缩小） |

### 出参示例

回调函数接收的参数示例：

```typescript
// 关闭状态
{
  status: SkillWecodeStatus.CLOSED,      // "closed"
}

// 最小化状态
{
  status: SkillWecodeStatus.MINIMIZED,   // "minimized"
}
```

### 实现方法

1. **注册系统级生命周期事件监听器**（鸿蒙原生能力）：
   - 注册窗口关闭事件监听器
   - 注册应用前后台切换事件监听器
   - 注册系统锁屏事件监听器

2. **监听接口调用事件**：
   - 监听`controlSkillWeCode`接口的调用
   - 当该接口被调用时，根据传入的action触发相应状态回调

3. **状态回调触发逻辑**：
   - 当调用`controlSkillWeCode("close")`时，触发回调并传入`closed`状态
   - 当调用`controlSkillWeCode("minimize")`时，触发回调并传入`minimized`状态
   - 回调函数将在接口调用成功后立即执行

### 处理逻辑

| 状态 | 触发场景 | SDK行为 | 回调触发时机 |
|------|----------|---------|--------------|
| closed | 用户关闭小程序 | 断开WebSocket，调用`closeSkill` | 窗口关闭事件触发后 |
| closed | 调用`controlSkillWeCode("close")` | 断开WebSocket，调用`closeSkill` | 接口调用成功后立即 |
| minimized | 小程序进入后台 | 保持连接，会话状态设为IDLE | 系统事件触发后 |
| minimized | 调用`controlSkillWeCode("minimize")` | 保持连接，会话状态设为IDLE | 接口调用成功后立即 |

### 调用示例

```typescript
try {
  onSkillWecodeStatusChange({
    callback: (result) => {
      switch (result.status) {
        case SkillWecodeStatus.CLOSED:
          console.log('小程序已关闭');
          // 清理资源
          break;
        case SkillWecodeStatus.MINIMIZED:
          console.log('小程序已最小化');
          // 保持连接，可后续恢复
          break;
      }
    }
  });
} catch (error) {
  console.error('注册小程序状态监听失败:', error.message);
  // 错误处理：监听注册失败等
}
```

---

## 6. 重新生成问答接口

### 接口说明

根据提供的内容重新生成回答，用于用户对回答结果不满意时触发重新回答。该接口会清除当前正在生成的响应，重新触发AI处理流程。

### 接口名

```typescript
regenerateAnswer(params: RegenerateAnswerParams): Promise<AnswerResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 重新生成的消息内容 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| messageId | string | 消息ID，用于标识该回答（成功时返回） |

### 出参示例

成功时：

```json
{
  "messageId": "msg-xyz789"
}
```

```

### 实现方法

1. 调用服务端REST API发送用户消息：
   - **URL**: `POST /api/skill/sessions/{sessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "{用户提供的content参数}"
     }
     ```

2. 通过WebSocket流式连接接收AI重新生成的响应

### 注意事项

- 该接口需要确保WebSocket流式连接已建立
- 适用于AI回答不完整或不满意的情况
- content参数为必填，需要调用方提供重新生成的消息内容

### 调用示例

```typescript
try {
  const result = await regenerateAnswer({ 
    sessionId: '42',
    content: '请重新分析这个问题并提供更详细的方案'
  });
  
  if (result.success) {
    console.log('重新生成已启动，消息ID:', result.messageId);
  }
} catch (error) {
  console.error('重新生成失败:', error.message);
}
```

---

## 7. 发送AI生成消息结果接口

### 接口说明

将AI生成的消息结果发送到IM客户端，用于将Skill服务端的回答内容同步到IM会话中。通过调用服务端API，将消息内容转发到会话关联的IM聊天中。

### 接口名

```typescript
sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | AI生成的消息内容 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 发送是否成功 |
| chatId | string | IM聊天ID（成功时返回） |
| contentLength | number | 发送内容的字符长度（成功时返回） |
| errorMessage | string | 错误信息（失败时返回） |

### 出参示例

成功时：

```json
{
  "success": true,
  "chatId": "chat-789",
  "contentLength": 22
}
```


### 实现方法

调用服务端REST API发送消息到IM：
- **URL**: `POST /api/skill/sessions/{sessionId}/send-to-im`
- **请求体**:
  ```json
  {
    "content": "代码重构已完成，请查看 PR #42"
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

### 错误处理

| HTTP状态码 | 条件 | 说明 |
|------------|------|------|
| 400 | Bad Request | content为空或空白 |
| 404 | Not Found | 会话不存在 |
| 409 | Conflict | 会话无关联的IM聊天ID |
| 500 | Internal Server Error | IM消息发送失败 |

### 副作用

- 调用IM平台API发送文本消息到指定聊天

### 调用示例

```typescript
try {
  const result = await sendMessageToIM({
    sessionId: '42',
    content: '代码重构已完成，请查看 PR #42'
  });
  
  if (result.success) {
    console.log('消息已发送到IM，聊天ID:', result.chatId);
    console.log('内容长度:', result.contentLength);
  }
} catch (error) {
  console.error('发送消息到IM失败:', error.message);
  // 错误处理：会话不存在、IM聊天ID未关联、网络错误等
}
```

---

## 8. 获取当前会话的消息列表接口

### 接口说明

获取当前会话的消息列表，将数据持久化存储到本地。分页查询指定会话的消息历史记录，包括用户消息和AI回答。

### 接口名

```typescript
getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<ChatMessage>>
```

### 入参

| 参数   | 类型      | 必填 | 默认值 | 说明              |
| ------ | --------- | ---- | ------ | ----------------- |
| sessionId | string | 是 | - | 会话ID |
| page | number | 否   | 0    | 页码（从 0 开始） |
| size | number | 否   | 50   | 每页条数          |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<ChatMessage> | 历史消息列表，包含用户消息和AI回答 |
| totalElements | number | 总记录数 |
| totalPages | number | 总页数 |
| number | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |

### 实现方法

#### 1. 获取历史消息（服务端持久化数据）

调用服务端REST API查询消息历史：
- **URL**: `GET /api/skill/sessions/{sessionId}/messages?page=0&size=50`
- **响应**:
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

#### 2. 合并正在流式传输中的消息内容

当AI正在流式返回内容但尚未完成时，需要将本地缓存的增量内容与历史消息合并：

**2.1 本地增量消息缓存机制**

SDK内部维护一个增量消息缓存，用于存储WebSocket接收的`delta`类型消息：

**2.2 缓存更新逻辑**

收到增量消息时，更新缓存：

**2.3 消息合并逻辑**

调用 `getSessionMessage` 时，SDK执行以下步骤：
Step 1: 获取服务端历史消息
Step 2: 获取本地流式消息缓存
Step 3: 判断是否需要合并
  检查历史消息中是否已包含该消息（避免重复）
  构造流式消息对象
  追加到消息列表末尾
Step 4: 如果流式消息已完成但未同步到服务端，也需合并

#### 3. 数据流图示

```
┌─────────────────────────────────────────────────────────────────┐
│                    getSessionMessage 调用流程                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  REST API 调用   │    │  本地缓存查询    │                  │
│  │  历史消息列表    │    │  流式消息缓存    │                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │                       │                            │
│           │   ┌───────────────────┘                            │
│           │   │                                                │
│           ▼   ▼                                                │
│      ┌─────────────┐                                           │
│      │  消息合并   │ ◄─── 检查 isStreaming 状态                │
│      │  去重处理   │ ◄─── 检查 messageId 是否已存在            │
│      └──────┬──────┘                                           │
│             │                                                  │
│             ▼                                                  │
│      ┌─────────────┐                                           │
│      │  返回结果   │                                           │
│      │  历史消息   │                                           │
│      │  + 流式消息 │（如果正在传输中）                         │
│      └─────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. 返回结果示例

**场景：AI正在流式返回内容时调用**

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
    },
    {
      "id": "streaming-42",
      "sessionId": 42,
      "seq": 15,
      "role": "ASSISTANT",
      "content": "根据分析，登录模块存在以下问题：\n1. 密码校验逻辑分散\n2. 缺少输入验证...",
      "contentType": "MARKDOWN",
      "createdAt": "2026-03-06T10:35:00",
      "meta": "{\"isStreaming\":true}"
    }
  ],
  "totalElements": 3,
  "totalPages": 1,
  "number": 0,
  "size": 50
}
```

#### 5. 注意事项

- 流式消息的 `id` 在未完成时为临时ID（如 `streaming-{sessionId}`），完成后替换为服务端返回的真实ID
- 流式消息的 `meta` 字段包含 `isStreaming` 标识，前端可据此显示加载状态
- 合并逻辑会自动去重，避免消息重复显示
- 如果会话已关闭或无流式消息缓存，仅返回服务端历史消息

### 错误处理

| HTTP状态码 | 条件 | 说明 |
|------------|------|------|
| 404 | Not Found | 会话不存在 |

### 消息角色说明

| role值 | 说明 |
|--------|------|
| USER | 用户消息 |
| ASSISTANT | AI回答 |
| SYSTEM | 系统消息 |
| TOOL | 工具执行结果 |

### 调用示例

```typescript
try {
  const result = await getSessionMessage({
    sessionId: '42',
    page: 0,
    size: 50
  });
  
  console.log('总消息数:', result.totalElements);
  console.log('当前页:', result.number);
  
  result.content.forEach(message => {
    console.log(`[${message.role}] ${message.content}`);
  });
} catch (error) {
  console.error('获取消息列表失败:', error.message);
  // 错误处理：会话不存在、网络错误等
}
```

---

## 9. 注册会话监听器接口

### 接口说明

注册会话监听器，用于接收WebSocket推送的AI响应流、错误信息和连接关闭事件。该接口独立于消息发送操作，支持在任何时机注册监听器，SDK会确保不会因调用时序问题遗漏消息。

### 接口名

```typescript
registerSessionListener(params: RegisterSessionListenerParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| onMessage | function | 是 | 消息回调函数，接收AI响应流 |
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

1. **回调注册机制**：
   - SDK内部维护每个会话的监听器列表
   - 支持多个监听器同时注册同一会话
   - 回调注册是幂等的，重复注册不会产生副作用

2. **时序安全保障**：
   - 如果WebSocket连接已建立，新注册的监听器会立即开始接收后续消息
   - 如果WebSocket尚未建立，监听器会被暂存，连接建立后自动生效
   - SDK保证回调注册与WebSocket连接建立的时序无关

3. **事件分发**：
   - WebSocket收到消息后，调用所有监听器的 `onMessage` 回调
   - 连接错误时，调用所有监听器的 `onError` 回调
   - 连接关闭时，调用所有监听器的 `onClose` 回调


### 注意事项

- 回调注册是异步安全的，可在任何时机调用
- 建议在小程序 `onShow` 生命周期中注册监听器
- 移除监听器需调用 `unregisterSessionListener(sessionId, onMessage, onError?, onClose?)`

### 调用示例

```typescript
// 定义回调函数
const onMessage = (message: StreamMessage) => {
  switch (message.type) {
    case 'delta':
      console.log('AI响应片段:', message.content);
      break;
    case 'done':
      console.log('AI处理完成');
      break;
    case 'error':
      console.error('处理错误:', message.content);
      break;
  }
};

const onError = (error: SessionError) => {
  console.error('连接错误:', error.code, error.message);
};

const onClose = (reason: string) => {
  console.log('连接关闭:', reason);
};

try {
  registerSessionListener({
    sessionId: '42',
    onMessage,
    onError,
    onClose
  });
  console.log('监听器注册成功');
} catch (error) {
  console.error('注册监听器失败:', error.message);
  // 错误处理：无效sessionId、连接失败等
}
```

---

## 10. 移除会话监听器接口

### 接口说明

移除已注册的会话监听器。当监听器不再需要接收消息时调用，例如小程序关闭或切换页面时。

### 接口名

```typescript
unregisterSessionListener(params: UnregisterSessionListenerParams): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| onMessage | function | 是 | 要移除的消息回调函数 |
| onError | function | 否 | 要移除的错误回调函数 |
| onClose | function | 否 | 要移除的连接关闭回调函数 |

### 实现方法

1. 从会话的监听器列表中移除指定的监听器
2. 如果移除后该会话无剩余监听器，且配置为自动断开，则关闭WebSocket连接

### 使用场景

```typescript
// 小程序页面销毁时移除监听
onUnmounted(() => {
  unregisterSessionListener(sessionId, onMessage, onError, onClose);
});
```

### 注意事项

- 移除的监听器必须是之前通过 `registerSessionListener` 注册的同一个监听器对象
- 建议保存监听器对象引用以便后续移除

### 调用示例

```typescript
// 保存回调函数引用
const onMessage = (message: StreamMessage) => {
  console.log('收到消息:', message);
};

try {
  // 移除监听器
  unregisterSessionListener({
    sessionId: '42',
    onMessage
  });
  console.log('监听器已移除');
} catch (error) {
  console.error('移除监听器失败:', error.message);
  // 错误处理：监听器未注册、无效sessionId等
}
```

---

## 11. 发送消息内容接口

### 接口说明

发送用户输入的内容，触发会话的持续回答，用于多轮对话场景。该接口会先发送消息到服务端，然后通过WebSocket接收AI的流式响应。

### 接口名

```typescript
sendMessage(params: SendMessageParams): Promise<SendMessageResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 用户输入的消息内容 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| messageId | number | 消息ID（成功时返回） |
| seq | number | 会话内消息序号（成功时返回） |
| createdAt | string | 消息创建时间（成功时返回） |

### 出参示例

成功时：

```json
{
  "messageId": 1,
  "seq": 1,
  "createdAt": "2026-03-06T10:30:00"
}
```

### 实现方法

1. 调用服务端REST API发送用户消息：
   - **URL**: `POST /api/skill/sessions/{sessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "请帮我重构登录模块的校验逻辑"
     }
     ```
   - **响应**: 返回 `SkillMessage` 对象
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

2. 确保WebSocket流式连接已建立（如果尚未建立则创建）：
   - **URL**: `ws://{host}:8082/ws/skill/stream/{sessionId}`

3. 通过WebSocket监听AI响应，通过onMessage回调推送：
   - **增量内容 (delta)**:
     ```json
     {
       "type": "delta",
       "seq": 1,
       "content": "好的，我来"
     }
     ```
   - **执行完成 (done)**:
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
   - **错误 (error)**:
     ```json
     {
       "type": "error",
       "seq": 10,
       "content": "处理超时"
     }
     ```

### 错误处理

| HTTP状态码 | 条件 | 说明 |
|------------|------|------|
| 400 | Bad Request | content为空或空白字符串 |
| 404 | Not Found | 会话不存在 |
| 409 | Conflict | 会话已关闭（状态为CLOSED） |
| 500 | Internal Server Error | AI-Gateway调度失败 |

### 副作用

- 持久化用户消息到数据库
- 向AI-Gateway发送`chat`调度指令（携带消息文本和toolSessionId）
- AI响应将通过WebSocket流式推送

### 调用示例

```typescript
try {
  const result = await sendMessage({
    sessionId: '42',
    content: '请帮我重构登录模块的校验逻辑'
  });
  
  console.log('消息发送成功，消息ID:', result.messageId);
  console.log('消息序号:', result.seq);
  console.log('创建时间:', result.createdAt);
  
  // AI响应将通过 registerSessionListener 注册的回调接收
} catch (error) {
  console.error('发送消息失败:', error.message);
  // 错误处理：会话不存在、会话已关闭、网络错误等
}
```

---

## 12. 权限确认接口

### 接口说明

对AI发起的权限确认请求进行批准或拒绝。当AI需要执行文件修改、命令执行等敏感操作时，会发送权限确认请求。前端收到后展示确认UI，用户决策后调用此接口回复。

### 接口名

```typescript
replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| permissionId | string | 是 | 权限确认请求ID |
| approved | boolean | 是 | 审批结果：true批准，false拒绝 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 回复是否成功 |
| permissionId | string | 权限确认请求ID（成功时返回） |
| approved | boolean | 审批结果（成功时返回） |

### 出参示例

成功时：

```json
{
  "success": true,
  "permissionId": "p-abc123",
  "approved": true
}
```


### 实现方法

调用服务端REST API回复权限确认：
- **URL**: `POST /api/skill/sessions/{sessionId}/permissions/{permissionId}`
- **请求体**:
  ```json
  {
    "approved": true
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "permissionId": "p-abc123",
    "approved": true
  }
  ```

### 错误处理

| HTTP状态码 | 条件 | 说明 |
|------------|------|------|
| 400 | Bad Request | approved字段缺失 |
| 404 | Not Found | 会话不存在或无关联Agent |
| 409 | Conflict | 会话已关闭 |

### 副作用

- 向AI-Gateway发送`permission_reply`调度指令（携带permissionId、approved、toolSessionId）

### 调用示例

```typescript
try {
  // 用户批准权限请求
  const result = await replyPermission({
    sessionId: '42',
    permissionId: 'p-abc123',
    approved: true
  });
  
  if (result.success) {
    console.log('权限确认已发送，审批结果:', result.approved);
  }
} catch (error) {
  console.error('回复权限确认失败:', error.message);
  // 错误处理：会话不存在、无关联Agent、会话已关闭等
}

// 用户拒绝权限请求
try {
  const result = await replyPermission({
    sessionId: '42',
    permissionId: 'p-abc123',
    approved: false
  });
  console.log('权限已拒绝');
} catch (error) {
  console.error('回复权限确认失败:', error.message);
}
```

---

## 13. 小程序控制接口

### 接口说明

执行小程序的关闭或最小化操作，用于控制小程序的生命周期。该接口直接控制OpenCode小程序的显示状态。

### 接口名

```typescript
controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | SkillWeCodeAction | 是 | 操作类型：close（关闭）、minimize（最小化） |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作状态：success（成功）、failed（失败） |

### 出参示例

成功时：

```json
{
  "status": "success"
}
```


### 实现方法

1. **close - 关闭小程序**:
   - 调用鸿蒙原生窗口管理API关闭小程序
   - 通过`onSkillWecodeStatusChange`回调通知上层应用小程序状态变更为`closed`
   - 由上层应用决定是否调用`closeSkill`关闭 Skill 会话
   - SDK 不主动处理 WebSocket 连接，由上层应用管理

2. **minimize - 最小化小程序**:
   - 调用鸿蒙原生窗口管理 API 将小程序最小化到后台
   - 通过`onSkillWecodeStatusChange`回调通知上层应用小程序状态变更为`minimized`
   - SDK 不处理 WebSocket 连接，由上层应用根据需要决定是否调用`stopSkill`停止 AI 生成

### 与其他接口的关系

| 操作 | 调用接口 | 说明 |
|------|----------|------|
| 关闭小程序 | `controlSkillWeCode(close)` | SDK 仅通知状态，上层应用决定是否调用`closeSkill` |
| 最小化小程序 | `controlSkillWeCode(minimize)` | SDK 仅通知状态，上层应用决定是否调用`stopSkill` |
| 停止 AI 生成 | `stopSkill` | 仅停止流式推送，不改变小程序状态 |
| 注册会话监听 | `registerSessionListener` | 小程序打开后注册监听器 |
| 移除会话监听 | `unregisterSessionListener` | 小程序关闭时移除监听器 |
| 发送消息 | `sendMessageContent` | 发送新消息触发 AI 处理 |
| 监听小程序状态 | `onSkillWecodeStatusChange` | 接收小程序状态变化通知 |

### 调用示例

```typescript
// 监听小程序状态变化
onSkillWecodeStatusChange((status) => {
  if (status === SkillWecodeStatus.CLOSED) {
    console.log('小程序已关闭');
    // 上层应用决定是否调用 closeSkill 关闭会话
    closeSkill({ sessionId });
  } else if (status === SkillWecodeStatus.MINIMIZED) {
    console.log('小程序已最小化');
    // 上层应用根据需要决定是否调用 stopSkill 停止 AI 生成
    stopSkill({ sessionId });
  }
});

// 关闭小程序
try {
  const result = await controlSkillWeCode({
    action: SkillWeCodeAction.CLOSE
  });
  
  if (result.status === 'success') {
    console.log('关闭小程序指令已发送');
    // SDK 会通过 onSkillWecodeStatusChange 回调通知状态
    // 上层应用在回调中决定是否关闭会话
  }
} catch (error) {
  console.error('关闭小程序失败:', error.message);
}

// 最小化小程序
try {
  const result = await controlSkillWeCode({
    action: SkillWeCodeAction.MINIMIZE
  });
  
  if (result.status === 'success') {
    console.log('最小化小程序指令已发送');
    // SDK 会通过 onSkillWecodeStatusChange 回调通知状态
    // 上层应用在回调中决定是否停止 AI 生成
  }
} catch (error) {
  console.error('最小化小程序失败:', error.message);
}
```

## 数据类型定义

### ExecuteSkillParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| imChatId | string | 是 | IM聊天ID |
| skillDefinitionId | number | 是 | 技能定义 ID |
| userId | string | 是 | 用户ID |
| agentId | number | 否 | PCAgent ID，提供时将触发 AI-Gateway 创建 OpenCode 会话 |
| title | string | 否 | 会话标题 |
| skillContent | string | 是 | 用户输入的Skill指令内容，即用户发起技能请求的输入 |

### CloseSkillParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 要关闭的会话ID |

### StopSkillParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 要停止的会话ID |

### OnSessionStatusChangeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| callback | function | 是 | 状态变更回调函数 |

### OnSkillWecodeStatusChangeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| callback | function | 是 | 小程序状态变更回调函数 |

### RegenerateAnswerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 重新生成的消息内容 |

### SendMessageToIMParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | AI生成的消息内容 |

### GetSessionMessageParams

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|------|
| sessionId | string | 是 | - | 会话ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |

### RegisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| onMessage | function | 是 | 消息回调函数，接收AI响应流 |
| onError | function | 否 | 错误回调函数，接收错误信息 |
| onClose | function | 否 | 连接关闭回调函数 |

### UnregisterSessionListenerParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| onMessage | function | 是 | 要移除的消息回调函数 |
| onError | function | 否 | 要移除的错误回调函数 |
| onClose | function | 否 | 要移除的连接关闭回调函数 |

### SendMessageParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 用户输入的消息内容 |

### ReplyPermissionParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话ID |
| permissionId | string | 是 | 权限确认请求ID |
| approved | boolean | 是 | 审批结果：true批准，false拒绝 |

### ControlSkillWeCodeParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | SkillWeCodeAction | 是 | 操作类型：close（关闭）、minimize（最小化） |

  ### SessionListener

  | 字段 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | onMessage | function | 是 | 消息回调函数，接收AI响应流 |
  | onError | function | 否 | 错误回调函数，接收错误信息 |
  | onClose | function | 否 | 连接关闭回调函数 |

  ### SessionStatusResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | SessionStatus | 会话状态，枚举值：executing（执行中）、stopped（停止）、completed（完成） |

### SessionStatus

| 枚举值 | 说明 |
|--------|------|
| executing | 执行中 |
| stopped | 已停止 |
| completed | 已完成 |

### SkillWecodeStatusResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | SkillWecodeStatus | 小程序状态，枚举值：closed（关闭）、minimized（缩小） |
| timestamp | number | 状态变更时间戳（毫秒） |
| message | string | 状态变更说明信息（可选） |

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

### ChatMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息ID（服务端返回） |
| sessionId | number | 会话ID |
| seq | number | 会话内消息序号 |
| role | string | 角色：USER（用户）/ ASSISTANT（AI）/ SYSTEM（系统）/ TOOL（工具） |
| content | string | 消息内容 |
| contentType | string | 内容类型：MARKDOWN（默认）、CODE、PLAIN |
| createdAt | string | 创建时间（ISO 8601格式） |
| meta | string | 扩展元数据（JSON格式，如token用量） |

### StreamMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 消息类型：delta（增量）、done（完成）、error（错误）、agent_offline、agent_online |
| seq | number | 递增序列号 |
| content | string | 消息内容 |
| usage | object | token用量统计（仅done类型） |

### SendMessageToIMResult

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 发送是否成功 |
| chatId | string | IM聊天ID（成功时返回） |
| contentLength | number | 发送内容的字符长度（成功时返回） |

### SendMessageResult

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | number | 消息ID（成功时返回） |
| seq | number | 会话内消息序号（成功时返回） |
| createdAt | string | 消息创建时间（成功时返回） |

### ReplyPermissionResult

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 回复是否成功 |
| permissionId | string | 权限确认请求ID（成功时返回） |
| approved | boolean | 审批结果（成功时返回） |

### ControlSkillWeCodeResult

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 操作状态：success（成功）、failed（失败） |

### SkillSession

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 会话ID（服务端返回） |
| userId | number | 用户ID |
| skillDefinitionId | number | 技能定义ID |
| agentId | number | PCAgent ID |
| toolSessionId | string | OpenCode工具会话ID |
| title | string | 会话标题 |
| status | string | 会话状态：ACTIVE（活跃）、IDLE（空闲）、CLOSED（已关闭） |
| imChatId | string | IM聊天ID |
| createdAt | string | 创建时间 |
| lastActiveAt | string | 最后活跃时间 |

### PageResult\<T\>

| 字段 | 类型 | 说明 |
|------|------|------|
| content | Array\<T\> | 当前页数据列表 |
| totalElements | number | 总记录数 |
| totalPages | number | 总页数 |
| number | number | 当前页码（从0开始） |
| size | number | 每页大小 |

### PermissionRequest

| 字段 | 类型 | 说明 |
|------|------|------|
| permissionId | string | 权限确认请求ID |
| sessionId | number | 会话ID |
| action | string | 需要授权的操作描述 |
| approved | boolean | 审批结果 |

