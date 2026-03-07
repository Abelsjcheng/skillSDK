# 小程序 JSAPI 接口文档

## 概述

本文档描述了小程序通过 `window.HWH5` 对象调用的 Skill SDK JSAPI 接口定义。小程序可通过这些接口与 Skill 原 sdk进行交互，实现技能执行、消息收发、会话管理等功能。

---

## 接口列表

| 接口名 | 说明 |
|--------|------|
| [regenerateAnswer](#1-regenerateanswer) | 重新生成回答 |
| [sendMessageToIM](#2-sendmessagetoim) | 发送AI生成消息结果到IM |
| [getSessionMessage](#3-getsessionmessage) | 获取当前会话的消息列表 |
| [registerSessionListener](#4-registersessionlistener) | 注册会话监听器 |
| [unregisterSessionListener](#5-unregistersessionlistener) | 移除会话监听器 |
| [sendMessage](#6-sendmessage) | 发送消息内容 |
| [controlSkillWeCode](#7-controlskillwecode) | 小程序控制 |

---

## 1. regenerateAnswer

### 接口说明

根据提供的内容重新生成回答，用于用户对回答结果不满意时触发重新回答。该接口会清除当前正在生成的响应，重新触发AI处理流程。

### 调用方式

```javascript
window.HWH5.regenerateAnswer(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 重新生成的消息内容 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| messageId | string | 消息ID，用于标识该回答（成功时返回） |

### 返回示例

成功时：

```json
{
  "messageId": "msg-xyz789"
}
```

失败时：

```json
{
  "errorMessage": "消息内容为空"
}
```

### 调用示例

```javascript
// 重新生成回答
window.HWH5.regenerateAnswer({
  sessionId: '42',
  content: '请重新分析这个问题并提供更详细的方案'
}).then(result => {
  console.log('重新生成已启动，消息ID:', result.messageId);
}).catch(error => {
  console.error('重新生成失败:', error.errorMessage);
});
```

---

## 2. sendMessageToIM

### 接口说明

将AI生成的消息结果发送到IM客户端，用于将Skill服务端的回答内容同步到IM会话中。通过调用服务端API，将消息内容转发到会话关联的IM聊天中。

### 调用方式

```javascript
window.HWH5.sendMessageToIM(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | AI生成的消息内容 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 发送是否成功 |
| chatId | string | IM聊天ID（成功时返回） |
| contentLength | number | 发送内容的字符长度（成功时返回） |
| errorMessage | string | 错误信息（失败时返回） |

### 返回示例

成功时：

```json
{
  "success": true,
  "chatId": "chat-789",
  "contentLength": 22
}
```

失败时：

```json
{
  "success": false,
  "errorMessage": "会话不存在"
}
```

### 调用示例

```javascript
// 发送AI生成的消息到IM
window.HWH5.sendMessageToIM({
  sessionId: '42',
  content: '代码重构已完成，请查看 PR #42'
}).then(result => {
  if (result.success) {
    console.log('消息已发送到IM，聊天ID:', result.chatId);
    console.log('内容长度:', result.contentLength);
  } else {
    console.error('发送失败:', result.errorMessage);
  }
}).catch(error => {
  console.error('发送消息到IM失败:', error.errorMessage);
});
```

---

## 3. getSessionMessage

### 接口说明

获取当前会话的消息列表，将数据持久化存储到本地。分页查询指定会话的消息历史记录，包括用户消息和AI回答。

### 调用方式

```javascript
window.HWH5.getSessionMessage(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| sessionId | string | 是 | - | 会话ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array\<ChatMessage\> | 历史消息列表，包含用户消息和AI回答 |
| totalElements | number | 总记录数 |
| totalPages | number | 总页数 |
| number | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |

### ChatMessage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息ID |
| sessionId | number | 会话ID |
| seq | number | 会话内消息序号 |
| role | string | 角色：USER（用户）/ ASSISTANT（AI）/ SYSTEM（系统）/ TOOL（工具） |
| content | string | 消息内容 |
| contentType | string | 内容类型：MARKDOWN / CODE / PLAIN |
| createdAt | string | 创建时间（ISO 8601格式） |
| meta | string | 扩展元数据（JSON格式） |

### 返回示例

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

### 调用示例

```javascript
// 获取会话消息列表
window.HWH5.getSessionMessage({
  sessionId: '42',
  page: 0,
  size: 50
}).then(result => {
  console.log('总消息数:', result.totalElements);
  console.log('当前页:', result.number);
  
  result.content.forEach(message => {
    console.log(`[${message.role}] ${message.content}`);
  });
}).catch(error => {
  console.error('获取消息列表失败:', error.errorMessage);
});
```

---

## 4. registerSessionListener

### 接口说明

注册会话监听器，用于接收WebSocket推送的AI响应流、错误信息和连接关闭事件。该接口仅注册监听器，不会自动建立WebSocket连接。WebSocket连接由 `executeSkill` 接口建立。

### 调用方式

```javascript
window.HWH5.registerSessionListener(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| onMessage | function | 是 | 消息回调函数，接收AI响应流 |
| onError | function | 否 | 错误回调函数，接收错误信息 |
| onClose | function | 否 | 连接关闭回调函数 |

### StreamMessage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话ID，用于区分不同会话的消息 |
| type | string | 消息类型：delta（增量）/ done（完成）/ error（错误）/ agent_offline / agent_online |
| seq | number | 递增序列号 |
| content | string/object | 消息内容 |
| usage | object | token用量统计（仅done类型） |

### SessionError 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | 错误码 |
| message | string | 错误消息 |
| timestamp | number | 时间戳 |

### 调用示例

```javascript
// 定义回调函数
const onMessage = (message) => {
  // 根据sessionId区分不同会话的消息
  console.log('会话ID:', message.sessionId);
  
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
    case 'agent_offline':
      console.warn('Agent离线');
      break;
    case 'agent_online':
      console.log('Agent上线');
      break;
  }
};

const onError = (error) => {
  console.error('连接错误:', error.code, error.message);
};

const onClose = (reason) => {
  console.log('连接关闭:', reason);
};

// 注册监听器
window.HWH5.registerSessionListener({
  sessionId: '42',
  onMessage: onMessage,
  onError: onError,
  onClose: onClose
});

console.log('监听器注册成功');
```

---

## 5. unregisterSessionListener

### 接口说明

移除已注册的会话监听器。当监听器不再需要接收消息时调用，例如小程序关闭或切换页面时。

### 调用方式

```javascript
window.HWH5.unregisterSessionListener(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| onMessage | function | 是 | 要移除的消息回调函数 |
| onError | function | 否 | 要移除的错误回调函数 |
| onClose | function | 否 | 要移除的连接关闭回调函数 |

### 调用示例

```javascript
// 保存回调函数引用
const onMessage = (message) => {
  console.log('收到消息:', message);
};

const onError = (error) => {
  console.error('错误:', error);
};

const onClose = (reason) => {
  console.log('关闭:', reason);
};

// 注册监听器
window.HWH5.registerSessionListener({
  sessionId: '42',
  onMessage: onMessage,
  onError: onError,
  onClose: onClose
});

// 页面卸载时移除监听器
window.HWH5.unregisterSessionListener({
  sessionId: '42',
  onMessage: onMessage,
  onError: onError,
  onClose: onClose
});

console.log('监听器已移除');
```

---

## 6. sendMessage

### 接口说明

发送用户输入的内容，触发会话的持续回答，用于多轮对话场景。该接口会先发送消息到服务端，然后通过WebSocket接收AI的流式响应。

### 调用方式

```javascript
window.HWH5.sendMessage(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sessionId | string | 是 | 会话ID |
| content | string | 是 | 用户输入的消息内容 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| messageId | number | 消息ID（成功时返回） |
| seq | number | 会话内消息序号（成功时返回） |
| createdAt | string | 消息创建时间（成功时返回） |

### 返回示例

成功时：

```json
{
  "messageId": 1,
  "seq": 1,
  "createdAt": "2026-03-06T10:30:00"
}
```

失败时：

```json
{
  "errorMessage": "会话已关闭"
}
```

### 调用示例

```javascript
// 发送消息
window.HWH5.sendMessage({
  sessionId: '42',
  content: '请帮我重构登录模块的校验逻辑'
}).then(result => {
  console.log('消息发送成功，消息ID:', result.messageId);
  console.log('消息序号:', result.seq);
  console.log('创建时间:', result.createdAt);
  
  // AI响应将通过 registerSessionListener 注册的回调接收
}).catch(error => {
  console.error('发送消息失败:', error.errorMessage);
});
```

---

## 7. controlSkillWeCode

### 接口说明

执行小程序的关闭或最小化操作，用于控制小程序的生命周期。该接口直接控制OpenCode小程序的显示状态。

### 调用方式

```javascript
window.HWH5.controlSkillWeCode(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | string | 是 | 操作类型：`close`（关闭）、`minimize`（最小化） |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作状态：`success`（成功）、`failed`（失败） |

### 返回示例

成功时：

```json
{
  "status": "success"
}
```

失败时：

```json
{
  "status": "failed",
  "errorMessage": "小程序未处于活跃状态"
}
```

### 调用示例

```javascript
// 关闭小程序
window.HWH5.controlSkillWeCode({
  action: 'close'
}).then(result => {
  if (result.status === 'success') {
    console.log('小程序已关闭');
    // 会自动调用 closeSkill 关闭会话
  }
}).catch(error => {
  console.error('关闭小程序失败:', error.errorMessage);
});

// 最小化小程序
window.HWH5.controlSkillWeCode({
  action: 'minimize'
}).then(result => {
  if (result.status === 'success') {
    console.log('小程序已最小化');
    // WebSocket连接保持，可后续恢复
  }
}).catch(error => {
  console.error('最小化小程序失败:', error.errorMessage);
});
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| CONTENT_EMPTY | 消息内容为空 |
| SESSION_NOT_FOUND | 会话不存在 |
| SESSION_CLOSED | 会话已关闭 |
| WEBSOCKET_ERROR | WebSocket连接错误 |
| NETWORK_ERROR | 网络错误 |
| WECODE_NOT_ACTIVE | 小程序未处于活跃状态 |

---

## 注意事项

1. **时序安全**：`registerSessionListener` 可以在任何时机调用，SDK会确保不遗漏消息
2. **监听器管理**：建议保存回调函数引用，以便后续移除
3. **错误处理**：所有接口都返回 Promise，请使用 `.catch()` 处理错误
4. **资源释放**：页面卸载时务必调用 `unregisterSessionListener` 移除监听器
