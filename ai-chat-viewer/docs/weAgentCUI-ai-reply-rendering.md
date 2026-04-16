# WeAgentCUI AI 回复渲染梳理

- 项目：`ai-chat-viewer`
- 创建日期：`2026-04-09`
- 更新时间：`2026-04-09`
- 范围：基于服务端文档、SDK 文档、JSAPI 文档，梳理 `weAgentCUI` 页面如何根据服务端下发字段渲染 AI 回复，并详细说明各类型渲染时真正用到的字段

## 1. 参考文档

1. [`01-miniapp-skillserver.md`](../../01-miniapp-skillserver.md)
2. [`SkillClientSdkInterfaceV1.md`](../../SkillClientSdkInterfaceV1.md)
3. [`小程序JSAPI接口文档.md`](../../小程序JSAPI接口文档.md)

## 2. 总体链路

当前 `ai-chat-viewer` 中，AI 回复进入页面后有两条主要链路：

1. 历史消息链路  
   `HWH5EXT.getSessionMessage` / `HWH5EXT.getSessionMessageHistory` 返回 `SessionMessage`，前端通过 `sessionMessageToMessage()` 转成内部 `Message` 结构，再交给 `MessageBubble` 渲染。

2. 实时流式链路  
   `registerSessionListener` 收到 `StreamMessage`，前端在 `App.tsx` 中按 `type` 分流处理；增量消息通过 `StreamAssembler` 聚合后更新当前 assistant 消息，再交给 `MessageBubble` 渲染。

对应关键代码：

1. [`src/types/index.ts`](../src/types/index.ts)
2. [`src/utils/message.ts`](../src/utils/message.ts)
3. [`src/protocol/StreamAssembler.ts`](../src/protocol/StreamAssembler.ts)
4. [`src/App.tsx`](../src/App.tsx)
5. [`src/components/MessageBubble.tsx`](../src/components/MessageBubble.tsx)

## 3. 文档层数据模型

### 3.1 历史消息

文档中历史消息统一为 `SessionMessage`，重点字段包括：

- `id`
- `role`
- `content`
- `contentType`
- `parts`
- `createdAt`

其中真正决定 AI 回复结构化展示的是 `parts: SessionMessagePart[]`。

`SessionMessagePart.type` 当前文档支持：

- `text`
- `thinking`
- `tool`
- `question`
- `permission`
- `file`

### 3.2 实时流式消息

文档中流式事件统一为 `StreamMessage`。当前前端类型定义支持：

- `text.delta`
- `text.done`
- `thinking.delta`
- `thinking.done`
- `tool.update`
- `question`
- `file`
- `step.start`
- `step.done`
- `session.status`
- `session.title`
- `session.error`
- `permission.ask`
- `permission.reply`
- `agent.online`
- `agent.offline`
- `message.user`
- `error`
- `snapshot`
- `streaming`

## 4. 前端内部统一模型

前端不会直接把服务端数据交给 UI，而是先统一映射成：

- `Message`
- `MessagePart`

其中：

- `Message` 代表一条消息
- `MessagePart` 代表 assistant 消息内部的结构化片段

当前前端支持的 `MessagePart.type` 为：

- `text`
- `thinking`
- `tool`
- `question`
- `permission`
- `file`
- `error`

注意：`error` 不是服务端历史 `SessionMessagePart` 的标准类型，而是前端在收到 `session.error` / `error` 事件后追加出来的本地渲染类型。

## 5. 历史消息如何渲染

历史消息处理入口：

- [`sessionMessageToMessage()`](../src/utils/message.ts)
- [`mapRawPartToMessagePart()`](../src/utils/message.ts)

处理流程：

1. 读取 `SessionMessage.role`，通过 `normalizeRole()` 归一化为 `user / assistant / system / tool`
2. 保留 `content`、`contentType`、`createdAt`
3. 若存在 `parts`，通过 `mapRawParts()` 转为 `MessagePart[]`
4. `MessageBubble` 优先渲染 `message.parts`
5. 若没有可展示的 `parts`，才回退渲染 `message.content`

补充规则：

- `thinking` / `reasoning` 会归一成 `thinking`
- `question` 会优先从 `input.questions[0]` 或 `input.header/question/options` 提取题面信息
- `permission` 会根据 `response / status` 推导 `permResolved`
- `question` 会根据 `answered / status / output` 推导 `answered`

