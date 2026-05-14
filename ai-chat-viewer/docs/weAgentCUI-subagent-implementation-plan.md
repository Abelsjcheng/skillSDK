# WeAgentCUI Subagent 实现方案

## 1. 背景与目标

参考文档：

- [2026-04-01-subagent-miniapp-display-design.md](</F:/AIProject/opencode-CUI-main/opencode-CUI-main/docs/superpowers/specs/2026-04-01-subagent-miniapp-display-design.md>)

目标是在 `weAgentCUI` 中实现接近 OpenCode miniapp 的 subagent 展示与交互效果，具体包括：

1. 在主对话流中展示 subagent 的执行过程。
2. 支持 subagent 的 `text / thinking / tool / file` 内容按折叠块聚合展示。
3. 支持 subagent 发起的 `permission` 和 `question` 冒泡到主对话流。
4. 支持用户对冒泡出来的 `permission / question` 进行交互，并将回复路由回对应 subagent。
5. 支持历史消息恢复与断线恢复后的 subagent 内容重建。

本方案仅针对 `ai-chat-viewer` 的 `weAgentCUI` 前端实现，不覆盖 Plugin / Gateway / Skill Server 的代码实现细节，但会明确依赖的协议前提。

---

## 2. 当前实现现状

当前 `weAgentCUI` 主链路如下：

- 页面入口在 [weAgentCUI.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/weAgentCUI.tsx)
- 聊天主逻辑在 [App.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/App.tsx)
- 流式 Part 聚合器在 [StreamAssembler.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/protocol/StreamAssembler.ts)
- 历史消息与流式 Part 映射在 [message.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/message.ts)
- 消息渲染入口在 [MessageBubble.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/MessageBubble.tsx)
- 问题与权限交互组件在 [QuestionCard.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/QuestionCard.tsx) 和 [PermissionCard.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/PermissionCard.tsx)

现状特征：

1. `App.tsx` 当前按 `messageId` 维护单条正在输出的 assistant 消息，核心依赖 `streamingMsgIdRef + StreamAssembler`。
2. `StreamAssembler` 仅支持把单条 assistant 消息聚合为普通 `MessagePart[]`，不支持“消息内再嵌套 subtask 容器”。
3. `MessageBubble` 只支持线性渲染 `text / thinking / tool / question / permission / file / error`，不支持 `subtask` 类型。
4. `QuestionCard` 上抛参数只有 `answer + toolCallId`，`PermissionCard` 直接调用 `replyPermission` 时也只传 `welinkSessionId + permId + response`。
5. 当前类型定义 [types/index.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/types/index.ts) 与桥接参数定义 [types/bridge/hwext.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/types/bridge/hwext.ts) 中均未引入 `subagentSessionId / subagentName`。

结论：当前代码基础可以复用消息流分发、历史恢复、卡片渲染和宿主桥接能力，但还缺少 subagent 所需的数据承载层、聚合层和 UI 容器层。

---

## 3. 协议前提

要在 `weAgentCUI` 落地 subagent，前端依赖以下协议前提成立：

### 3.1 StreamMessage 增加 subagent 字段

WebSocket / JSAPI `StreamMessage` 需要支持：

- `subagentSessionId?: string`
- `subagentName?: string`

它们主要出现在：

- `tool.update`
- `question`
- `permission.ask`
- `permission.reply`
- `text.delta / text.done`
- `thinking.delta / thinking.done`
- `file`
- `streaming`

### 3.2 历史消息 Part 增加 subagent 字段

历史消息接口 `getSessionMessageHistory` / `getSessionMessage` 返回的 `SessionMessagePart` 需要支持：

- `subagentSessionId?: string`
- `subagentName?: string`

这样前端才能在刷新页面、切换会话、断线恢复时重建 subagent 折叠块。

### 3.3 交互接口增加 subagentSessionId 入参

桥接层需要支持：

- `sendMessage(params)` 增加 `subagentSessionId?: string`
- `replyPermission(params)` 增加 `subagentSessionId?: string`

这样 question / permission 的用户回复才能回到真实子 session，而不是误发到主 session。

---

## 4. 目标效果

目标效果采用“折叠块 + 冒泡交互”的模型。

### 4.1 折叠块展示

对于 subagent 的普通内容：

- `text`
- `thinking`
- `tool`
- `file`

统一归入主消息中的一个 `SubtaskBlock`。

每个 `SubtaskBlock` 至少展示：

- `subagentName`
- prompt 摘要
- 运行状态：`running / completed / error`
- tool 数量
- 折叠/展开状态

### 4.2 冒泡交互

