# 小程序 JSAPI 接口文档

## 概述

本文档描述小程序通过 `window.HWH5EXT` 调用的 Skill SDK JSAPI。
JSAPI 是对客户端 SDK（`SkillClientSdkInterfaceV1.md`、`SkillClientSdkInterfaceV2.md`）的二次封装，接口语义、字段命名与 SDK 定义对齐。

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
| [getSessionMessageHistory](#31-getsessionmessagehistory) | 游标查询会话历史消息 |
| [registerSessionListener](#4-registersessionlistener) | 注册会话监听器 |
| [unregisterSessionListener](#5-unregistersessionlistener) | 移除会话监听器 |
| [sendMessage](#6-sendmessage) | 发送消息内容 |
| [stopSkill](#7-stopskill) | 停止当前轮技能生成 |
| [replyPermission](#8-replypermission) | 权限确认回复 |
| [controlSkillWeCode](#9-controlskillwecode) | 小程序控制 |
| [createDigitalTwin](#10-createdigitaltwin) | 创建数字分身 |
| [getAgentType](#11-getagenttype) | 查询可用助理类型 |
| [getWeAgentList](#12-getweagentlist) | 查询个人助理列表 |
| [getWeAgentDetails](#13-getweagentdetails) | 获取并按需持久化助理详情 |
| [updateWeAgent](#131-updateweagent) | 更新个人助理信息 |
| [deleteWeAgent](#132-deleteweagent) | 删除个人助理 |
| [notifyAssistantDetailUpdated](#133-notifyassistantdetailupdated) | 通知助理详情已更新 |
| [queryQrcodeInfo](#134-queryqrcodeinfo) | 查询二维码信息 |
| [updateQrcodeInfo](#135-updateqrcodeinfo) | 更新二维码信息 |
| [createNewSession](#14-createnewsession) | 创建新会话 |
| [getHistorySessionsList](#15-gethistorysessionslist) | 获取历史会话列表 |
| [getWeAgentUri](#16-getweagenturi) | 获取当前助理相关页面 URI |
| [openWeAgentCUI](#17-openweagentcui) | 打开助理 CUI |
| [onTabForUpdate](#18-ontabforupdate) | 监听小程序更新事件 |

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
- 若传 `content`，SDK 直接透传该内容给服务端。
- 若不传 `content`，SDK 自动查询当前会话最后一条完成消息内容并发送到 IM。
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
| content | string | 否 | 要发送到 IM 的消息内容。若传入则直接透传给服务端；不传则由 SDK 查询当前会话最后一条完成的消息内容 |
| chatId | string | 否 | 目标 IM 群组 ID，SDK 仅透传 |

说明：
- `content` 为可选入参；若传入则建议使用最终确认后的完整文本内容
- `chatId` 为可选入参并对外暴露。SDK 不会从当前会话 `imGroupId` 自动获取 `chatId`，仅按入参透传给服务端。

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 发送是否成功（服务端字段） |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误，或 `content` 传入后为空字符串 |
| 4005 | 无完成消息 | 会话中没有已完成消息 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

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

### 组合调用场景

1. 若页面已拿到最终确认的消息内容，建议直接传入 `content` 调用 `sendMessageToIM`，避免额外查询历史接口
2. 若 `sendMessageToIM` 失败，可重试发送，但需注意避免重复发送

### 调用示例

```javascript
window.HWH5EXT.sendMessageToIM({
  welinkSessionId: '42',
  content: '代码重构已完成，请查看 PR #42',
  chatId: 'group_abc123'
}).then((result) => {
  if (result.success) {
    console.log('发送到 IM 成功');
  }
}).catch((error) => {
  console.error('发送到 IM 失败:', error.errorCode, error.errorMessage);
});
```

```javascript
window.HWH5EXT.sendMessageToIM({
  welinkSessionId: '42'
  // 不提供 content，SDK 自动查询当前会话最后一条完成的消息内容
  // 不提供 chatId，按服务端接口规则处理
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
| questionId | string \| null | 问题 ID（`question` 类型）；服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId` |
| options | string[] \| null | 选项 |
| multiSelect | boolean \| null | 是否多选（question running 阶段可选） |
| questions | object[] \| null | 多题结构（question running 阶段可选） |
| extParam | object \| null | question 云端透传扩展字段 |
| permissionId | string \| null | 权限请求 ID |
| permType | string \| null | 权限类型 |
| metadata | object \| null | 权限元数据 |
| response | string \| null | 权限回复（`once` / `always` / `reject`） |
| status | string \| null | 状态字段（按 type 出现） |
| fileName | string \| null | 文件名 |
| fileUrl | string \| null | 文件 URL |
| fileMime | string \| null | 文件 MIME |
| subagentSessionId | string \| null | 子 agent 的真实会话 ID，建议作为子任务分组主键 |
| subagentName | string \| null | 子 agent 显示名；若存在嵌套层级，使用 `" > "` 作为路径分隔符 |

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

## 3.1 getSessionMessageHistory

### 接口说明

游标查询当前会话历史消息，适用于聊天首屏加载和上拉加载更早消息。

### 调用方式

```javascript
window.HWH5EXT.getSessionMessageHistory(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getSessionMessageHistory', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| welinkSessionId | string | 是 | - | 会话 ID |
| beforeSeq | number | 否 | - | 查询该序号之前的更早消息；首屏加载不传 |
| size | number | 否 | 50 | 每次拉取条数 |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<SessionMessage> | 当前批次消息列表（透传服务端顺序；当前服务端为消息时间正序） |
| size | number | 本次查询的 page size |
| hasMore | boolean | 是否还有更早消息 |
| nextBeforeSeq | number \| null | 下次继续向前翻页的游标 |

### 行为说明

1. 首屏加载不传 `beforeSeq`，仅传 `size`。
2. 当 `hasMore=true` 时，下次请求传入 `nextBeforeSeq` 拉取更早消息。
3. 当 `hasMore=false` 时，停止继续请求。
4. 调用服务端 REST API 前，SDK 会先检查 WebSocket 连接；若未连接则先重连。
5. `SessionMessage` 结构复用 [getSessionMessage](#3-getsessionmessage) 章节定义。

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `welinkSessionId` 缺失或格式错误 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.getSessionMessageHistory({
  welinkSessionId: '42',
  size: 50
}).then((firstPage) => {
  console.log('首屏消息条数:', firstPage.content.length);
  if (firstPage.hasMore && firstPage.nextBeforeSeq !== null) {
    return window.HWH5EXT.getSessionMessageHistory({
      welinkSessionId: '42',
      size: 50,
      beforeSeq: firstPage.nextBeforeSeq
    });
  }
  return null;
}).then((olderPage) => {
  if (olderPage) {
    console.log('更早消息条数:', olderPage.content.length);
  }
}).catch((error) => {
  console.error('游标查询消息失败:', error.errorCode, error.errorMessage);
});
```

---

## 4. registerSessionListener

### 接口说明

注册会话监听器，用于接收 WebSocket 推送事件流。

说明：
- 同一个 `welinkSessionId` 只允许注册一次监听器。
- 同一 `welinkSessionId` 重复注册时，会覆盖旧监听器。
- 可在任意时机注册，SDK 保证时序安全，不因注册时机导致漏消息。
- WebSocket 每帧直接返回一个平铺的 `StreamMessage` JSON，对外没有外层 envelope。

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
| seq | number \| null | 递增序列号；大部分事件都有，个别极简事件也可能省略 |
| welinkSessionId | string | 所属会话 ID；`agent.online` / `agent.offline` 不携带 |
| emittedAt | string \| null | 事件产生时间，ISO-8601；`permission.reply` / `agent.online` / `agent.offline` / `error` 通常不携带 |

#### 消息级字段（按事件返回）

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | string \| null | 稳定消息 ID |
| sourceMessageId | string \| null | 源消息 ID |
| messageSeq | number \| null | 会话内消息顺序 |
| role | string \| null | 当前服务端返回值为 `user` / `assistant`；常见于 Part 级事件、`message.user`、`streaming`、`permission.reply` |

#### Part级字段（按事件返回）

| 字段 | 类型 | 说明 |
|------|------|------|
| partId | string \| null | Part 唯一 ID |
| partSeq | number \| null | Part 顺序；`permission.ask` / `permission.reply` 可能缺失 |

说明：
- `question` 是两阶段事件：`running` 阶段带 `header` / `question` / `options` / `multiSelect` / `questions` / `extParam` / `questionId`，`completed` / `error` 阶段前端应按 `partId` 关联此前的问题状态。
- `permission.reply` 是极简事件，客户端应主要按 `permissionId` 匹配原始权限请求。

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
| multiSelect | boolean \| null | question 是否多选 |
| questions | object[] \| null | question 多题结构 |
| extParam | object \| null | question 云端透传字段 |
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
| keywords | string[] \| null | `searching` 事件关键词列表 |
| searchResults | object[] \| null | `search_result` 事件搜索结果列表 |
| references | object[] \| null | `reference` 事件引用列表 |
| askMoreQuestions | string[] \| null | `ask_more` 事件追问建议列表 |
| messages | array \| null | `snapshot` 携带的已完成消息快照 |
| parts | array \| null | `streaming` 携带的进行中消息部件 |
| subagentSessionId | string \| null | 子 agent 的真实会话 ID，仅出现在 Part 级事件及恢复态 part 中 |
| subagentName | string \| null | 子 agent 显示名，仅用于展示 |

### 事件类型

`text.delta` / `text.done` / `thinking.delta` / `thinking.done` / `tool.update` / `question` / `file` / `step.start` / `step.done` / `session.status` / `session.title` / `session.error` / `permission.ask` / `permission.reply` / `message.user` / `agent.online` / `agent.offline` / `error` / `snapshot` / `streaming` / `planning.delta` / `planning.done` / `searching` / `search_result` / `reference` / `ask_more`

恢复态说明：
- 重连恢复时，服务端会先推送 `snapshot`，再推送 `streaming`。
- 当 `streaming.sessionStatus = idle` 时，客户端应将当前所有 streaming part 视为已完成，避免残留流式展示状态。
- `search_result` 的字段名严格是 `searchResults`，`ask_more` 的字段名严格是 `askMoreQuestions`。

### 行为说明

1. SDK 内部维护每个会话唯一监听器（`onMessage` / `onError` / `onClose`）。
2. 同一 `welinkSessionId` 重复注册时，会覆盖旧监听器。
3. `unregisterSessionListener` 仅移除当前监听器，不主动关闭其他会话监听。
4. 页面关闭或切换会话时应及时调用 `unregisterSessionListener` 释放监听。

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
    case 'text.done':
      console.log('AI 响应完成:', message.content);
      break;
    case 'tool.update':
      console.log('工具状态:', message.toolName, message.status);
      break;
    case 'question':
      if (message.status === 'running') {
        console.log('AI 提问:', message.question, message.options);
      } else {
        console.log('AI 提问已完成:', message.toolCallId, message.output);
      }
      break;
    case 'permission.ask':
      console.log('权限请求:', message.permissionId, message.title);
      break;
    case 'permission.reply':
      console.log('权限请求已应答:', message.permissionId, message.response);
      break;
    case 'message.user':
      console.log('收到用户消息:', message.content);
      break;
    case 'snapshot':
      console.log('断线恢复快照消息数:', message.messages?.length || 0);
      break;
    case 'streaming':
      console.log('收到进行中流状态:', message.sessionStatus, message.parts?.length || 0);
      break;
    case 'searching':
      console.log('搜索中:', message.keywords);
      break;
    case 'search_result':
      console.log('搜索结果:', message.searchResults);
      break;
    case 'reference':
      console.log('引用列表:', message.references);
      break;
    case 'ask_more':
      console.log('追问建议:', message.askMoreQuestions);
      break;
    case 'agent.online':
    case 'agent.offline':
      console.log('Agent 状态事件:', message.type);
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
| questionId | string | 否 | 回答 AI `question` 时携带的问题 ID。服务端协议文档中的 `requestId` 为错误口径，SDK 对外统一使用 `questionId` |
| subagentSessionId | string | 否 | subagent 场景必传。回答子 agent 发起的 `question` 时，必须回传事件中的真实子会话 ID |
| businessExtParam | object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

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

### 说明

- 若当前回复的是 `question`，且服务端事件中带有问题 ID，则 SDK 应透传 `questionId`。
- 若当前回复的是子 agent 发起的 `question`，必须同时透传 `toolCallId` 与 `subagentSessionId`，否则服务端会把应答路由到主对话。

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

```javascript
window.HWH5EXT.sendMessage({
  welinkSessionId: '42',
  content: '继续执行',
  toolCallId: 'call_q_1',
  questionId: 'question_q_1',
  subagentSessionId: 'child-session-001',
  businessExtParam: { scene: 'miniapp' }
}).then((result) => {
  console.log('子 agent 应答发送成功:', result.id);
}).catch((error) => {
  console.error('发送子 agent 应答失败:', error.errorCode, error.errorMessage);
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
- subagent 场景下可只中止指定子 agent 链路。

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
| subagentSessionId | string | 否 | subagent 场景必传。传入时仅中止指定子 agent 链路；不传则中止主会话当前回答 |

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

```javascript
window.HWH5EXT.stopSkill({
  welinkSessionId: '42',
  subagentSessionId: 'child-session-001'
}).then((result) => {
  if (result.status === 'aborted') {
    console.log('子 agent 当前轮已停止');
  }
}).catch((error) => {
  console.error('停止子 agent 失败:', error.errorCode, error.errorMessage);
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
| subagentSessionId | string | 否 | subagent 场景必传。回复子 agent 发起的 `permission.ask` 时，必须回传事件中的真实子会话 ID |

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

### 说明

- 若收到的 `permission.ask` 事件带有 `subagentSessionId`，则调用 `replyPermission` 时必须原样回传，否则服务端会把授权路由到主对话。

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

```javascript
window.HWH5EXT.replyPermission({
  welinkSessionId: '42',
  permId: 'perm_1',
  response: 'once',
  subagentSessionId: 'child-session-001'
}).then((result) => {
  console.log('子 agent 权限确认结果:', result.response);
}).catch((error) => {
  console.error('回复子 agent 权限确认失败:', error.errorCode, error.errorMessage);
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

## 10. createDigitalTwin

### 接口说明

根据分身名称、头像、简介等信息创建一个新的数字分身。

### 调用方式

```javascript
window.HWH5EXT.createDigitalTwin(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'createDigitalTwin', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 分身名称 |
| icon | string | 是 | 分身头像地址 |
| description | string | 是 | 分身简介 |
| weCrewType | number | 否 | 分身类型：`1` 内部分身，`0` 自定义分身 |
| bizRobotId | string | 否 | 内部助手业务机器人 ID（`weCrewType=1` 时建议传入） |
| qrcode | string | 否 | 二维码编码 |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| robotId | string | 分身机器人 ID |
| partnerAccount | string | 分身账号 ID |
| message | string | 消息，接口正常为 `success` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 入参缺失或类型错误 |
| 587013 | 请求太频繁 | 服务端限流 |
| 587014 | 创建数字分身失败 | 服务端创建失败 |
| 587015 | 创建数字分身达到上限 | 达到创建上限 |
| 587016 | 没有数字分身权限 | 无权限 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.createDigitalTwin({
  name: '分身小白',
  icon: '/mcloud/xxx',
  description: '数字分身小白能做...',
  weCrewType: 1,
  bizRobotId: '8041241',
  qrcode: 'qr_001'
}).then((result) => {
  console.log('创建成功:', result.partnerAccount);
}).catch((error) => {
  console.error('创建失败:', error.errorCode, error.errorMessage);
});
```

---

## 11. getAgentType

### 接口说明

获取分身创建时支持的内置助理类型列表。

### 调用方式

```javascript
window.HWH5EXT.getAgentType()
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getAgentType', params: {}})
```

### 参数说明

无

### 返回值

返回 Promise，resolve 数据：`AgentTypeList`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<AgentType> | 支持的助理类型列表 |

### 调用示例

```javascript
window.HWH5EXT.getAgentType().then((result) => {
  result.content.forEach((item) => {
    console.log(item.name, item.bizRobotId);
  });
}).catch((error) => {
  console.error('获取助理类型失败:', error.errorCode, error.errorMessage);
});
```

---

## 12. getWeAgentList

### 接口说明

分页查询当前用户创建的个人助理列表。

### 调用方式

```javascript
window.HWH5EXT.getWeAgentList(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getWeAgentList', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| pageSize | number | 是 | 分页大小，最小 `1`，最大 `100` |
| pageNumber | number | 是 | 页码，最小 `1`，最大 `1000` |

### 返回值

返回 Promise，resolve 数据：`WeAgentList`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Array<WeAgent> | 个人助理列表 |

`content` 中每个对象字段：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| name | string | 助理名称 |
| icon | string | 助理图标 |
| description | string | 助理简介 |
| partnerAccount | string | 助理账号 ID |
| bizRobotName | string | 助理对应业务机器人名称（中文） |
| bizRobotNameEn | string | 助理对应业务机器人名称（英文） |
| bizRobotTag | string | 大脑机器人 tag |
| robotId | string | 助理机器人 ID |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | `pageSize` / `pageNumber` 缺失或格式错误 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例

```javascript
window.HWH5EXT.getWeAgentList({
  pageSize: 10,
  pageNumber: 1
}).then((result) => {
  result.content.forEach((item) => {
    console.log(item.name, item.partnerAccount, item.bizRobotTag);
  });
}).catch((error) => {
  console.error('获取助理列表失败:', error.errorCode, error.errorMessage);
});
```

### 行为说明

1. JSAPI 调用 SDK `getWeAgentList` 接口。
2. SDK 调用服务端 `GET /v4-1/we-crew/list`，透传查询参数 `pageSize`、`pageNumber`。
3. SDK 解析服务端返回 `data[]` 并组装为 `WeAgentList`。
4. 服务端新增字段 `data[].bizRobotTag` 需同步透传到 JSAPI 出参 `content[].bizRobotTag`。

---

## 13. getWeAgentDetails

### 接口说明

获取指定助理详情。

- 移动端：根据单个 `partnerAccount` 查询。
- PC端：保持原有批量入参 `partnerAccounts`（数组）查询。

调用成功后，SDK 可按需将助理详情写入 SP 持久化存储。

### 调用方式

```javascript
window.HWH5EXT.getWeAgentDetails(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getWeAgentDetails', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| partnerAccount | string | 移动端非必填 | 助理账号 ID（移动端）；未传时，SDK 调用 `GET /v4-1/we-crew/my-agent` 获取当前主助理详情 |
| partnerAccounts | Array<string> | PC端必填 | 助理账号 ID 数组（PC端，保持不变） |

### 返回值

返回 Promise，resolve 数据：`WeAgentDetailsArray`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| weAgentDetailsArray | Array<WeAgentDetails> | 助理详情数组 |

`weAgentDetailsArray` 中每个对象字段：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| name | string | 助理名称 |
| icon | string | 助理图标 |
| desc | string | 助理简介 |
| moduleId | string | 助理对应模块 ID |
| appKey | string | 助理 AK |
| appSecret | string | 助理 SK |
| partnerAccount | string | 助理账号 ID |
| createdBy | string | 创建者 weLinkId |
| creatorWorkId | string | 创建者工号 |
| creatorW3Account | string | 创建者账号 |
| creatorName | string | 创建者名称 |
| creatorNameEn | string | 创建者英文名称 |
| ownerWelinkId | string | 责任人 weLinkId |
| ownerW3Account | string | 大脑机器人责任人账号 |
| ownerName | string | 责任人名称 |
| ownerNameEn | string | 责任人英文名称 |
| ownerDeptName | string | 责任部门中文名 |
| ownerDeptNameEn | string | 责任部门英文名 |
| id | string | 助理对应机器人 ID（当助理详情解析 `weCodeUrl` 的 host 与常量 `APP_ID` 不一致时，用于拼接 `weAgentUri` 的 `robotId` query） |
| bizRobotName | string | 助理对应业务机器人名称（中文） |
| bizRobotNameEn | string | 助理对应业务机器人名称（英文） |
| bizRobotTag | string | 大脑机器人 tag |
| bizRobotId | string | 助理对应业务机器人 ID |
| weCodeUrl | string | 助理 We 码地址 |

### 行为说明

1. 移动端：传入 `partnerAccount` 时，SDK 调用服务端 `GET /v1/robot-partners/{partnerAccount}` 获取详情；未传时，SDK 调用 `GET /v4-1/we-crew/my-agent` 获取当前主助理详情。
2. PC端：保持原有实现，使用 `partnerAccounts` 数组入参获取详情列表。
3. 当最终查询对象仅包含 1 个助理时，SDK 将对应详情写入 `current_we_agent_detail`（按 `userId` 隔离），供 `getWeAgentUri` 使用。

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 移动端 `partnerAccount` 或 PC端 `partnerAccounts` 缺失/格式错误 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端处理失败 |

### 调用示例（移动端）

```javascript
window.HWH5EXT.getWeAgentDetails({
  partnerAccount: 'x00_1'
}).then((result) => {
  result.weAgentDetailsArray.forEach((detail) => {
    console.log('助理详情:', detail.name, detail.weCodeUrl);
  });
}).catch((error) => {
  console.error('获取助理详情失败:', error.errorCode, error.errorMessage);
});
```

### 调用示例（移动端未传 `partnerAccount`）

```javascript
window.HWH5EXT.getWeAgentDetails({})
  .then((result) => {
    console.log('当前主助理详情:', result.weAgentDetailsArray);
  })
  .catch((error) => {
    console.error('获取当前主助理详情失败:', error.errorCode, error.errorMessage);
  });
```

### 调用示例（PC端）

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk', {
  funName: 'getWeAgentDetails',
  params: {
    partnerAccounts: ['x00_1', 'x00_2']
  }
});
```

---

## 13.1. updateWeAgent

### 接口说明

更新个人助理信息。

说明：
- `partnerAccount` 与 `robotId` 至少传一个。
- 若两者同时传入，JSAPI 按原样将两个参数都透传给 SDK。

### 调用方式

```javascript
window.HWH5EXT.updateWeAgent(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'updateWeAgent', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| partnerAccount | string | 否 | 助理账号 ID，`partnerAccount` 与 `robotId` 至少传一个；若两者同时传入，则两个参数都透传 |
| robotId | string | 否 | 助理机器人 ID，`partnerAccount` 与 `robotId` 至少传一个；若两者同时传入，则两个参数都透传 |
| name | string | 是 | 助理名称 |
| icon | string | 是 | 助理头像地址 |
| description | string | 是 | 助理简介 |

### 返回值

返回 Promise，resolve 数据：`UpdateWeAgentResult`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| updateResult | string | 更新结果，成功时为 `success` |

### 行为说明

1. JSAPI 调用 SDK `updateWeAgent` 接口。
2. SDK 调用服务端 `PUT /v4-1/we-crew`。
3. SDK 透传 `partnerAccount`、`robotId`、`name`、`icon`、`description`。
4. SDK 从服务端响应中提取 `message`，并映射为 `updateResult` 返回。

### 调用示例

```javascript
window.HWH5EXT.updateWeAgent({
  partnerAccount: 'dig_001',
  name: '更新名称',
  icon: '/mocloud/xxx',
  description: '更新简介'
}).then((result) => {
  console.log('更新结果:', result.updateResult);
}).catch((error) => {
  console.error('更新助理失败:', error.errorCode, error.errorMessage);
});
```

---

## 13.2. deleteWeAgent

### 接口说明

删除个人助理。

说明：
- `partnerAccount` 与 `robotId` 至少传一个。
- 若两者同时传入，JSAPI 按原样将两个参数都透传给 SDK。

### 调用方式

```javascript
window.HWH5EXT.deleteWeAgent(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'deleteWeAgent', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| partnerAccount | string | 否 | 助理账号 ID，`partnerAccount` 与 `robotId` 至少传一个；若两者同时传入，则两个参数都透传 |
| robotId | string | 否 | 助理机器人 ID，`partnerAccount` 与 `robotId` 至少传一个；若两者同时传入，则两个参数都透传 |

### 返回值

返回 Promise，resolve 数据：`DeleteWeAgentResult`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| deleteResult | string | 删除结果，成功时为 `success` |

### 行为说明

1. JSAPI 调用 SDK `deleteWeAgent` 接口。
2. SDK 调用服务端 `DELETE /v4-1/we-crew`。
3. SDK 校验 `partnerAccount` 与 `robotId` 至少传一个，并按原样透传删除标识参数。
4. SDK 从服务端响应中提取 `message`，并映射为 `deleteResult` 返回。

### 调用示例

```javascript
window.HWH5EXT.deleteWeAgent({
  partnerAccount: 'dig_001'
}).then((result) => {
  console.log('删除结果:', result.deleteResult);
}).catch((error) => {
  console.error('删除助理失败:', error.errorCode, error.errorMessage);
});
```

---

## 13.3. notifyAssistantDetailUpdated

### 接口说明

通知当前助理详情已更新，并触发已注册的详情更新回调。

说明：
- 该接口为本地扩展接口，无对应服务端接口。
- `partnerAccount` 与 `robotId` 二选一，优先使用 `partnerAccount`。

### 调用方式

```javascript
window.HWH5EXT.notifyAssistantDetailUpdated(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'notifyAssistantDetailUpdated', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 助理名称 |
| icon | string | 是 | 助理头像地址 |
| description | string | 是 | 助理简介 |
| partnerAccount | string | 否 | 助理账号 ID，`partnerAccount` 与 `robotId` 二选一，优先使用 `partnerAccount` |
| robotId | string | 否 | 助理机器人 ID，`partnerAccount` 与 `robotId` 二选一，优先使用 `partnerAccount` |

### 返回值

返回 Promise，resolve 数据：`NotifyAssistantDetailUpdatedResult`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 固定返回 `success` |

### 行为说明

1. JSAPI 调用 SDK `notifyAssistantDetailUpdated` 接口。
2. SDK 根据与 `openAssistantEditPage` 一致的唯一 ID 规则定位已注册监听：优先使用 `partnerAccount`，否则使用 `robotId`。
3. SDK 触发对应的 `onUpdated` 回调，并传出 `{ name, icon, description }`。
4. SDK 返回 `{ status: 'success' }`。

### 调用示例

```javascript
window.HWH5EXT.notifyAssistantDetailUpdated({
  name: '更新名称',
  icon: '/mocloud/xxx',
  description: '更新简介',
  partnerAccount: 'x00_1'
}).then((result) => {
  console.log('通知结果:', result.status);
}).catch((error) => {
  console.error('通知助理详情更新失败:', error.errorCode, error.errorMessage);
});
```

---

## 13.4. queryQrcodeInfo

### 接口说明

根据二维码唯一标识查询二维码相关信息。

### 调用方式

```javascript
window.HWH5EXT.queryQrcodeInfo(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkillsDialog/queryQrcodeInfo',params);
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| qrcode | string | 是 | 二维码唯一标识 |

### 返回值

返回 Promise，resolve 数据：`QrcodeInfo`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| qrcode | string | 二维码唯一标识 |
| weUrl | string | We 侧地址 |
| pcUrl | string | PC 侧地址 |
| expireTime | string | 过期时间戳 |
| status | number | 二维码状态 |
| mac | string | 设备 MAC 地址 |
| channel | string | 二维码渠道标识 |
| expired | boolean | 过期状态 |

### 行为说明

1. JSAPI 调用 SDK `queryQrcodeInfo` 接口。
2. SDK 调用服务端 `GET /v4-1/we-crew/im-register/qrcode/{qrcode}`。
3. SDK 不透出服务端包装字段，直接透传响应 `data` 中的 `qrcode`、`weUrl`、`pcUrl`、`expireTime`、`status`、`mac`、`channel`、`expired`。

### 调用示例

```javascript
window.HWH5EXT.queryQrcodeInfo({
  qrcode: 'qr_001'
}).then((result) => {
  console.log('二维码状态:', result.status, result.expired);
}).catch((error) => {
  console.error('查询二维码信息失败:', error.errorCode, error.errorMessage);
});
```

---

## 13.5. updateQrcodeInfo

### 接口说明

根据二维码唯一标识更新二维码信息。

### 调用方式

```javascript
window.HWH5EXT.updateQrcodeInfo(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkillsDialog/updateQrcodeInfo',params);
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| qrcode | string | 是 | 二维码唯一标识 |
| robotId | string | 否 | 分身机器人 ID |
| status | number | 是 | 二维码状态 |

### 返回值

返回 Promise，resolve 数据：`UpdateQrcodeInfoResult`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 当服务端返回 `code=200` 时固定返回 `success` |

### 行为说明

1. JSAPI 调用 SDK `updateQrcodeInfo` 接口。
2. SDK 调用服务端 `PUT /v4-1/we-crew/im-register/qrcode`。
3. SDK 透传 `qrcode`、`robotId`、`status`。
4. SDK 根据服务端返回 `code=200`，映射返回 `{ status: 'success' }`。

### 调用示例

```javascript
window.HWH5EXT.updateQrcodeInfo({
  qrcode: 'qr_001',
  robotId: '860306',
  status: 2
}).then((result) => {
  console.log('更新二维码结果:', result.status);
}).catch((error) => {
  console.error('更新二维码信息失败:', error.errorCode, error.errorMessage);
});
```

---

## 14. createNewSession

### 接口说明

创建新的 Skill 会话。

### 调用方式

```javascript
window.HWH5EXT.createNewSession(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'createNewSession', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ak | string | 否 | Agent Plugin 对应的 Access Key |
| title | string | 否 | 会话标题，不传则由 AI 自动生成 |
| businessSessionDomain | string | 是 | 业务侧外部 ID 三元组中的 domain；miniapp 场景通常传 `skill` |
| businessSessionId | string | 是 | 业务侧外部 ID 三元组中的 id；单聊可传用户 ID，群聊可传群 ID |
| businessSessionType | string | 是 | 业务侧外部 ID 三元组中的 type；miniapp 场景通常传 `skill` |
| assistantAccount | string | 否 | 助理账号 ID；为空时是否允许创建由服务端开关控制 |
| businessExtParam | object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

### 返回值

返回 Promise，resolve 数据：`Session`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| welinkSessionId | string | 会话 ID |
| userId | string | 用户 ID |
| ak | string \| null | Access Key，未关联时为 `null` |
| title | string \| null | 会话标题 |
| businessSessionDomain | string \| null | 业务侧外部 ID 三元组中的 domain |
| businessSessionType | string \| null | 业务侧外部 ID 三元组中的 type |
| businessSessionId | string \| null | 业务侧外部 ID 三元组中的 id |
| assistantAccount | string \| null | 助理账号 ID |
| status | string | 会话状态：`ACTIVE` / `IDLE` / `CLOSED` |
| toolSessionId | string \| null | OpenCode Session ID |
| createdAt | string | 创建时间（ISO-8601） |
| updatedAt | string | 更新时间（ISO-8601） |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 缺少必填参数或参数格式错误 |
| 6000 | 网络错误 | 网络请求失败 |
| 7000 | 服务端错误 | 服务端创建会话失败 |

### 调用示例

```javascript
window.HWH5EXT.createNewSession({
  ak: 'ak_xxxxxxxx',
  title: '帮我创建一个 React 项目',
  businessSessionDomain: 'skill',
  businessSessionType: 'skill',
  assistantAccount: 'x00_1',
  businessSessionId: 'x00123456',
  businessExtParam: { traceId: 'trace_001' }
}).then((session) => {
  console.log('会话创建成功:', session.welinkSessionId);
}).catch((error) => {
  console.error('创建会话失败:', error.errorCode, error.errorMessage);
});
```

---

## 15. getHistorySessionsList

### 接口说明

获取当前用户的历史会话列表，支持分页与条件过滤。

### 调用方式

```javascript
window.HWH5EXT.getHistorySessionsList(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getHistorySessionsList', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 `0` |
| size | number | 否 | 每页大小，默认 `50` |
| status | string | 否 | 按状态过滤：`ACTIVE` / `IDLE` / `CLOSED` |
| ak | string | 否 | 按 Agent AK 过滤 |
| businessSessionId | string | 否 | 按会话归属 ID 过滤 |
| assistantAccount | string | 否 | 按助理账号 ID 过滤 |
| businessSessionDomain | string | 否 | 会话来源域过滤：`miniapp` / `im` |
| businessExtParam | object | 否 | 业务扩展参数，SDK 原样透传给服务端 |

### 返回值

返回 Promise，resolve 数据：`PageResult<Session>`

分页结果字段：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| content | Session[] | 当前页会话列表 |
| page | number | 当前页码（从 0 开始） |
| size | number | 每页大小 |
| total | number | 总记录数 |
| totalPages | number | 总页数 |

`content` 中每个会话对象字段：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| welinkSessionId | string | 会话 ID |
| userId | string | 用户 ID |
| ak | string \| null | Access Key，未关联时为 `null` |
| title | string \| null | 会话标题 |
| businessSessionDomain | string \| null | 业务侧外部 ID 三元组中的 domain |
| businessSessionType | string \| null | 业务侧外部 ID 三元组中的 type |
| businessSessionId | string \| null | 业务侧外部 ID 三元组中的 id |
| assistantAccount | string \| null | 助理账号 ID |
| status | string | 会话状态：`ACTIVE` / `IDLE` / `CLOSED` |
| toolSessionId | string \| null | OpenCode Session ID |
| createdAt | string | 创建时间（ISO-8601） |
| updatedAt | string | 更新时间（ISO-8601） |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 参数格式错误 |
| 6000 | 网络错误 | 网络请求失败 |

### 调用示例

```javascript
window.HWH5EXT.getHistorySessionsList({
  ak: 'ak_xxxxxxxx',
  businessSessionId: 'group_abc123',
  businessSessionDomain: 'miniapp',
  page: 0,
  size: 50,
  status: 'IDLE',
  assistantAccount: 'x001_1',
  businessExtParam: { traceId: 'trace_001' }
}).then((result) => {
  console.log('历史会话总数:', result.total);
}).catch((error) => {
  console.error('获取历史会话失败:', error.errorCode, error.errorMessage);
});
```

---

## 16. getWeAgentUri

### 接口说明

读取持久化的当前助理详情，组装并返回当前助理相关页面 URI。

该接口为 SDK 本地扩展接口，无服务端对应接口。

### 调用方式

```javascript
window.HWH5EXT.getWeAgentUri()
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'getWeAgentUri', params: {}})
```

### 参数说明

无

### 返回值

返回 Promise，resolve 数据：`WeAgentUriResult`

| 参数名 | 类型 | 说明 |
|--------|------|------|
| weAgentUri | string | 当前助理 CUI 地址：若助理详情 `weCodeUrl` 不为空，先解析其 host；当 host 与常量 `APP_ID` 不一致时，按 `weCodeUrl` 追加 `wecodePlace=weAgent` 与 `robotId={id}`（`id` 来自助理详情）；当 host 与常量 `APP_ID` 一致时，按 `weCodeUrl` 追加 `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`。若 `weCodeUrl` 为空，则取 `WE_AGENT_BASE_URI` 默认值（`h5://123456/index.html#weAgentCUI`），随后追加 `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`。 |
| assistantDetailUri | string | 助理详情地址（`h5://123456/index.html` 并追加 `partnerAccount` query 与 hash `assistantDetail`） |
| switchAssistantUri | string | 切换助理地址（`h5://123456/index.html` 并追加 `partnerAccount` query 与 hash `switchAssistant`） |

### 调用示例

```javascript
window.HWH5EXT.getWeAgentUri().then((result) => {
  console.log('weAgentUri:', result.weAgentUri);
  console.log('assistantDetailUri:', result.assistantDetailUri);
  console.log('switchAssistantUri:', result.switchAssistantUri);
}).catch((error) => {
  console.error('获取 URI 失败:', error.errorCode, error.errorMessage);
});
```

---

## 17. openWeAgentCUI

### 接口说明

打开助理 CUI 页面。

### 调用方式

```javascript
window.HWH5EXT.openWeAgentCUI(params)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'openWeAgentCUI', params})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| weAgentUri | string | 是 | 当前助理 CUI 地址：若助理详情 `weCodeUrl` 不为空，则先解析 `weCodeUrl` 的 host。若 host 与常量 `APP_ID` 不一致，则取 `weCodeUrl` 并追加 query `wecodePlace=weAgent` 与 `robotId={id}`（`id` 来自助理详情）；若 host 与常量 `APP_ID` 一致，则按 `weCodeUrl` 追加 query `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`。若 `weCodeUrl` 为空，则取 `WE_AGENT_BASE_URI` 默认值（`h5://123456/index.html#weAgentCUI`）；随后追加 query `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`。 |
| assistantDetailUri | string | 是 | 助理详情地址（`h5://123456/index.html` 并追加 `partnerAccount` query 与 hash `assistantDetail`） |
| switchAssistantUri | string | 是 | 切换助理地址（`h5://123456/index.html` 并追加 `partnerAccount` query 与 hash `switchAssistant`） |

### 返回值

返回 Promise，resolve 数据：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 固定为 `success` |

### 错误处理

| 错误码 | 错误消息 | 说明 |
|--------|----------|------|
| 1000 | 无效的参数 | 入参缺失或格式错误 |
| 4010 | 操作失败 | 打开助理 CUI 失败 |

### 调用示例

```javascript
window.HWH5EXT.openWeAgentCUI({
  weAgentUri: 'h5://123456/index.html?wecodePlace=weAgent&assistantAccount=x00_1#weAgentCUI',
  assistantDetailUri: 'h5://123456/index.html?partnerAccount=x00_1#assistantDetail',
  switchAssistantUri: 'h5://123456/index.html?partnerAccount=x00_1#switchAssistant'
}).then((result) => {
  console.log('打开成功:', result.status);
}).catch((error) => {
  console.error('打开失败:', error.errorCode, error.errorMessage);
});
```

---

## 18. onTabForUpdate

### 接口说明

监听当前小程序是否有更新。

当宿主检测到当前小程序存在可用更新时，会触发调用方传入的回调函数。

### 调用方式

```javascript
window.HWH5EXT.onTabForUpdate(callback)
```

### PC端调用方式

```javascript
window.Pedestal.callMethod('method://agentSkills/handleSdk',{funName:'onTabForUpdate', params: callback})
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| callback | function | 是 | 更新事件回调函数；回调函数无入参、无返回值 |

### 返回值

无返回值。

### 行为说明

1. JSAPI 注册当前小程序更新监听。
2. 当宿主检测到小程序存在可用更新时，执行传入的 `callback`。
3. `callback` 无出参，由业务侧自行在回调中处理刷新提示、重新打开页面等后续逻辑。

### 调用示例

```javascript
window.HWH5EXT.onTabForUpdate(() => {
  console.log('当前小程序存在可用更新');
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
| 587013 | 请求太频繁 |
| 587014 | 创建数字分身失败 |
| 587015 | 创建数字分身达到上限 |
| 587016 | 没有数字分身权限 |

---

## 注意事项

1. `registerSessionListener` 支持任意时机调用，SDK 会做时序安全处理，避免漏消息。
2. 同一 `welinkSessionId` 重复注册监听器时，SDK 不会重复注册，按成功语义处理。
3. 页面卸载时务必调用 `unregisterSessionListener` 释放监听器。
4. `stopSkill` 仅中止当前轮执行，不会关闭会话或断开 WebSocket。
5. `controlSkillWeCode` 仅控制小程序 UI 生命周期；会话与连接资源管理由上层决定。
