# Skill Client SDK 接口 V4 到 V5 变更说明

## 概述

本文档用于说明以下两个版本接口文档之间的差异：

- `SkillClientSdkInterfaceV4.md`
- `SkillClientSdkInterfaceV5.md`

总体结论：

- V5 未新增或删除对外 SDK 接口。
- 主要变化集中在入参约束、字段类型、返回模型、分页字段以及流式消息契约。

## 接口变更总表

| 接口 | V4 | V5 | 变更说明 | 影响等级 |
|---|---|---|---|---|
| `createSession` | `createSession(params: CreateSessionParams): Promise<SkillSession>` | 同名同签名 | 方法未变，但入参与返回模型有调整 | 中 |
| `closeSkill` | `closeSkill(): Promise<CloseSkillResult>` | 同名同签名 | 无实质变更 | 低 |
| `stopSkill` | `stopSkill(params: StopSkillParams): Promise<StopSkillResult>` | 同名同签名 | `welinkSessionId` 类型调整 | 中 |
| `onSessionStatusChange` | `onSessionStatusChange(params: OnSessionStatusChangeParams): void` | 同名同签名 | `welinkSessionId` 类型调整 | 中 |
| `onSkillWecodeStatusChange` | `onSkillWecodeStatusChange(params: OnSkillWecodeStatusChangeParams): void` | 同名同签名 | 无实质变更 | 低 |
| `regenerateAnswer` | `regenerateAnswer(params: RegenerateAnswerParams): Promise<SendMessageResult>` | 同名同签名 | `welinkSessionId` 类型调整；返回模型改为与服务端消息模型对齐 | 高 |
| `sendMessageToIM` | `sendMessageToIM(params: SendMessageToIMParams): Promise<SendMessageToIMResult>` | 同名同签名 | `welinkSessionId` 类型调整；返回字段由 `status` 改为 `success` | 高 |
| `getSessionMessage` | `getSessionMessage(params: GetSessionMessageParams): Promise<PageResult<SessionMessage>>` | 同名同签名 | 入参类型调整；分页字段改名；消息模型升级 | 高 |
| `registerSessionListener` | `registerSessionListener(params: RegisterSessionListenerParams): RegisterSessionListenerResult` | 同名同签名 | `welinkSessionId` 类型调整 | 中 |
| `unregisterSessionListener` | `unregisterSessionListener(params: UnregisterSessionListenerParams): UnregisterSessionListenerResult` | 同名同签名 | `welinkSessionId` 类型调整 | 中 |
| `sendMessage` | `sendMessage(params: SendMessageParams): Promise<SendMessageResult>` | 同名同签名 | 入参类型调整；返回模型改为与服务端消息模型对齐 | 高 |
| `replyPermission` | `replyPermission(params: ReplyPermissionParams): Promise<ReplyPermissionResult>` | 同名同签名 | `welinkSessionId` 入参/返回类型调整 | 中 |
| `controlSkillWeCode` | `controlSkillWeCode(params: ControlSkillWeCodeParams): Promise<ControlSkillWeCodeResult>` | 同名同签名 | 无实质变更 | 低 |

## 接口字段变更明细

| 接口 | 变更项 | V4 | V5 |
|---|---|---|---|
| `createSession` | `CreateSessionParams.ak` | 必填 | 可选 |
| `createSession` | `CreateSessionParams.imGroupId` | 必填 | 可选 |
| `createSession` | `SkillSession.welinkSessionId` | `number` | `string` |
| `createSession` | `SkillSession.ak` | `string` | `string \| null` |
| `createSession` | `SkillSession.title` | `string` | `string \| null` |
| `createSession` | `SkillSession.imGroupId` | `string` | `string \| null` |
| `createSession` | `SkillSession.status` | 文档中基本为 `ACTIVE` | `ACTIVE / IDLE / CLOSED` |
| `stopSkill` | `StopSkillParams.welinkSessionId` | `number` | `string` |
| `stopSkill` | `StopSkillResult.welinkSessionId` | `number` | `string` |
| `onSessionStatusChange` | `OnSessionStatusChangeParams.welinkSessionId` | `number` | `string` |
| `regenerateAnswer` | `RegenerateAnswerParams.welinkSessionId` | `number` | `string` |
| `sendMessageToIM` | `SendMessageToIMParams.welinkSessionId` | `number` | `string` |
| `sendMessageToIM` | `SendMessageToIMResult` | `status: string` | `success: boolean` |
| `getSessionMessage` | `GetSessionMessageParams.welinkSessionId` | `number` | `string` |
| `getSessionMessage` | `PageResult.page` | `page` | `number` |
| `getSessionMessage` | `PageResult.total` | `total` | `totalElements` |
| `registerSessionListener` | `RegisterSessionListenerParams.welinkSessionId` | `number` | `string` |
| `unregisterSessionListener` | `UnregisterSessionListenerParams.welinkSessionId` | `number` | `string` |
| `sendMessage` | `SendMessageParams.welinkSessionId` | `number` | `string` |
| `replyPermission` | `ReplyPermissionParams.welinkSessionId` | `number` | `string` |
| `replyPermission` | `ReplyPermissionResult.welinkSessionId` | `number` | `string` |

