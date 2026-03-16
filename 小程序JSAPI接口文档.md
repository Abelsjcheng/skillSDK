# 小程序 JSAPI 接口文档

## 概述

本文档描述小程序通过 `window.HWH5EXT` 调用的 Skill SDK JSAPI。
JSAPI 是对客户端 SDK（`SkillClientSdkInterfaceV1.md`）的二次封装，接口语义、字段命名与 SDK V1 对齐。

说明：
- ID 字段（如 `welinkSessionId` / `messageId` / `permId`）按 SDK V1 统一使用 `string`。
- 小程序端调用使用 `window.HWH5EXT`。
- PC 端调用统一使用：

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'JSAPI名字', params})
```

---

## 接口列表

| 接口名 | 说明 |
|--------|------|
| [regenerateAnswer](#1-regenerateanswer) | 重新生成回答 |
| [sendMessageToIM](#2-sendmessagetoim) | 发送 AI 生成消息结果到 IM |
| [getSessionMessage](#3-getsessionmessage) | 获取当前会话的消息列表 |
| [registerSessionListener](#4-registersessionlistener) | 注册会话监听器 |
| [unregisterSessionListener](#5-unregistersessionlistener) | 移除会话监听器 |
| [sendMessage](#6-sendmessage) | 发送消息内容 |
| [stopSkill](#7-stopskill) | 停止当前轮技能生成 |
| [replyPermission](#8-replypermission) | 权限确认回复 |
| [controlSkillWeCode](#9-controlskillwecode) | 小程序控制 |

---

## 1. regenerateAnswer

### 接口说明

根据当前会话最后一条用户消息重新触发回答生成。

### 调用方式

```javascript
window.HWH5EXT.regenerateAnswer(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'regenerateAnswer', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |

### 返回值

返回 Promise，resolve 数据与 `sendMessage` 一致（`SendMessageResult`）：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | string | 消息 ID |
| welinkSessionId | string | 所属会话 ID |
| seq | number \| null | 数据库排序序号，用户消息可能为 `null` |
| messageSeq | number \| null | 会话内消息序号 |
| role | string | 当前服务端返回值为 `user` / `assistant` |
| content | string \| null | 消息内容 |
| contentType | string \| null | 内容类型：`plain` / `markdown` |
| createdAt | string | 创建时间，ISO-8601 |
| meta | object \| null | 元信息（tokens、cost 等） |
| parts | Array<SessionMessagePart> \| null | 消息 Part 列表 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4001 | 会话已关闭 | 会话已关闭，无法重新生成 |
| 4002 | 无用户消息 | 会话中没有可用于重新生成的用户消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.regenerateAnswer({
  welinkSessionId: '42'
}).then((result) => {
  console.log('重新生成已启动，消息 ID:', result.id);
}).catch((error) => {
  console.error('重新生成失败:', error.errorCode, error.errorMessage);
});
```

---

## 2. sendMessageToIM

### 接口说明

将会话中“已完成”的消息内容发送到 IM 聊天。

说明：
- 若传 `messageId`，SDK 按该消息 ID 从本地缓存取已完成内容。
- 若不传 `messageId`，SDK 取当前会话最后一条已完成消息。
- `chatId` 为可选透传字段，SDK 不做会话 `imGroupId` 到 `chatId` 的自动映射。

### 调用方式

```javascript
window.HWH5EXT.sendMessageToIM(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'sendMessageToIM', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| messageId | string | 否 | 要发送到 IM 的消息 ID；不传则默认最后一条已完成消息 |
| chatId | string | 否 | 目标 IM 群组 ID，SDK 仅透传 |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 发送是否成功（服务端字段） |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4003 | 消息不存在 | 指定消息在缓存中不存在 |
| 4004 | 消息未完成 | 指定消息尚未完成 |
| 4005 | 无完成消息 | 会话中没有已完成消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.sendMessageToIM({
  welinkSessionId: '42',
  messageId: 'm_2',
  chatId: 'group_abc123'
}).then((result) => {
  if (result.success) {
    console.log('发送到 IM 成功');
  }
}).catch((error) => {
  console.error('发送到 IM 失败:', error.errorCode, error.errorMessage);
});
```

---

## 3. getSessionMessage

### 接口说明

获取当前会话消息列表。
SDK 会将服务端历史消息与本地尚未落库的流式缓存按规则合并后返回，避免漏掉“进行中”消息。

### 调用方式

```javascript
window.HWH5EXT.getSessionMessage(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getSessionMessage', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| welinkSessionId | string | 是 | - | 会话 ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 20 | 每页条数 |
| isFirst | boolean | 否 | false | 是否首次获取。`true` 时合并本地流式缓存并将该消息插入返回 `content` 首位；`false` 时直接返回服务端内容（保持服务端时间降序） |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<SessionMessage> | 历史消息列表（按时间降序：从最新到最旧） |
| page | number | 当前页码（从 0 开始，透传服务端返回） |
| size | number | 每页大小（透传服务端返回） |
| total | number | 总记录数（透传服务端返回） |
| totalPages | number | 总页数（透传服务端返回） |

### 行为说明

1. 当 `isFirst=false` 时：直接返回服务端 `content`（保持服务端原始顺序，不做二次重排）。
2. 当 `isFirst=true` 时：SDK 会将本地流式缓存中的聚合消息与服务端历史消息去重合并，并将本地聚合消息插入 `content[0]`。
3. 去重依据为稳定消息 ID（`messageId` 或 `snapshot.messages[].id`）。
4. `page` / `size` / `total` / `totalPages` 始终透传服务端返回值，不因本地首位插入消息变化。
5. 以下传输层事件不参与 `SessionMessage` 聚合：`session.status` / `session.title` / `session.error` / `agent.online` / `agent.offline` / `error`。

### SessionMessage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 稳定消息 ID |
| seq | number \| null | 数据库排序序号，用户消息可能为 `null` |
| welinkSessionId | string | 所属会话 ID |
| role | string | 角色：`user` / `assistant` / `system` / `tool` |
| content | string \| null | 聚合后的消息文本 |
| contentType | string \| null | `plain` / `markdown` |
| meta | object \| null | 元信息（tokens、cost 等） |
| messageSeq | number \| null | 会话内消息顺序 |
| parts | Array<SessionMessagePart> \| null | 消息部件 |
| createdAt | string | 创建时间，ISO-8601 |

### SessionMessagePart 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string | Part 唯一 ID |
| partSeq | number | Part 在消息内顺序 |
| type | string | `text` / `thinking` / `tool` / `question` / `permission` / `file` |
| content | string \| null | 文本内容 |
| toolName | string \| null | 工具名 |
| toolCallId | string \| null | 工具调用 ID（`tool` / `question`） |
| input | object \| null | 输入参数 |
| output | string \| null | 工具输出 |
| error | string \| null | 工具错误 |
| title | string \| null | 工具/权限标题 |
| header | string \| null | question 分组标题 |
| question | string \| null | 问题正文 |
| options | string[] \| null | 选项 |
| permissionId | string \| null | 权限请求 ID |
| permType | string \| null | 权限类型 |
| metadata | object \| null | 权限元数据 |
| response | string \| null | 权限回复（`once` / `always` / `reject`） |
| status | string \| null | 状态字段（按 type 出现） |
| fileName | string \| null | 文件名 |
| fileUrl | string \| null | 文件 URL |
| fileMime | string \| null | 文件 MIME |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.getSessionMessage({
  welinkSessionId: '42',
  page: 0,
  size: 50,
  isFirst: true
}).then((result) => {
  console.log('总消息数:', result.total);
  console.log('当前页:', result.page);
  result.content.forEach((message) => {
    console.log(`[${message.role}] ${message.content ?? ''}`);
  });
}).catch((error) => {
  console.error('获取消息列表失败:', error.errorCode, error.errorMessage);
});
```

---

## 4. registerSessionListener

### 接口说明

注册会话监听器，用于接收 WebSocket 推送事件流。

说明：
- 同一个 `welinkSessionId` 只允许注册一次监听器。
- 重复注册不会报错，SDK 会 no-op，并返回成功语义。
- 可在任意时机注册，SDK 保证时序安全，不因注册时机导致漏消息。

### 调用方式

```javascript
window.HWH5EXT.registerSessionListener(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'registerSessionListener', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| onMessage | function | 是 | 消息回调，参数类型 `StreamMessage` |
| onError | function | 否 | 错误回调，参数类型 `SessionError` |
| onClose | function | 否 | 连接关闭回调，参数 `reason: string` |

### 返回值

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作结果，固定为 `success` |

> 注：部分宿主可能不消费该返回值，但语义上等同 `success`。

### SessionError 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | 错误码 |
| message | string | 错误信息 |
| timestamp | number | 时间戳（毫秒） |

### StreamMessage 结构

#### 公共字段

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 事件类型 |
| seq | number \| null | 递增序列号（部分事件可能无） |
| welinkSessionId | string | 所属会话 ID |
| emittedAt | string \| null | 事件产生时间，ISO-8601（部分事件可能无） |

#### 消息级字段（按事件返回）

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | string \| null | 稳定消息 ID |
| sourceMessageId | string \| null | 源消息 ID |
| messageSeq | number \| null | 会话内消息顺序 |
| role | string \| null | 当前服务端返回值为 `user` / `assistant` |

#### Part级字段（按事件返回）

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string \| null | Part 唯一 ID |
| partSeq | number \| null | Part 顺序 |

#### 常用附加字段（按事件返回）

| 字段 | 类型 | 说明 |
|------|------|------|
| content | string \| null | 文本内容 |
| toolName | string \| null | 工具名 |
| toolCallId | string \| null | 工具调用 ID |
| status | string \| null | 状态字段（工具/问题） |
| input | object \| null | 输入参数 |
| output | string \| null | 输出结果 |
| error | string \| null | 错误描述 |
| title | string \| null | 工具/会话标题 |
| header | string \| null | question 分组标题 |
| question | string \| null | question 正文 |
| options | string[] \| null | question 选项 |
| permissionId | string \| null | 权限请求 ID |
| permType | string \| null | 权限类型 |
| metadata | object \| null | 权限元数据 |
| response | string \| null | 权限回复值 |
| fileName | string \| null | 文件名 |
| fileUrl | string \| null | 文件 URL |
| fileMime | string \| null | MIME |
| tokens | object \| null | token 统计 |
| cost | number \| null | 本步骤费用 |
| reason | string \| null | 结束原因 |
| sessionStatus | string \| null | 服务端原始状态：`busy` / `idle` / `retry` |
| messages | array \| null | `snapshot` 携带的已完成消息快照 |
| parts | array \| null | `streaming` 携带的进行中消息部件 |

### 事件类型

`text.delta` / `text.done` / `thinking.delta` / `thinking.done` / `tool.update` / `question` / `file` / `step.start` / `step.done` / `session.status` / `session.title` / `session.error` / `permission.ask` / `permission.reply` / `agent.online` / `agent.offline` / `error` / `snapshot` / `streaming`

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` 或 `onMessage` |

### 调用示例

```javascript
const onMessage = (message) => {
  switch (message.type) {
    case 'text.delta':
      console.log('AI 响应片段:', message.content);
      break;
    case 'tool.update':
      console.log('工具状态:', message.toolName, message.status);
      break;
    case 'question':
      console.log('AI 提问:', message.question, message.toolCallId);
      break;
    case 'snapshot':
      console.log('断线恢复快照消息数:', message.messages?.length || 0);
      break;
    case 'error':
    case 'session.error':
      console.error('处理错误:', message.error);
      break;
  }
};

window.HWH5EXT.registerSessionListener({
  welinkSessionId: '42',
  onMessage,
  onError: (err) => console.error('连接错误:', err.code, err.message),
  onClose: (reason) => console.log('连接关闭:', reason)
});
```

---

## 5. unregisterSessionListener

### 接口说明

移除会话监听器。

说明：
- 仅需传 `welinkSessionId`。
- 会移除该会话下已注册的 `onMessage` / `onError` / `onClose` 全部监听。
- 该接口仅移除监听器，不关闭 WebSocket 连接。

### 调用方式

```javascript
window.HWH5EXT.unregisterSessionListener(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'unregisterSessionListener', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |

### 返回值

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作结果，固定为 `success` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` |
| 4006 | 监听器不存在 | 当前会话未注册监听器 |

### 调用示例

```javascript
window.HWH5EXT.unregisterSessionListener({
  welinkSessionId: '42'
});
```

---

## 6. sendMessage

### 接口说明

发送用户输入内容，触发会话新一轮回答。
AI 响应通过 `registerSessionListener` 的回调返回。

### 调用方式

```javascript
window.HWH5EXT.sendMessage(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'sendMessage', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| content | string | 是 | 用户输入内容 |
| toolCallId | string | 否 | 回答 AI `question` 时携带的工具调用 ID |

### 返回值

返回 Promise，resolve 数据（`SendMessageResult`）：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | string | 消息 ID |
| welinkSessionId | string | 所属会话 ID |
| seq | number \| null | 数据库排序序号 |
| messageSeq | number \| null | 会话内消息序号 |
| role | string | 当前服务端返回值为 `user` / `assistant` |
| content | string \| null | 消息内容 |
| contentType | string \| null | 内容类型：`plain` / `markdown` |
| createdAt | string | 创建时间，ISO-8601 |
| meta | object \| null | 元信息 |
| parts | Array<SessionMessagePart> \| null | 消息 Part 列表 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 或 `content` 缺失/格式错误 |
| 4001 | 会话已关闭 | 会话已关闭，无法发送 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |
| 7001 | AI 网关错误 | AI Gateway 调度失败 |

### 调用示例

```javascript
window.HWH5EXT.sendMessage({
  welinkSessionId: '42',
  content: '请帮我重构登录模块的校验逻辑'
}).then((result) => {
  console.log('消息发送成功:', result.id);
}).catch((error) => {
  console.error('发送消息失败:', error.errorCode, error.errorMessage);
});
```

---

## 7. stopSkill

### 接口说明

停止指定会话“当前轮”回答生成。

说明：
- 仅中止当前轮执行。
- 不关闭会话，不断开 WebSocket。
- 停止后仍可继续发送新消息触发下一轮。

### 调用方式

```javascript
window.HWH5EXT.stopSkill(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'stopSkill', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| welinkSessionId | string | 会话 ID |
| status | string | 中止结果，成功时为 `aborted` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 4001 | 会话已关闭 | 会话已关闭，无法停止 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.stopSkill({
  welinkSessionId: '42'
}).then((result) => {
  if (result.status === 'aborted') {
    console.log('当前轮回答已停止');
  }
}).catch((error) => {
  console.error('停止会话失败:', error.errorCode, error.errorMessage);
});
```

---

## 8. replyPermission

### 接口说明

对 AI 发起的权限确认请求进行批准或拒绝。

### 调用方式

```javascript
window.HWH5EXT.replyPermission(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'replyPermission', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | string | 是 | 会话 ID |
| permId | string | 是 | 权限请求 ID |
| response | string | 是 | `once` / `always` / `reject` |

### response 值说明

| 值 | 说明 |
|----|------|
| `once` | 本次允许 |
| `always` | 永久允许 |
| `reject` | 拒绝 |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| welinkSessionId | string | 会话 ID |
| permissionId | string | 权限请求 ID |
| response | string | 回复值 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId` / `permId` 或 `response` 无效 |
| 4007 | 权限请求不存在 | 指定权限请求不存在 |
| 4008 | 权限请求已过期 | 权限请求已超时或已处理 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.replyPermission({
  welinkSessionId: '42',
  permId: 'perm_1',
  response: 'once'
}).then((result) => {
  console.log('权限确认结果:', result.response);
}).catch((error) => {
  console.error('回复权限确认失败:', error.errorCode, error.errorMessage);
});
```

---

## 9. controlSkillWeCode

### 接口说明

执行小程序关闭或最小化操作。

说明：
- `close` 仅处理小程序侧关闭逻辑。
- 如需释放 SDK WebSocket 资源，可在 `close` 成功后由上层继续调用 `closeSkill`。

### 调用方式

```javascript
window.HWH5EXT.controlSkillWeCode(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'controlSkillWeCode', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | string | 是 | `close` / `minimize` |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作状态：`success` / `failed` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `action` 缺失或无效 |
| 4009 | 小程序不存在 | 小程序未初始化或已关闭 |
| 4010 | 操作失败 | 小程序操作失败 |

### 调用示例

```javascript
window.HWH5EXT.controlSkillWeCode({
  action: 'close'
}).then((result) => {
  console.log('关闭结果:', result.status);
}).catch((error) => {
  console.error('关闭小程序失败:', error.errorCode, error.errorMessage);
});

window.HWH5EXT.controlSkillWeCode({
  action: 'minimize'
}).then((result) => {
  console.log('最小化结果:', result.status);
}).catch((error) => {
  console.error('最小化小程序失败:', error.errorCode, error.errorMessage);
});
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 1000 | 无效的参数 |
| 4001 | 会话已关闭 |
| 4002 | 无用户消息 |
| 4003 | 消息不存在 |
| 4004 | 消息未完成 |
| 4005 | 无完成消息 |
| 4006 | 监听器不存在 |
| 4007 | 权限请求不存在 |
| 4008 | 权限请求已过期 |
| 4009 | 小程序不存在 |
| 4010 | 操作失败 |
| 6000 | 网络错误 |
| 7000 | 服务端错误 |
| 7001 | AI 网关错误 |

---

## 注意事项

1. `registerSessionListener` 支持任意时机调用，SDK 会做时序安全处理，避免漏消息。
2. 同一 `welinkSessionId` 重复注册监听器时，SDK 不会重复注册，按成功语义处理。
3. 页面卸载时务必调用 `unregisterSessionListener` 释放监听器。
4. `stopSkill` 仅中止当前轮执行，不会关闭会话或断开 WebSocket。
5. `controlSkillWeCode` 仅控制小程序 UI 生命周期；会话与连接资源管理由上层决定。