## 6. 实时流式消息如何渲染

实时处理入口：

- [`onMessageRef.current`](../src/App.tsx)
- [`StreamAssembler.handleMessage()`](../src/protocol/StreamAssembler.ts)

处理流程：

1. `App.tsx` 收到 `StreamMessage`
2. 对 `text.delta`、`thinking.delta`、`tool.update`、`question`、`permission.ask`、`file` 等结构化事件，交给 `StreamAssembler`
3. `StreamAssembler` 聚合成当前 assistant 消息的 `parts`
4. `App.tsx` 把聚合结果写入当前正在输出的 assistant 消息
5. `MessageBubble` 根据 `parts` 渲染对应组件
6. 当收到 `session.status = idle` 时，结束当前流式消息

## 7. 各类型字段到渲染组件的映射

| 类型 | 文档字段来源 | 前端实际使用字段 | 内部映射 | 最终渲染 |
| --- | --- | --- | --- | --- |
| 文本 | `SessionMessagePart.type=text` / `text.delta` / `text.done` | `content` | `MessagePart.type='text'` | Markdown 文本 |
| 思考 | `SessionMessagePart.type=thinking` / `thinking.delta` / `thinking.done` | `content` `isStreaming` | `MessagePart.type='thinking'` | `ThinkingBlock` |
| 工具 | `tool.update` | `toolName` `toolCallId` `status` `title` `input` `output` `error` | `MessagePart.type='tool'` | `ToolCard` |
| 问题 | `SessionMessagePart.type=question` / `question` | `header` `question` `options` `toolName` `toolCallId` `status` `input` `output` `content` `answered` | `MessagePart.type='question'` | `QuestionCard` |
| 权限 | `SessionMessagePart.type=permission` / `permission.ask` / `permission.reply` | `permissionId` `permType` `title` `content` `response` `status` `toolName` `permResolved` | `MessagePart.type='permission'` | `PermissionCard` |
| 文件 | `SessionMessagePart.type=file` / `file` | `fileName` `fileUrl` `fileMime` | `MessagePart.type='file'` | 文件附件块 |
| 错误 | `session.error` / `error` | `error` | `MessagePart.type='error'` | `ErrorBlock` |

## 8. 渲染前会先消费的通用字段

在进入具体卡片组件之前，`MessageBubble` 会先消费一层消息级字段：

| 字段 | 所在层级 | 作用 |
| --- | --- | --- |
| `message.role` | `Message` | 判断是用户消息还是 AI 消息，决定左右布局、头像和气泡样式 |
| `message.timestamp` | `Message` | 渲染消息时间 |
| `message.parts` | `Message` | 若存在则优先使用，不直接渲染 `message.content` |
| `message.content` | `Message` | 仅在无可展示 `parts` 时作为回退内容 |
| `message.isHistory` | `Message` | 历史 assistant 消息中的 `question` / `permission` 会进入只读态 |
| `message.isStreaming` | `Message` | 配合卡片内部状态使用，控制流式中的展示状态 |

补充规则：

1. `message.parts` 会先经过 `syncToolCallIdForQuestionParts()`，用于把前序 `tool` 的 `toolCallId` 同步给后续 `question`
2. `message.parts` 会再经过 `shouldRenderPart()` 过滤，空字段的 part 不会渲染
3. 如果 `message.content === ''`，且没有任何可渲染 `parts`，则整条消息不显示

## 9. 渲染过滤规则

真正进入具体组件之前，`MessageBubble` 还会根据 `part.type` 判断“这块是否值得显示”。

### 9.1 `text / thinking / error`

判断条件：

- `part.content` 必须是非空白字符串

### 9.2 `tool`

满足以下任一条件就会显示：

- `part.content` 有值
- `part.toolName` 有值
- `part.title` 有值
- `part.output` 有值
- `part.error` 有值
- `part.input` 有值
- `part.status` 有值

### 9.3 `question`

满足以下任一条件就会显示：

- `part.content` 有值
- `part.header` 有值
- `part.question` 有值
- `part.options` 有选项
- `part.output` 有值
- `part.answered` 为真

### 9.4 `permission`

满足以下任一条件就会显示：

- `part.content` 有值
- `part.permType` 有值
- `part.permissionId` 有值
- `part.response` 有值
- `part.permResolved` 为真

### 9.5 `file`

满足以下任一条件就会显示：

- `part.content` 有值
- `part.fileName` 有值
- `part.fileUrl` 有值

