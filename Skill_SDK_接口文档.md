# Skill SDK 工程文档

## 概述

本文档描述了用于IM客户端、OpenCode Skill服务端、小程序间交互的鸿蒙ArkTS SDK接口定义。

---

## 1. 执行技能接口

### 接口说明

与Skill服务端建立WebSocket会话连接，并发送用户消息到服务端触发AI处理。

### 接口名

```typescript
executeSkill(imChatId: string, userId: string, skillContent: string, agentId?: number, title?: string): Promise<SkillSession>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| imChatId | string | 是 | IM聊天ID |
| userId | string | 是 | 用户ID |
| agentId | number | 否 | PCAgent ID，提供时将触发 AI-Gateway 创建 OpenCode 会话 |
| title | string | 否 | 会话标题 |
| skillContent | string | 是 | 用户输入的Skill指令内容，即用户发起技能请求的输入 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| sessionId | string | 会话ID，用于后续对该会话进行操作 |
| status | SessionStatus | 会话状态 |
| toolSessionId | string | OpenCode工具会话ID（由AI-Gateway返回） |
| createdAt | number | 创建时间戳 |

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

2. 建立WebSocket流式连接：
   - **URL**: `ws://{host}:8082/ws/skill/stream/{sessionId}`
   - 用于接收服务端推送的AI响应流（增量内容、完成通知、错误信息等）

3. 根据skillContent，自动发送首条用户消息触发AI处理：
   - 调用 `POST /api/skill/sessions/{sessionId}/messages`
   - 请求体: `{ "content": skillContent }`

---

## 2. 关闭技能接口

### 接口说明

关闭与Skill服务端的WebSocket会话连接，释放资源。关闭会话后，该会话将不再接受新的消息，也无法恢复。

### 接口名

```typescript
closeSkill(sessionId: string): Promise<boolean>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 要关闭的会话ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 关闭是否成功 |

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

---

## 3. 停止技能接口

### 接口说明

停止Skill服务端WebSocket会话的持续回调，中断当前正在进行的回答生成，但保持会话连接。调用此接口后，会话状态将变为`stopped`，用户可以后续发送新消息继续对话。

### 接口名

```typescript
stopSkill(sessionId: string): Promise<boolean>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 要停止的会话ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 停止操作是否成功 |

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

---

## 4. 会话状态回调接口

### 接口说明

获取会话状态的实时回调，包括执行中、停止、完成三种状态。通过注册回调函数的方式获取状态变化通知。该回调基于WebSocket连接，当服务端推送消息时，会附带当前会话状态。

### 接口名

```typescript
onSessionStatus(sessionId: string, callback: (status: SessionStatus) => void): void
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

### 实现方法

1. 建立WebSocket流式连接：
   - **URL**: `ws://{host}:8082/ws/skill/stream/{sessionId}`
   - 连接时自动订阅该会话的消息流

2. 监听WebSocket消息，根据消息类型更新会话状态：

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

4. 连接行为：
   - 支持多客户端订阅同一会话
   - 连接关闭时自动取消订阅
   - 若该会话无剩余订阅者，清理序列计数器

### 错误处理

| 场景 | 说明 |
|------|------|
| 连接缺少sessionId | 服务端立即关闭连接 |
| 传输错误 | 自动移除故障连接 |

---

## 5. 小程序状态回调接口

### 接口说明

监听小程序的状态变化，当小程序被关闭或缩小到后台时触发回调，通知上层应用进行相应处理。该回调用于处理用户主动关闭小程序或系统触发的小程序后台化事件。

### 接口名

```typescript
onSkillWecodeStatus(callback: (status: SkillWecodeStatus) => void): void
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| callback | function | 是 | 小程序状态变更回调函数 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | SkillWecodeStatus | 小程序状态，枚举值：closed（关闭）、minimized（缩小） |

### 实现方法

1. 注册系统级生命周期事件监听器（鸿蒙原生能力）

2. 监听以下事件：
   - **小程序关闭**: 用户主动关闭小程序或调用`closeSkill`
   - **小程序最小化**: 用户将小程序切换到后台或系统锁屏


### 处理逻辑

| 状态 | 触发场景 | SDK行为 |
|------|----------|---------|
| closed | 用户关闭小程序 | 断开WebSocket，调用`closeSkill` |
| minimized | 小程序进入后台 | 保持连接，会话状态设为IDLE |

---

## 6. 重新生成问答接口

### 接口说明

根据当前会话的最后一条用户消息内容重新生成回答，用于用户对回答结果不满意时触发重新回答。该接口会清除当前正在生成的响应，重新触发AI处理流程。

### 接口名

```typescript
regenerateAnswer(sessionId: string): Promise<AnswerResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| messageId | string | 消息ID，用于标识该回答 |
| success | boolean | 重新生成是否成功启动 |