## 返回模型变更

| 模型 | V4 | V5 | 说明 |
|---|---|---|---|
| `SendMessageResult` | 偏 SDK 自定义结构 | 对齐服务端 `ProtocolMessageView` | 兼容性影响较大 |
| `SessionMessage.id` | `number \| string` | `string` | 消息 ID 统一为字符串 |
| `SessionMessage.welinkSessionId` | `number` | `string` | 会话 ID 改为字符串 |
| `SessionMessage.userId` | 有 | 无 | V5 不再返回 |
| `SessionMessage.seq` | 无 | 有 | 新增字段 |
| `SessionMessage.contentType` | 无 | 有 | 新增字段 |
| `SessionMessage.meta` | 无 | 有 | 新增字段 |
| `SessionMessage.content` | `string` | `string \| null` | 改为可空 |
| `SessionMessage.messageSeq` | `number` | `number \| null` | 改为可空 |
| `SessionMessage.parts` | 必返数组 | `Array<...> \| null` | 改为可空 |
| `SessionMessagePart.toolStatus` | 有 | 无 | 更名为 `status` |
| `SessionMessagePart.toolInput` | 有 | 无 | 更名为 `input` |
| `SessionMessagePart.toolOutput` | 有 | 无 | 更名为 `output` |
| `SessionMessagePart.error` | 无 | 有 | 新增字段 |
| `SessionMessagePart.title` | 无 | 有 | 新增字段 |
| `SessionMessagePart.permType` | 无 | 有 | 新增字段 |
| `SessionMessagePart.metadata` | 无 | 有 | 新增字段 |
| `SessionMessagePart.response` | 无 | 有 | 新增字段 |

## 流式消息契约变更

| 项目 | V4 | V5 | 说明 |
|---|---|---|---|
| `StreamMessage.raw` | 有 | 无 | 原始 OpenCode 事件从公开契约中移除 |
| `StreamMessage.sourceMessageId` | 无 | 有 | 新增源消息标识 |
| `StreamMessage.seq` | 必返 | 可空 | 返回约束放宽 |
| `StreamMessage.emittedAt` | 必返 | 可空 | 返回约束放宽 |
| `snapshot.messages[]` | 结构较简化 | 结构更完整 | 增加 `welinkSessionId`、`seq`、`messageSeq`、`meta` 等字段 |
| `streaming.parts[]` | 字段较少 | 字段更完整 | 增加 `input`、`output`、`error`、`title`、`permissionId`、`permType`、`metadata`、`response` |
| `contentType` | `plain / markdown / code` | `plain / markdown` | 枚举范围收敛 |

## 文档与行为说明变更

| 项目 | V4 | V5 | 说明 |
|---|---|---|---|
| REST 返回包裹结构 | 未特别强调 | 明确为 `ApiResponse(code/data/errormsg)` | V5 明确 SDK 对外返回的是解包后的 `data` |
| SDK 与服务端映射表 | 无 | 有 | V5 明确了 SDK 接口与 REST/WS 的对应关系 |
| `createSession` 会话复用策略 | 描述较简化 | 描述更明确 | 根据是否传入 `ak` 使用不同查询条件，并按 `updatedAt` 倒序选取最新会话 |
| `getSessionMessage` 本地合并来源 | 未明确包含 `streaming` | 明确包含 `streaming` | V5 对本地缓存合并逻辑说明更完整 |

## 兼容性说明

### 高影响变更

- 主要 `welinkSessionId` 字段由 `number` 统一调整为 `string`。
- 分页返回字段由 `page`、`total` 调整为 `number`、`totalElements`。
- `sendMessage` 与 `regenerateAnswer` 的返回结构升级为更贴近服务端的消息模型。
- `sendMessageToIM` 的成功判断方式发生变化：

```ts
result.status === "success"
```

调整为：

```ts
result.success === true
```

### 建议调用方改造项

1. 所有会话 ID 按字符串处理。
2. 分页解析逻辑改为读取 `number` 与 `totalElements`。
3. 消息渲染逻辑兼容 `content`、`messageSeq`、`parts` 为空的情况。
4. `sendMessageToIM` 的成功判断改用 `success` 字段。