## 10. 各类型渲染时用到的具体字段

下面的“渲染字段”分为两类：

1. 直接显示字段：会真正出现在页面文案或内容里
2. 控制字段：不一定直接显示，但会控制是否可点、是否展开、是否显示结果态等

### 10.1 `text`

对应渲染位置：

- `MessageBubble -> renderPart('text') -> .text-part -> ReactMarkdown`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.content` | `SessionMessagePart.content` 或流式拼接结果 | Markdown 正文内容 | 是 |
| `message.content` | `Message.content` | 当没有 `parts` 时作为回退正文 | 是 |
| `message.role` | `Message.role` | 判断是否按 assistant/tool 走 Markdown 渲染 | 否 |

字段规则：

1. 有 `parts` 时优先用 `part.content`
2. 无 `parts` 时才回退用 `message.content`
3. `content` 为空字符串时，不渲染文本块
4. 代码块、表格、数学公式等都来自 `content` 中的 Markdown 内容

### 10.2 `thinking`

对应渲染位置：

- `MessageBubble -> ThinkingBlock`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.content` | `thinking` / `reasoning` 内容 | 思考内容正文 | 是 |
| `part.isStreaming` | 流式状态 | 控制是否显示“思考中...” | 否 |

在 `ThinkingBlock` 中的具体表现：

1. 标题文案“思考过程”为固定文案，不依赖服务端字段
2. `part.isStreaming = true` 时，头部额外显示“思考中...”
3. `part.content` 通过 `ReactMarkdown` 渲染，支持 Markdown
4. 组件默认展开，点击头部通过本地 `expanded` 状态控制收起，不依赖服务端字段

### 10.3 `tool`

对应渲染位置：

- `MessageBubble -> ToolCard`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.status` | `tool.update.status` | 决定状态文案、状态图标、卡片样式类名 | 是 |
| `part.toolName` | `tool.update.toolName` | 工具名 | 是 |
| `part.title` | `tool.update.title` | 工具标题补充文案 | 是 |
| `part.input` | `tool.update.input` | 展开态下展示 Input JSON | 是 |
| `part.output` | `tool.update.output` | 展开态下展示 Output | 是 |
| `part.content` | 由 `msg.error` 写入 | 当 `status = error` 时展示错误文本 | 是 |
| `part.toolCallId` | `tool.update.toolCallId` | 用于链路关联 | 否 |

字段规则：

1. `status` 缺失时默认为 `pending`
2. 头部固定显示：
   - 状态图标
   - `toolName`，为空则显示 `Tool call`
   - `title`，有值才显示
   - 状态文案
3. 展开后：
   - `input` 有值时显示 `Input`
   - `output` 有值时显示 `Output`
   - `status === 'error' && part.content` 时显示 `Error`

### 10.4 `question`

对应渲染位置：

- `MessageBubble -> QuestionCard`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.header` | `header` 或 `input.questions[0].header` | 问题分组标题 | 是 |
| `part.question` | `question` 或 `input.questions[0].question` | 问题正文 | 是 |
| `part.content` | `content` 或回退到 `question` | 当 `question` 为空时作为题面回退 | 是 |
| `part.options[].label` | `options` | 选项主文案 | 是 |
| `part.options[].description` | `options` 对象数组 | 选项补充说明 | 是 |
| `part.output` | question 回答结果 | 用于显示“已回答”内容 | 是 |
| `part.answered` | 本地归一化结果 | 控制是否进入已回答态 | 否 |
| `part.toolCallId` | `toolCallId` | 用户提交回答时回传给后端 | 否 |

字段优先级与规则：

1. 题面来源优先级：
   - `part.question`
   - `part.content`

2. `part.header`
   - 有值时渲染顶部标题区
   - 无值则不显示

3. `part.options`
   - 有值且长度大于 0 时，逐项渲染按钮
   - 每个选项按钮显示：
     - `opt.label`
     - `opt.description`，有值时显示第二行说明

4. `part.output`
   - 通过 `getAnswerText(part)` 读取
   - 若是非空字符串，会作为已回答结果展示

5. `part.answered`
   - 与 `part.output` 一起控制是否锁定交互
   - `answered || output` 时：
     - 选项不可再点
     - 输入框不可再提交
     - 底部显示“已回答”结果块

