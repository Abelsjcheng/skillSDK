# 小程序 JSAPI 接口文档

## 概述

本文档描述了小程序通过 `window.HWH5EXT` 对象调用的 Skill SDK JSAPI 接口定义。小程序可通过这些接口与 Skill 服务端进行交互，实现技能执行、消息收发、会话管理等功能。

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
| [stopSkill](#7-stopskill) | 停止技能生成 |
| [replyPermission](#8-replypermission) | 权限确认回复 |
| [controlSkillWeCode](#9-controlskillwecode) | 小程序控制 |

---

## 1. regenerateAnswer

### 接口说明

根据当前会话的最后一条用户消息重新触发回答生成。

### 调用方式

```javascript
window.HWH5EXT.regenerateAnswer(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | number | 消息 ID |
| welinkSessionId | number | 所属会话 ID |
| userId | string | 发送用户 ID |
| role | string | 固定为 "user" |
| content | string | 重发的消息内容 |
| messageSeq | number | 该消息在会话内的顺序号 |
| createdAt | string | 创建时间，ISO-8601 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | welinkSessionId 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4001 | 会话已关闭 | 会话已被关闭，无法重新生成 |
| 4002 | 无用户消息 | 会话中没有用户消息可用于重新生成 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
// 重新生成回答
window.HWH5EXT.regenerateAnswer({
  welinkSessionId: 42
}).then(result => {
  console.log('重新生成已启动，消息 ID:', result.id);
}).catch(error => {
  console.error('重新生成失败:', error.errorCode, error.errorMessage);
});
```

---

## 2. sendMessageToIM

### 接口说明

将用户在 Skill 小程序中最终确认的文本内容发送到 IM 聊天，用于"选中文本发送到聊天"场景。

SDK 内部维护消息缓存，记录每条消息完成后的最终内容。调用此接口时，SDK 从缓存中获取消息的最终完整文本，然后发送到 IM。

### 调用方式

```javascript
window.HWH5EXT.sendMessageToIM(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| messageId | number | 否 | 要发送到 IM 的消息 ID，SDK 会从缓存中获取该消息的最终完整内容。不填则获取当前会话最后一条最终消息的内容 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 发送结果：success / failed |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | welinkSessionId 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4003 | 消息不存在 | 请求的消息在缓存中不存在 |
| 4004 | 消息未完成 | 请求的消息尚未收到完成事件 |
| 4005 | 无最终消息 | 会话中没有已完成的消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
// 发送 AI 生成的消息到 IM
window.HWH5EXT.sendMessageToIM({
  welinkSessionId: 42,
  messageId: 101
}).then(result => {
  if (result.status === 'success') {
    console.log('发送到 IM 成功');
  }
}).catch(error => {
  console.error('发送消息到 IM 失败:', error.errorCode, error.errorMessage);
});
```

---

## 3. getSessionMessage

### 接口说明

获取当前会话的消息列表。SDK 会将服务端历史消息与本地尚未落库的流式消息缓存合并后返回。

### 调用方式

```javascript
window.HWH5EXT.getSessionMessage(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| welinkSessionId | number | 是 | - | 会话 ID |
| page | number | 否 | 0 | 页码（从 0 开始） |
| size | number | 否 | 50 | 每页条数 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array\<SessionMessage\> | 历史消息列表 |
| page | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |
| total | number | 总记录数 |

### SessionMessage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息 ID |
| welinkSessionId | number | 所属会话 ID |
| userId | string \| null | 用户 ID |
| role | string | user / assistant / system / tool |
| content | string | 聚合后的消息内容 |
| messageSeq | number | 会话内消息顺序 |
| parts | Array\<SessionMessagePart\> | 消息部件列表 |
| createdAt | string | 创建时间，ISO-8601 |

### SessionMessagePart 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string | Part 唯一 ID |
| partSeq | number | Part 在消息内的顺序 |
| type | string | text / thinking / tool / question / permission / file |
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

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | welinkSessionId 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
// 获取会话消息列表
window.HWH5EXT.getSessionMessage({
  welinkSessionId: 42,
  page: 0,
  size: 50
}).then(result => {
  console.log('总消息数:', result.total);
  console.log('当前页:', result.page);
  
  result.content.forEach(message => {
    console.log(`[${message.role}] ${message.content}`);
  });
}).catch(error => {
  console.error('获取消息列表失败:', error.errorCode, error.errorMessage);
});
```

---

## 4. registerSessionListener

### 接口说明

注册会话监听器，用于接收 WebSocket 推送的完整事件流、错误信息和连接关闭事件。该接口独立于消息发送操作，支持在任何时机注册监听器，SDK 会确保不会因调用时序问题遗漏消息。

### 调用方式

```javascript
window.HWH5EXT.registerSessionListener(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| onMessage | function | 是 | 消息回调函数，接收 StreamMessage |
| onError | function | 否 | 错误回调函数，接收错误信息 |
| onClose | function | 否 | 连接关闭回调函数 |

### StreamMessage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 事件类型 |
| seq | number | 递增序列号 |
| welinkSessionId | string | 所属会话 ID |
| emittedAt | string | 事件产生时间，ISO-8601 |
| raw | object | 原始 OpenCode 事件，仅调试用 |
| messageId | string | 稳定消息 ID |
| messageSeq | number | 会话内消息顺序 |
| role | string | user / assistant / system / tool |
| partId | string | Part 唯一 ID |
| partSeq | number | Part 在消息内的顺序 |
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
| sessionStatus | string | 服务端原始状态：busy / idle / retry |
| permissionId | string | 权限请求 ID |
| permType | string | 权限类型 |
| metadata | object | 权限请求详情 |
| response | string | 权限回复值：once / always / reject |
| messages | array | snapshot 携带的已完成消息快照 |
| parts | array | streaming 携带的进行中消息部件 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 welinkSessionId 或 onMessage |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |

### 调用示例

```javascript
// 定义回调函数
const onMessage = (message) => {
  // 根据 welinkSessionId 区分不同会话的消息
  console.log('会话 ID:', message.welinkSessionId);
  
  switch (message.type) {
    case 'text.delta':
      console.log('AI 响应片段:', message.content);
      break;
    case 'tool.update':
      console.log('工具状态:', message.toolName, message.status);
      break;
    case 'question':
      console.log('AI 提问:', message.question);
      break;
    case 'permission.ask':
      console.log('权限请求:', message.permissionId, message.title);
      break;
    case 'session.status':
      console.log('原始会话状态:', message.sessionStatus);
      break;
    case 'snapshot':
      console.log('收到断线恢复快照，消息数:', message.messages.length);
      break;
    case 'session.error':
    case 'error':
      console.error('处理错误:', message.error);
      break;
  }
};

const onError = (error) => {
  console.error('连接错误:', error.errorCode, error.errorMessage);
};

const onClose = (reason) => {
  console.log('连接关闭:', reason);
};

// 注册监听器
window.HWH5EXT.registerSessionListener({
  welinkSessionId: 42,
  onMessage: onMessage,
  onError: onError,
  onClose: onClose
});

console.log('监听器注册成功');
```

---

## 5. unregisterSessionListener

### 接口说明

移除已注册的会话监听器。当监听器不再需要接收消息时调用，例如小程序关闭或页面销毁。

### 调用方式

```javascript
window.HWH5EXT.unregisterSessionListener(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| onMessage | function | 是 | 要移除的消息回调函数 |
| onError | function | 否 | 要移除的错误回调函数 |
| onClose | function | 否 | 要移除的连接关闭回调函数 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 welinkSessionId 或 onMessage |
| 4006 | 监听器不存在 | 指定的监听器未注册 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |

### 调用示例

```javascript
// 保存回调函数引用
const onMessage = (message) => {
  console.log('收到消息:', message);
};

const onError = (error) => {
  console.error('错误:', error.errorCode, error.errorMessage);
};

const onClose = (reason) => {
  console.log('关闭:', reason);
};

// 注册监听器
window.HWH5EXT.registerSessionListener({
  welinkSessionId: 42,
  onMessage: onMessage,
  onError: onError,
  onClose: onClose
});

// 页面卸载时移除监听器
window.HWH5EXT.unregisterSessionListener({
  welinkSessionId: 42,
  onMessage: onMessage,
  onError: onError,
  onClose: onClose
});

console.log('监听器已移除');
```

---

## 6. sendMessage

### 接口说明

发送用户输入内容，触发会话的新一轮回答。支持首次发送消息和后续多轮对话。AI 响应通过 `registerSessionListener` 注册的回调接收。

### 调用方式

```javascript
window.HWH5EXT.sendMessage(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| content | string | 是 | 用户输入的消息内容 |
| toolCallId | string | 否 | 回答 AI `question` 时携带对应的工具调用 ID |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | number | 消息 ID |
| welinkSessionId | number | 所属会话 ID |
| userId | string | 发送用户 ID |
| role | string | 固定为 "user" |
| content | string | 消息内容 |
| messageSeq | number | 该消息在会话内的顺序号 |
| createdAt | string | 创建时间，ISO-8601 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | welinkSessionId 或 content 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4001 | 会话已关闭 | 会话已被关闭，无法发送消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |
| 7001 | AI 网关错误 | AI-Gateway 调度失败 |

### 调用示例

#### 示例 1：首次发送消息（创建会话后）

```javascript
// 先创建会话
// 然后发送首条消息
window.HWH5EXT.sendMessage({
  welinkSessionId: 42,
  content: '帮我创建一个React项目'
}).then(result => {
  console.log('消息发送成功:', result.id);
  console.log('创建时间:', result.createdAt);
  
  // AI 响应将通过 registerSessionListener 注册的回调接收
}).catch(error => {
  console.error('发送消息失败:', error.errorCode, error.errorMessage);
});
```

#### 示例 2：后续多轮对话

```javascript
window.HWH5EXT.sendMessage({
  welinkSessionId: 42,
  content: '请帮我重构登录模块的校验逻辑'
}).then(result => {
  console.log('消息发送成功:', result.id);
  console.log('创建时间:', result.createdAt);
  
  // AI 响应将通过 registerSessionListener 注册的回调接收
}).catch(error => {
  console.error('发送消息失败:', error.errorCode, error.errorMessage);
});
```

---

## 7. stopSkill

### 接口说明

停止指定会话当前轮回答生成，但保持 WebSocket 连接和 Skill 会话本身继续可用。调用后用户仍可继续发送新消息。

### 调用方式

```javascript
window.HWH5EXT.stopSkill(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| welinkSessionId | number | 会话 ID |
| status | string | 中止结果，成功时为 `aborted` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | welinkSessionId 缺失或格式错误 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4001 | 会话已关闭 | 会话已被关闭，无法停止 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
// 停止技能生成
window.HWH5EXT.stopSkill({
  welinkSessionId: 42
}).then(result => {
  if (result.status === 'aborted') {
    console.log('当前轮回答已停止');
    // 会话仍然保持，可以发送新消息继续对话
  }
}).catch(error => {
  console.error('停止会话失败:', error.errorCode, error.errorMessage);
});
```

### 与 closeSkill 的区别

| 特性 | stopSkill | closeSkill |
|------|-----------|------------|
| 会话连接 | 保持连接 | 释放资源 |
| 会话状态 | stopped | closed |
| 后续操作 | 可发送新消息继续对话 | 会话不可恢复 |
| WebSocket | 保持连接 | 断开连接 |

### 使用场景

- **stopSkill**：用户想停止当前回答，但希望保留会话以便后续继续对话
- **closeSkill**：用户想完全结束会话，释放所有资源

---

## 8. replyPermission

### 接口说明

对 AI 发起的权限确认请求进行批准或拒绝。当 AI 需要执行文件修改、命令执行等敏感操作时，前端展示确认 UI，用户决策后调用此接口回复。

### 调用方式

```javascript
window.HWH5EXT.replyPermission(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| welinkSessionId | number | 是 | 会话 ID |
| permId | string | 是 | 权限请求 ID |
| response | string | 是 | 回复值：`once`（仅本次允许）/ `always`（永久允许）/ `reject`（拒绝） |

### response 值说明

| 值 | 说明 |
|----|------|
| `once` | 仅本次允许，下次同类操作仍需确认 |
| `always` | 永久允许，同类操作不再询问 |
| `reject` | 拒绝本次操作 |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| welinkSessionId | number | 会话 ID |
| permissionId | string | 权限请求 ID |
| response | string | 回复值 |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少 `welinkSessionId`、`permId` 或 `response` 无效 |
| 4000 | 会话不存在 | 指定的会话 ID 不存在 |
| 4007 | 权限请求不存在 | 指定的权限请求 ID 不存在 |
| 4008 | 权限请求已过期 | 权限请求已超时或已处理 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

#### 示例 1：允许本次操作

```javascript
// 用户点击"允许"按钮
window.HWH5EXT.replyPermission({
  welinkSessionId: 42,
  permId: 'perm_1',
  response: 'once'
}).then(result => {
  console.log('权限确认结果:', result.response);
  // AI 将继续执行操作
}).catch(error => {
  console.error('回复权限确认失败:', error.errorCode, error.errorMessage);
});
```

#### 示例 2：永久允许

```javascript
// 用户点击"始终允许"按钮
window.HWH5EXT.replyPermission({
  welinkSessionId: 42,
  permId: 'perm_1',
  response: 'always'
}).then(result => {
  console.log('已永久授权，后续同类操作不再询问');
}).catch(error => {
  console.error('回复权限确认失败:', error.errorCode, error.errorMessage);
});
```

#### 示例 3：拒绝操作

```javascript
// 用户点击"拒绝"按钮
window.HWH5EXT.replyPermission({
  welinkSessionId: 42,
  permId: 'perm_1',
  response: 'reject'
}).then(result => {
  console.log('已拒绝权限请求');
  // AI 将收到拒绝通知，不会执行操作
}).catch(error => {
  console.error('回复权限确认失败:', error.errorCode, error.errorMessage);
});
```

### 组合调用场景

在与其他接口组合调用时：

1. 建议在收到 `permission.ask` 事件后再调用 `replyPermission`，确保权限请求有效
2. 若 `replyPermission` 失败，可重试发送，但需注意避免重复处理

```javascript
// 完整的权限确认流程
const onMessage = (message) => {
  if (message.type === 'permission.ask') {
    // 显示权限确认 UI
    showPermissionDialog({
      title: message.title,
      metadata: message.metadata,
      onAllow: () => {
        // 用户点击允许
        window.HWH5EXT.replyPermission({
          welinkSessionId: message.welinkSessionId,
          permId: message.permissionId,
          response: 'once'
        });
      },
      onAlwaysAllow: () => {
        // 用户点击始终允许
        window.HWH5EXT.replyPermission({
          welinkSessionId: message.welinkSessionId,
          permId: message.permissionId,
          response: 'always'
        });
      },
      onReject: () => {
        // 用户点击拒绝
        window.HWH5EXT.replyPermission({
          welinkSessionId: message.welinkSessionId,
          permId: message.permissionId,
          response: 'reject'
        });
      }
    });
  }
};

// 注册监听器
window.HWH5EXT.registerSessionListener({
  welinkSessionId: 42,
  onMessage: onMessage
});
```

---

## 9. controlSkillWeCode

### 接口说明

执行小程序的关闭或最小化操作，用于控制小程序生命周期。

**重要说明**：

- 当前 V1 保持现状：`close` 只处理小程序侧关闭逻辑
- 上层可在 `close` 成功后继续调用 `closeSkill()` 释放 WebSocket
- 是否关闭服务端会话仍由上层自行决定，当前客户端文档未新增该能力

### 调用方式

```javascript
window.HWH5EXT.controlSkillWeCode(params)
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | string | 是 | 操作类型：`close`（关闭）、`minimize`（最小化） |

### 返回值

返回 Promise 对象，resolve 时返回以下数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 操作状态：`success` / `failed` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | action 缺失或值无效 |
| 4009 | 小程序不存在 | 小程序未初始化或已关闭 |
| 4010 | 操作失败 | 小程序操作执行失败 |

### 调用示例

```javascript
// 监听小程序状态变化
window.HWH5EXT.onSkillWecodeStatusChange((status) => {
  if (status === 'closed') {
    console.log('小程序已关闭');
    // 上层应用决定是否调用 closeSkill 关闭会话
    window.HWH5EXT.closeSkill();
  } else if (status === 'minimized') {
    console.log('小程序已最小化');
    // 上层应用根据需要决定是否调用 stopSkill 停止 AI 生成
    window.HWH5EXT.stopSkill({ welinkSessionId: 42 });
  }
});

// 关闭小程序
try {
  await window.HWH5EXT.controlSkillWeCode({
    action: 'close'
  });
  
  console.log('关闭小程序指令已发送');
  // SDK 会通过 onSkillWecodeStatusChange 回调通知状态
  // 上层应用在回调中决定是否关闭会话
} catch (error) {
  console.error('关闭小程序失败:', error.errorCode, error.errorMessage);
}

// 最小化小程序
try {
  await window.HWH5EXT.controlSkillWeCode({
    action: 'minimize'
  });
  
  console.log('最小化小程序指令已发送');
  // SDK 会通过 onSkillWecodeStatusChange 回调通知状态
  // 上层应用在回调中决定是否停止 AI 生成
} catch (error) {
  console.error('最小化小程序失败:', error.errorCode, error.errorMessage);
}
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 1000 | 无效的参数 |
| 2000 | Agent 离线 |
| 2001 | 超出速率限制 |
| 3000 | 未建立连接 |
| 4000 | 会话不存在 |
| 4001 | 会话已关闭 |
| 4002 | 无用户消息 |
| 4003 | 消息不存在 |
| 4004 | 消息未完成 |
| 4005 | 无最终消息 |
| 4006 | 监听器不存在 |
| 4007 | 权限请求不存在 |
| 4008 | 权限请求已过期 |
| 4009 | 小程序不存在 |
| 4010 | 操作失败 |
| 5000 | 内部错误 |
| 6000 | 网络错误 |
| 7000 | 服务端错误 |
| 7001 | AI 网关错误 |

---

## 注意事项

1. **时序安全**：`registerSessionListener` 可以在任何时机调用，SDK 会确保不遗漏消息
2. **监听器管理**：建议保存回调函数引用，以便后续移除
3. **错误处理**：所有接口都返回 Promise，请使用 `.catch()` 处理错误
4. **资源释放**：页面卸载时务必调用 `unregisterSessionListener` 移除监听器
5. **停止技能**：`stopSkill`仅停止接收消息，如需完全关闭会话请使用`closeSkill`
6. **小程序控制**：`controlSkillWeCode`仅通知状态，上层应用需管理会话和 WebSocket 连接