对于 subagent 的阻塞交互：

- `question`
- `permission.ask`

既要归入对应 `SubtaskBlock`，也要在主对话流中单独渲染可操作卡片。

主对话流中的冒泡卡片需要显示来源：

- `[subagentName]`

用户操作后：

- `question` 通过 `sendMessage({ ..., toolCallId, subagentSessionId })` 回答
- `permission` 通过 `replyPermission({ ..., permId, response, subagentSessionId })` 回复

---

## 5. 前端实现方案

## 5.1 类型层改造

文件：

- [types/index.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/types/index.ts)
- [types/bridge/hwext.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/types/bridge/hwext.ts)
- [types/components/chat.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/types/components/chat.ts)

### 5.1.1 扩展 StreamMessage

在 `StreamMessage` 中新增：

```ts
subagentSessionId?: string | null;
subagentName?: string | null;
```

### 5.1.2 扩展 SessionMessagePart / MessagePart

在 `SessionMessagePart`、`MessagePartSnapshot`、`MessagePart` 中新增：

```ts
subagentSessionId?: string;
subagentName?: string;
```

### 5.1.3 新增 subtask 类型

将 `MessagePartType` 从：

```ts
'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file' | 'error'
```

扩展为：

```ts
'text' | 'thinking' | 'tool' | 'question' | 'permission' | 'file' | 'error' | 'subtask'
```

并在 `MessagePart` 上增加 subtask 专用字段：

```ts
subagentPrompt?: string;
subagentStatus?: 'running' | 'completed' | 'error';
subParts?: MessagePart[];
bubbleToMainFlow?: boolean;
```

说明：

- `subtask` 是 `weAgentCUI` 前端聚合态，不要求服务端直接返回该类型。
- 服务端继续返回普通 part，前端在接收到 subagent 事件后再组装为 `subtask`。

### 5.1.4 扩展交互参数

在桥接类型中补充：

```ts
interface SendMessageParams {
  welinkSessionId: string;
  content: string;
  toolCallId?: string;
  subagentSessionId?: string;
}

interface ReplyPermissionParams {
  welinkSessionId: string;
  permId: string;
  response: 'once' | 'always' | 'reject';
  subagentSessionId?: string;
}
```

同时扩展：

```ts
interface QuestionAnswerSubmission {
  answer: string;
  toolCallId?: string;
  subagentSessionId?: string;
}
```

---

## 5.2 消息映射层改造

文件：

- [message.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/message.ts)

### 5.2.1 保留 subagent 元信息

在 `mapRawPartToMessagePart()` 中，把原始 part 上的：

- `subagentSessionId`
- `subagentName`

透传到 `MessagePart`。

### 5.2.2 扩展可见性判断

`shouldRenderMessagePart()` 需要新增 `subtask` 分支，规则建议为：

- 标题存在可见内容时渲染
- `subParts` 中存在任一可见 part 时渲染
- 允许空内容但带状态的 subtask 容器渲染

### 5.2.3 新增 subtask 组装工具

建议新增工具函数：

- `groupSubagentPartsIntoSubtasks(parts: MessagePart[]): MessagePart[]`
- `appendSubagentPartToMessage(message, streamMessage)`
- `bubbleSubagentInteractivePart(streamMessage): MessagePart | null`

职责拆分：

1. 普通历史消息：
   - 将相同 `subagentSessionId` 的 part 聚合成一个 `subtask` part
2. 流式消息：
   - 将 subagent part 追加到对应 subtask 的 `subParts`
3. 冒泡交互：
   - 单独生成主对话流里的 `question` / `permission` 卡片

---

## 5.3 流式处理层改造

文件：

- [App.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/App.tsx)
- [StreamAssembler.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/protocol/StreamAssembler.ts)

### 5.3.1 改造原则

当前 `StreamAssembler` 是“单条 assistant 消息线性聚合器”。为了尽量减少重写，建议保持它对主消息普通 part 的职责不变，subagent 逻辑放在 `App.tsx` 外层分发。

建议采用：

- 主消息仍由 `StreamAssembler` 负责普通 part 聚合
- subagent part 不直接进入原有 assembler
- `App.tsx` 在 `onMessageRef.current` 中优先识别 `msg.subagentSessionId`

### 5.3.2 新增 subagent 分发逻辑

建议在 `App.tsx` 中新增：

- `handleSubagentMessage(msg: StreamMessage)`
- `streamMessageToSubPart(msg: StreamMessage): MessagePart | null`
- `upsertSubtaskBlock(messageId, subagentSessionId, updater)`

处理策略：