6. `part.toolCallId`
   - 不显示在 UI
   - 点击选项或提交输入时，作为 `onAnswered({ answer, toolCallId })` 的参数回传

7. `message.isHistory`
   - 来自父层 `readonly`
   - 历史消息的 `question` 块为只读

### 10.5 `permission`

对应渲染位置：

- `MessageBubble -> PermissionCard`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.permType` | `permission.ask.permType` | 显示权限类型文案 | 是 |
| `part.toolName` | `permission.ask.toolName` | 显示触发该权限的工具名 | 是 |
| `part.content` | `title` 或 `content` | 显示权限说明正文 | 是 |
| `part.response` | `permission.reply.response` | 显示已确认结果文案 | 是 |
| `part.permResolved` | 本地归一化结果 | 控制是否显示操作按钮或结果态 | 否 |
| `part.permissionId` | `permission.ask.permissionId` | 用户点击允许/拒绝时回传给后端 | 否 |
| `welinkSessionId` | 父层 props | 调 `replyPermission` 时需要 | 否 |

字段规则：

1. `part.permType`
   - 先通过 `permTypeLabels` 做映射
   - 若映射不到，则直接显示原始 `permType`
   - 再兜底为“操作授权”

2. `part.toolName`
   - 有值时显示为“工具: xxx”

3. `part.content`
   - 作为权限说明正文展示

4. `part.response`
   - 若为 `once / always / reject`，会映射为中文文案
   - 其他字符串则直接显示原值

5. `part.permResolved`
   - 为 `true` 时显示结果态，不再显示三个操作按钮
   - 为 `false` 时显示“允许 / 始终允许 / 拒绝”

6. `part.permissionId`
   - 点击按钮后调用 `replyPermission({ welinkSessionId, permId: part.permissionId, response })`
   - 自身不显示在 UI

### 10.6 `file`

对应渲染位置：

- `MessageBubble -> renderPart('file') -> .file-part`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.fileUrl` | `file.fileUrl` | 决定渲染为链接还是普通文本 | 是 |
| `part.fileName` | `file.fileName` | 文件名文案 | 是 |
| `part.content` | 兼容字段 | `shouldRenderPart()` 判断可见性时参与兜底 | 一般不直接显示 |
| `part.fileMime` | `file.fileMime` | 当前仅保留，不直接展示 | 否 |

字段规则：

1. 若 `fileUrl` 有值，则渲染为可点击链接
2. 链接文案优先取 `fileName`，否则显示“文件”
3. 若 `fileUrl` 无值，则只显示文本文件名
4. `fileMime` 当前不直接渲染，只作为数据保留

### 10.7 `error`

对应渲染位置：

- `MessageBubble -> ErrorBlock`

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `part.content` | `session.error.error` 或 `error.error` | 错误正文 | 是 |

`ErrorBlock` 中的使用方式：

1. 标题 `Error` 为固定文案
2. 图标 `!` 为固定字符
3. 真正来自服务端并显示给用户的只有 `part.content`

### 10.8 `message.user`

虽然不是 assistant part，但在消息渲染层也会直接影响页面显示。

渲染时实际使用字段：

| 字段 | 来源 | 作用 | 是否直接显示 |
| --- | --- | --- | --- |
| `msg.messageId` | `message.user.messageId` | 作为消息 ID，防止重复插入 | 否 |
| `msg.content` | `message.user.content` | 用户消息正文 | 是 |
| `msg.emittedAt` | `message.user.emittedAt` | 作为消息时间戳 | 否 |

字段规则：

1. 若 `messageId` 为空或已存在，则不新增消息
2. 新增后会作为普通用户消息气泡渲染
3. `message.user` 同时也是“新一轮 assistant 回复开始”的边界信号：若当前仍存在上一轮 assistant 的流式消息目标块，需先结束并清空该流式上下文，并打开独立的“正在生成中，请稍等...”预览块；该预览块不在 `handleGenerate`、`step.start`、`session.status=busy` 等更早阶段提前显示

### 10.9 `snapshot`

该类型不直接对应一种卡片，但会整批恢复消息。

渲染时实际使用字段：

| 字段 | 来源 | 作用 |
| --- | --- | --- |
| `msg.messages` | `snapshot.messages` | 重建完整消息列表 |
| `messages[].role` | 快照消息 | 决定左右布局 |
| `messages[].content` | 快照消息 | 回退正文 |
| `messages[].contentType` | 快照消息 | 保留语义 |
| `messages[].parts` | 快照消息 | 重建结构化卡片 |
| `messages[].createdAt` | 快照消息 | 还原消息时间 |