### 实现方法

1. 获取会话的最后一条用户消息（通过`getSessionMessage`获取）

2. 调用服务端REST API发送用户消息（使用最后一条消息内容）：
   - **URL**: `POST /api/skill/sessions/{sessionId}/messages`
   - **请求体**:
     ```json
     {
       "content": "{最后一条用户消息内容}"
     }
     ```

3. 通过WebSocket流式连接接收AI重新生成的响应

### 注意事项

- 该接口需要确保WebSocket流式连接已建立
- 重新生成会消耗新的token配额
- 适用于AI回答不完整或不满意的情况

---

## 7. 发送AI生成消息结果接口

### 接口说明

将AI生成的消息结果发送到IM客户端，用于将Skill服务端的回答内容同步到IM会话中。通过调用服务端API，将消息内容转发到会话关联的IM聊天中。

### 接口名

```typescript
sendMessageToIM(sessionId: string, content: string): Promise<boolean>
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

---

## 8. 获取当前会话的消息列表接口

### 接口说明

获取当前会话的消息列表，将数据持久化存储到本地。分页查询指定会话的消息历史记录，包括用户消息和AI回答。

### 接口名

```typescript
getSessionMessage(sessionId: string, page?: number, size?: number): Promise<PageResult<ChatMessage>>
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

---

## 9. 发送消息接口

### 接口说明

发送用户输入的内容，触发会话的持续回答，用于多轮对话场景。同时注册消息监听器，持续获取服务端推送的回答内容。该接口会先发送消息到服务端，然后通过WebSocket接收AI的流式响应。

### 接口名

```typescript
sendMessage(sessionId: string, content: string, onMessage: (message: StreamMessage) => void): Promise<boolean>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 用户输入的消息内容 |
| onMessage | function | 是 | 消息监听回调函数，持续接收服务端推送的回答内容 |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 发送是否成功 |

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

---

## 10. 权限确认接口

### 接口说明

对AI发起的权限确认请求进行批准或拒绝。当AI需要执行文件修改、命令执行等敏感操作时，会发送权限确认请求。前端收到后展示确认UI，用户决策后调用此接口回复。

### 接口名

```typescript
replyPermission(sessionId: string, permissionId: string, approved: boolean): Promise<boolean>
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

---

## 11. 小程序控制接口

### 接口说明

执行小程序的关闭或最小化操作，用于控制小程序的生命周期。该接口直接控制OpenCode小程序的显示状态。

### 接口名

```typescript
controlSkillWeCode(action: SkillWeCodeAction): Promise<boolean>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | SkillWeCodeAction | 是 | 操作类型：close（关闭）、minimize（最小化） |

### 出参

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 操作是否成功 |

### 实现方法

1. **close - 关闭小程序**:
   - 调用鸿蒙原生窗口管理API关闭小程序
   - 同时调用`closeSkill`关闭Skill会话
   - 断开WebSocket连接
   - 释放所有相关资源

2. **minimize - 最小化小程序**:
   - 调用鸿蒙原生窗口管理API将小程序最小化到后台
   - 会话状态保持不变（IDLE）
   - 保持WebSocket连接以便后续恢复

### 与其他接口的关系

| 操作 | 调用接口 | 说明 |
|------|----------|------|
| 关闭小程序 | `controlSkillWeCode(close)` + `closeSkill` | 完全释放资源 |
| 最小化小程序 | `controlSkillWeCode(minimize)` | 保持会话，可恢复 |
| 停止AI生成 | `stopSkill` | 仅停止流式推送，不改变小程序状态 |

## 数据类型定义

### SessionStatus

| 枚举值 | 说明 |
|--------|------|
| executing | 执行中 |
| stopped | 已停止 |
| completed | 已完成 |

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