1. 若 `msg.subagentSessionId` 不存在：
   - 继续走当前普通消息链路
2. 若 `msg.subagentSessionId` 存在：
   - 用 `msg.messageId ?? msg.sourceMessageId` 定位所属主消息
   - 在该主消息的 `parts` 中查找或创建 `type = 'subtask'` 的容器
   - 将 `text / thinking / tool / file` 追加到 `subtask.subParts`
   - 将 `question / permission.ask` 同时：
     - 写入 `subtask.subParts`
     - 冒泡为主对话流中的交互卡片
   - 将 `permission.reply` / `question completed` 结果同步回：
     - 冒泡卡片
     - `subtask.subParts`

### 5.3.3 subtask 状态维护

根据设计文档，前端要维护 subtask 状态，建议规则：

- 初次看到某个 `subagentSessionId` 时：`running`
- 收到带 `status = completed` / `error` 的 subagent 相关 part 时：更新为对应状态
- 若后续收到历史恢复内容时，优先根据已有 `subParts` 推导最终状态

说明：

- 当前协议里没有明确独立的 `subtask status` 事件，所以状态主要基于 tool / question / permission 结果和服务端聚合结果推导。

---

## 5.4 UI 组件层改造

文件：

- [MessageBubble.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/MessageBubble.tsx)
- [QuestionCard.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/QuestionCard.tsx)
- [PermissionCard.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/PermissionCard.tsx)
- 新增 `SubtaskBlock.tsx`

### 5.4.1 新增 SubtaskBlock 组件

建议新增：

- `src/components/SubtaskBlock.tsx`

输入：

- `part: MessagePart`，其中 `part.type === 'subtask'`
- `onQuestionAnswered`
- `onPermissionResolved`

展示内容：

- 头部：`subagentName + 状态 + prompt 摘要 + tool 数`
- 内容区：按顺序渲染 `subParts`

子内容渲染建议：

- `text` -> 文本块
- `thinking` -> 复用 `ThinkingBlock`
- `tool` -> 复用 `ToolCard`
- `file` -> 复用现有文件展示
- `question / permission` -> 默认在 `subtask` 内只读展示或弱化展示，主交互仍以主流冒泡卡片为准

### 5.4.2 扩展 MessageBubble

在 `renderPart()` 中增加：

```tsx
case 'subtask':
  return <SubtaskBlock ... />
```

并保持现有线性 part 渲染顺序。

### 5.4.3 扩展 PermissionCard / QuestionCard

为两个组件新增 props：

- `subagentName?: string`
- `subagentSessionId?: string`

用途：

1. 标题处显示来源标签 `[subagentName]`
2. 提交交互时把 `subagentSessionId` 往上带

其中：

- `QuestionCard` 通过 `onAnswered({ answer, toolCallId, subagentSessionId })`
- `PermissionCard` 在 `replyPermission(...)` 时追加 `subagentSessionId`

### 5.4.4 样式改造

文件：

- [Content.less](/F:/AIProject/skillSDK/ai-chat-viewer/src/styles/Content.less)

新增样式块：

- `.subtask-block`
- `.subtask-block__header`
- `.subtask-block__content`
- `.subtask-block__agent-name`
- `.subtask-block__status`
- `.question-card__source`
- `.permission-card__source`

样式原则：

- 不破坏当前 `weAgentCUI` 视觉语言
- 折叠块使用浅边框 + 次级背景，与 `ToolCard/PermissionCard` 层级区分
- 冒泡来源标签弱化展示，不干扰主文案

---

## 5.5 交互链路改造

### 5.5.1 Question 回答链路

当前：

- `QuestionCard` -> `App.handleQuestionAnswered()` -> `sendUserMessage(answer, toolCallId)`

改造后：

- `QuestionCard` -> `App.handleQuestionAnswered({ answer, toolCallId, subagentSessionId })`
- `sendUserMessage()` 扩展为：

```ts
sendUserMessage(content, toolCallId?, subagentSessionId?)
```

并调用：

```ts
sendMessageApi({
  welinkSessionId,
  content,
  ...(toolCallId ? { toolCallId } : {}),
  ...(subagentSessionId ? { subagentSessionId } : {}),
})
```

### 5.5.2 Permission 回复链路

当前：

- `PermissionCard` 组件内部直接调用 `replyPermission({ welinkSessionId, permId, response })`

改造后：

```ts
replyPermission({
  welinkSessionId,
  permId,
  response,
  ...(subagentSessionId ? { subagentSessionId } : {}),
})
```

这样既兼容主会话，也支持子 session。

---

## 5.6 历史恢复与断线恢复