### 10.10 `streaming`

该类型也不直接渲染单一卡片，而是恢复“正在输出中的消息”。

渲染时实际使用字段：

| 字段 | 来源 | 作用 |
| --- | --- | --- |
| `msg.role` | `streaming.role` | 决定消息角色 |
| `msg.parts` | `streaming.parts` | 恢复当前消息的结构化 part |
| `msg.sessionStatus` | `streaming.sessionStatus` | 更新会话状态 |

其中 `msg.parts` 内部仍继续使用上面各类型自己的字段规则。

## 11. 不直接生成消息块的事件

以下事件更多用于控制状态，不直接对应某个消息卡片：

- `step.start`
- `step.done`
- `session.status`
- `session.title`
- `agent.online`
- `agent.offline`

当前实际作用如下：

- `step.start`
  - 将会话状态切换为 `busy`

- `step.done`
  - 把 `tokens`、`cost` 写入当前消息的 `meta`

- `session.status`
  - `busy / retry` 时更新会话执行状态
  - `idle` 时结束当前流式 assistant 消息

- `session.title`
  - 更新历史会话列表中的标题
  - 不直接渲染在消息区

- `agent.online / agent.offline`
  - 类型已定义，但当前消息 UI 不直接消费为消息块

## 12. `message.user`、`snapshot`、`streaming` 的特殊性

### 12.1 `message.user`

该类型不是 assistant part，而是直接新增一条 `role='user'` 的消息，用于多端消息漫游时同步用户消息。

### 12.2 `snapshot`

该事件用于断线恢复时重建完整消息列表：

- 读取 `msg.messages`
- 逐条调用 `snapshotMessageToMessage()`
- 直接替换当前消息列表

### 12.3 `streaming`

该事件用于恢复“正在输出中的消息”：

- 读取 `msg.parts`
- 使用 `mapRawParts(msg.parts, true)` 直接生成当前流式消息
- 不再逐条走 `text.delta` / `tool.update` 的增量拼装过程

## 13. `contentType` 在当前项目中的作用

当前项目中，`contentType` 会被保留到 `Message` 上，但它不是 AI 回复卡片分发的主要依据。

当前真正决定渲染组件的是：

1. 优先看 `message.parts`
2. 再看 `part.type`
3. 如果没有 `parts`，才回退到 `message.content`

因此：

- `contentType` 更偏向消息语义保留和回退渲染辅助
- AI 回复展示成文本块、问题块、权限块、工具块，核心仍由 `parts/type` 决定

## 14. 当前页面的最终渲染规则

[`MessageBubble.tsx`](../src/components/MessageBubble.tsx) 中的核心规则如下：

1. `messages` 列表中只渲染真实消息，不再包含“正在生成中，请稍等...”占位消息
2. 独立占位块由页面级临时状态单独渲染，不参与正式消息身份管理
3. 若 `message.parts` 存在，则优先渲染 `parts`
4. `parts` 渲染前会先做过滤，空内容块不会展示
5. 若 `message.parts` 不存在或没有可展示内容，则回退渲染 `message.content`
5. 若 `message.content === ''`，该消息不渲染

当前 `renderPart()` 分发关系：

- `thinking` -> `ThinkingBlock`
- `tool` -> `ToolCard`
- `question` -> `QuestionCard`
- `permission` -> `PermissionCard`
- `file` -> 文件附件块
- `error` -> `ErrorBlock`
- `text` -> Markdown 文本

## 15. 结论

`ai-chat-viewer` 当前对 AI 回复的渲染，本质上是把服务端/SDK 下发的 `SessionMessage` 与 `StreamMessage` 统一归一成 `Message + MessagePart`，再由 `MessageBubble` 按 `part.type` 分发到不同 UI 组件。

可以把这套机制总结为：

- 历史消息：`SessionMessage -> sessionMessageToMessage -> MessageBubble`
- 实时消息：`StreamMessage -> App.tsx / StreamAssembler -> MessageBubble`
- 卡片渲染依据：`MessagePart.type`
- 文本代码块依据：Markdown 内容本身
- 错误展示依据：`session.error / error` 事件转本地 `error` part

这也是后续排查“某类 AI 回复为什么没显示”“某个字段为什么没生效”时最关键的定位路径。