### 5.6.1 历史消息恢复

当前 `getSessionMessageHistory()` 返回后会执行：

- `sessionMessageToMessage()`
- `mapRawParts()`

改造后建议增加一层：

- `sessionMessageToMessage()` 内部或外部调用 `groupSubagentPartsIntoSubtasks()`

即：

1. 普通 part 保持原样
2. 带 `subagentSessionId` 的 part 聚合成 `subtask`
3. `question / permission` 是否需要在历史消息中再次冒泡：
   - 建议不额外生成重复冒泡块
   - 历史态只在 `subtask` 内与原消息结构中保留只读展示

### 5.6.2 snapshot / streaming 恢复

当前 `snapshot` 和 `streaming` 会分别走：

- `snapshotMessageToMessage()`
- `mapRawParts(msg.parts, true)`

改造后同样需要在这两个入口加入 subtask 聚合逻辑，避免刷新后 subagent 结构丢失。

---

## 6. 推荐实施步骤

### Phase 1：协议与类型打底

1. 扩展 `types/index.ts`
2. 扩展 `types/bridge/hwext.ts`
3. 扩展 `QuestionAnswerSubmission` 与组件 props

### Phase 2：消息映射与历史恢复

1. 在 `message.ts` 保留 subagent 元信息
2. 新增 subtask 聚合函数
3. 接入历史消息 / snapshot 恢复

### Phase 3：流式分发

1. 在 `App.tsx` 中新增 `handleSubagentMessage`
2. 将 subagent 普通 part 聚合进 `subtask`
3. 将 `question / permission.ask` 冒泡到主流
4. 将 `permission.reply / question completed` 回写主流与 subtask

### Phase 4：UI 组件

1. 新增 `SubtaskBlock.tsx`
2. 扩展 `MessageBubble.tsx`
3. 扩展 `QuestionCard.tsx`
4. 扩展 `PermissionCard.tsx`
5. 增加 `Content.less` 样式

### Phase 5：联调验证

重点验证场景：

1. 单 subagent 执行
2. 多并行 subagent 执行
3. subagent `question` 回答
4. subagent `permission` 回复
5. 刷新页面后的历史恢复
6. `snapshot` 恢复后结构不重复
7. 主会话 question / permission 不受影响

---

## 7. 风险与注意事项

### 7.1 当前 StreamAssembler 是单消息模型

如果强行把 subagent 也塞进现有 assembler，会让普通流和子任务流耦合过深。建议把 subagent 分发放在 `App.tsx` 外层做条件分流，尽量不重写 assembler 主体。

### 7.2 messageId 与 sourceMessageId 的归属关系

设计文档中提到 subagent 事件归属到主消息时，前端可能需要用：

- `msg.messageId`
- 或 `msg.sourceMessageId`

建议优先使用：

```ts
const ownerMessageId = msg.messageId ?? msg.sourceMessageId;
```

如果服务端在不同事件类型上的字段不稳定，需要在联调时补齐规范。

### 7.3 历史态与实时态避免重复冒泡

实时态下 `question / permission` 需要冒泡；历史态下如果既保留在 `subtask` 内，又重新冒泡，会造成重复展示。

建议策略：

- 实时流：冒泡
- 历史恢复：不重复追加新的冒泡块，只保留历史消息中的结构化 part

### 7.4 交互成功后的状态同步

用户已经回答了 question 或回复了 permission 后，需要同时更新：

1. 主流中的冒泡卡片
2. `subtask` 内对应 part

否则会出现主流显示已处理，但折叠块里仍是未处理状态。

---

## 8. 最终建议

建议采用“协议补齐 + 前端聚合 + UI 折叠块 + 交互冒泡”的方案，不改动 `weAgentCUI` 现有主消息模型的核心结构，只在现有链路上增加一层 subagent 分发与聚合能力。

这样做的好处是：

1. 对现有 `App.tsx`、`MessageBubble`、`QuestionCard`、`PermissionCard` 的复用率高。
2. 不需要推翻当前 `StreamAssembler` 的普通消息聚合能力。
3. 可以先支持核心效果，再逐步细化 subtask 状态、统计信息和视觉表现。

如果进入实现阶段，建议优先做这 4 个最小闭环：

1. 类型与桥接参数补齐 `subagentSessionId / subagentName`
2. `App.tsx` 支持 subagent 流式分发
3. `MessageBubble` 支持 `SubtaskBlock`
4. `QuestionCard / PermissionCard` 支持带 `subagentSessionId` 回传

做到这一步，`weAgentCUI` 就能具备第一版可用的 OpenCode subagent 体验。
