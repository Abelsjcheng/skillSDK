# WeAgentCUI `opencode` 返回 Case 用例与提示词

## 1. 文档目标

本文档用于梳理 [`weAgentCUI`](../src/pages/weAgentCUI.tsx) 对话页当前支持的 `opencode`/流式协议返回 case，方便用于：

- 联调服务端返回协议
- 补充本地 JSAPI mock 场景
- 评审 UI 渲染是否完整
- 设计回归测试用例

这里的 `opencode` 返回，按当前工程实现，统一映射为 [`StreamMessage`](../src/types/index.ts) 事件流，并由 [`App.tsx`](../src/App.tsx)、[`StreamAssembler.ts`](../src/protocol/StreamAssembler.ts)、[`MessageBubble.tsx`](../src/components/MessageBubble.tsx) 共同消费。

## 2. 实现基线

### 2.1 当前真正被 `weAgentCUI` 消费的返回类型

- `text.delta`
- `text.done`
- `thinking.delta`
- `thinking.done`
- `tool.update`
- `question`
- `permission.ask`
- `permission.reply`
- `file`
- `step.start`
- `step.done`
- `session.status`
- `session.error`
- `error`
- `snapshot`
- `streaming`

### 2.2 类型里定义但当前页面未消费的返回类型

- `session.title`
- `agent.online`
- `agent.offline`

这些类型虽然在 [`src/types/index.ts`](../src/types/index.ts) 中已定义，但 [`src/App.tsx`](../src/App.tsx) 里没有对应分支，当前返回后不会产生可见 UI 变化。

## 3. 总览矩阵

| Case ID | 返回类型 | 是否已实现 | 主要 UI 表现 | 推荐联调提示词 |
| --- | --- | --- | --- | --- |
| C01 | `text.delta` + `text.done` | 是 | 普通文本流式输出 | `请总结这个 SDK 对话页的能力，并分点输出。` |
| C02 | `text.*`（Markdown） | 是 | Markdown/代码块/公式渲染 | `请用 markdown 输出一段 TypeScript 示例，再补一个公式。` |
| C03 | `thinking.*` + `text.*` | 是 | 先展示思考块，再展示正文 | `请先给出分析思路，再给出最终方案。` |
| C04 | `tool.update` | 是 | 工具卡片状态流转 | `请调用搜索/命令工具定位 weAgentCUI 的核心逻辑后再总结。` |
| C05 | `tool.update` + `question` | 是 | 工具卡片后跟追问卡片 | `如果缺少信息，请先问我 2 个选项问题，再继续执行。` |
| C06 | `question` | 是 | 独立追问卡片，支持选项与自定义输入 | `在回答前先确认我要 Android、iOS 还是 Harmony。` |
| C07 | `permission.ask` + `permission.reply` | 是 | 权限申请卡片及结果回填 | `写文件前先申请 file_write 权限，获批后再继续。` |
| C08 | `file` | 是 | 文件产物卡片/下载链接 | `生成一个 release-notes.md 文件并返回下载项。` |
| C09 | `step.start` + `step.done` | 部分 | 不直接渲染，仅更新 tokens/cost 元数据 | `请分步骤执行并返回 token 消耗。` |
| C10 | `session.status` | 是 | 控制生成中/空闲态与停止逻辑 | `给我一段较长的回答，方便中途点停止。` |
| C11 | `session.error` | 是 | 在当前助手消息内追加错误块 | `mock-session-error` 或 `触发session.error` |
| C12 | `error` | 是 | 在当前助手消息内追加错误块 | `mock-error` 或 `error` |
| C13 | `snapshot` | 是 | 重建整段消息列表 | 不依赖提示词，通常由重连/恢复触发 |
| C14 | `streaming` | 是 | 从已有 part 快照恢复流式消息 | 不依赖提示词，通常由重连/补流触发 |
| C15 | `session.title` | 否 | 当前无 UI 变化 | 不建议作为有效联调用例 |
| C16 | `agent.online` / `agent.offline` | 否 | 当前无 UI 变化 | 不建议作为有效联调用例 |

## 4. 详细 Case

---

## C01. 纯文本流式回答

### 适用场景

最基础的 AI 对话生成。服务端将一个助手回答拆成多段 `text.delta`，最终以 `text.done` 收尾。

### 事件序列

```json
[
  { "type": "session.status", "sessionStatus": "busy" },
  { "type": "text.delta", "partId": "text_1", "role": "assistant", "content": "第一段" },
  { "type": "text.delta", "partId": "text_1", "role": "assistant", "content": "第二段" },
  { "type": "text.done", "partId": "text_1", "role": "assistant", "content": "第一段第二段" },
  { "type": "session.status", "sessionStatus": "idle" }
]
```

### 预期 UI

- 先出现一条流式中的助手消息
- 文本持续追加
- 收到 `idle` 后取消光标闪烁，消息转为完成态

### 推荐提示词

```text
请总结 weAgentCUI 页面当前支持的对话能力，并用 5 条 bullet 输出。
```

### 校验点

- 同一个 `partId` 的文本会被连续拼接
- `text.done` 可以覆盖最终内容
- `session.status=idle` 后消息结束流式状态

---

## C02. Markdown/代码块/公式文本回答

### 适用场景

验证 [`react-markdown`](../src/components/MessageBubble.tsx) 渲染能力，包括 GFM、代码块、KaTeX。

### 事件序列

本质仍然是 `text.delta` / `text.done`，只是 `content` 为 Markdown。

### 推荐提示词

```text
请用 markdown 输出：
1. 一个二级标题
2. 一个 TypeScript 代码块，展示 sendMessage 的调用示例
3. 一个 LaTeX 公式：E = mc^2
4. 一个表格，列出 text、thinking、tool 三类 part
```

### 预期 UI

- 标题、列表、表格正常渲染
- 代码块走 `CodeBlock`
- 公式走 `rehype-katex`

### 校验点

- 消息仍属于 `text` part，不会额外拆 part
- 历史消息与实时消息都能复用相同渲染路径

---

## C03. 思考块 + 正文混合输出

### 适用场景

模型先返回分析过程，再返回最终答案。

### 事件序列

```json
[
  { "type": "session.status", "sessionStatus": "busy" },
  { "type": "thinking.delta", "partId": "thinking_1", "content": "正在分析页面入口..." },
  { "type": "thinking.done", "partId": "thinking_1", "content": "已确认入口、会话初始化与监听注册流程。" },
  { "type": "text.delta", "partId": "text_1", "content": "结论如下：" },
  { "type": "text.done", "partId": "text_1", "content": "结论如下：页面先取 assistantAccount，再初始化会话。" },
  { "type": "session.status", "sessionStatus": "idle" }
]
```

### 推荐提示词

```text
请先给出你的分析思路，再给出 weAgentCUI 会话初始化流程的最终结论。
```

### 预期 UI

- `thinking` part 使用 `ThinkingBlock`
- `text` part 在思考块之后出现
- 两种 part 保持同一条助手消息内的顺序

### 校验点

- `StreamAssembler` 会按 part 顺序保留 `thinking -> text`
- 思考块在流式中显示“思考中”态，结束后转静态

---

## C04. 工具调用状态流转

### 适用场景

模型调用外部工具时展示工具执行过程。

### 事件序列

```json
[
  {
    "type": "tool.update",
    "partId": "tool_1",
    "toolName": "code_search",
    "toolCallId": "call_001",
    "status": "pending",
    "title": "定位入口文件",
    "input": { "query": "weAgentCUI" }
  },
  {
    "type": "tool.update",
    "partId": "tool_1",
    "toolName": "code_search",
    "toolCallId": "call_001",
    "status": "running",
    "title": "定位入口文件",
    "input": { "query": "weAgentCUI" }
  },
  {
    "type": "tool.update",
    "partId": "tool_1",
    "toolName": "code_search",
    "toolCallId": "call_001",
    "status": "completed",
    "title": "定位入口文件",
    "output": "src/pages/weAgentCUI.tsx -> src/App.tsx"
  }
]
```

### 推荐提示词

```text
请先调用代码搜索工具定位 weAgentCUI 的入口、消息组装和渲染文件，再给我一个结构化总结。
```

### 预期 UI

- 展示 `ToolCard`
- 状态在 `pending/running/completed/error` 间变化
- 展开后可以看 `input/output/error`

### 校验点

- 同一 `partId` 会持续更新同一张卡片
- `status=error` 时错误信息写入 `part.content`

---

## C05. 工具之后跟追问

### 适用场景

工具调用发现信息不足，需要向用户发起问题确认。

### 事件序列

```json
[
  {
    "type": "tool.update",
    "partId": "tool_1",
    "toolName": "repo_inspect",
    "toolCallId": "call_qa_1",
    "status": "completed",
    "title": "检查仓库上下文",
    "output": "检测到多端工程：android / ios / harmony"
  },
  {
    "type": "question",
    "partId": "question_1",
    "toolCallId": "call_qa_1",
    "header": "需要你确认",
    "question": "这次修改优先哪个平台？",
    "options": [
      { "label": "Android", "description": "优先补 Java/Kotlin SDK" },
      { "label": "iOS", "description": "优先补 Objective-C/Swift SDK" },
      { "label": "HarmonyOS", "description": "优先补 ArkTS SDK" }
    ]
  }
]
```

### 推荐提示词

```text
先检查这个仓库包含哪些端，如果信息不足，请先问我本次需求优先支持哪个平台，再继续。
```

### 预期 UI

- 先显示工具卡片
- 再显示问题卡片
- 问题卡片提交时带上同一个 `toolCallId`

### 校验点

- `syncToolCallIdForQuestionParts` 会给缺失 `toolCallId` 的 question 继承前一个 tool 的 `toolCallId`
- 用户点击选项后走 `sendMessage({ toolCallId })`

---

## C06. 独立追问卡片

### 适用场景

模型主动追问，不依赖前置工具。

### 事件序列

```json
[
  {
    "type": "question",
    "partId": "question_2",
    "header": "补充信息",
    "question": "你希望最终产物是什么？",
    "options": [
      { "label": "方案说明", "description": "仅输出设计方案" },
      { "label": "Markdown 文档", "description": "直接生成文档内容" }
    ]
  }
]
```

### 推荐提示词

```text
在回答前请先确认我更想要“方案说明”还是“直接生成 Markdown 文档”。
```

### 预期 UI

- 显示 `QuestionCard`
- 可点击选项，也可输入自定义回答
- 回答后显示“已回答”结果区域

### 校验点

- `status=completed/error` 或 `output` 非空时，问题视为已回答
- 历史消息中的 question 卡片应为只读

---

## C07. 权限申请与回填

### 适用场景

模型要读文件、写文件、执行命令、访问网络之前申请权限。

### 事件序列

```json
[
  {
    "type": "permission.ask",
    "partId": "perm_1",
    "permissionId": "perm_write_001",
    "permType": "file_write",
    "toolName": "write_markdown",
    "title": "需要写入文档文件",
    "content": "将生成 weAgentCUI-opencode-cases.md"
  },
  {
    "type": "permission.reply",
    "permissionId": "perm_write_001",
    "response": "once"
  }
]
```

### 推荐提示词

```text
请在写入 Markdown 文件之前先申请 file_write 权限，得到授权后再执行写入。
```

### 预期 UI

- 出现 `PermissionCard`
- 用户可选“允许 / 始终允许 / 拒绝”
- 收到 `permission.reply` 后卡片进入已处理态

### 校验点

- `permission.reply` 既会更新当前流式消息中的权限卡片，也会回填历史同 `permissionId` 的卡片
- `permType` 会映射中文标签

---

## C08. 文件产物返回

### 适用场景

模型输出的是一个文件结果，而不仅是文字说明。

### 事件序列

```json
[
  {
    "type": "file",
    "partId": "file_1",
    "fileName": "release-notes.md",
    "fileUrl": "https://example.com/release-notes.md",
    "fileMime": "text/markdown"
  }
]
```

### 推荐提示词

```text
请生成一个名为 release-notes.md 的发布说明文件，并把它作为文件产物返回。
```

### 预期 UI

- 消息中展示文件卡片
- 若有 `fileUrl`，文件名可点击

### 校验点

- 当前 UI 只做基础文件展示，不区分文件类型图标
- 文件 part 不参与流式状态

---

## C09. 步骤元数据与 tokens/cost 回填

### 适用场景

模型分步骤执行，并在步骤完成时返回 token/cost。

### 事件序列

```json
[
  { "type": "step.start" },
  {
    "type": "step.done",
    "tokens": {
      "input": 120,
      "output": 260,
      "reasoning": 80,
      "cache": { "read": 40, "write": 0 }
    },
    "cost": 0.0025
  },
  { "type": "session.status", "sessionStatus": "idle" }
]
```

### 推荐提示词

```text
请分步骤执行，并在结束时返回输入 token、输出 token、reasoning token 和 cost。
```

### 预期 UI

- 当前页面不会直接渲染 step 卡片
- `step.done` 的 `tokens/cost` 会挂到当前流式助手消息 `meta`

### 校验点

- 若没有正在流式中的助手消息，`step.done` 不会显示任何内容
- 如后续需要展示 token 消耗，前端已有数据入口但暂无可见 UI

---

## C10. 会话状态与停止生成

### 适用场景

服务端用 `session.status` 控制忙闲态；用户手动点击停止时，页面调用 `stopSkill` 后强制收尾。

### 事件序列

正常流：

```json
[
  { "type": "session.status", "sessionStatus": "busy" },
  { "type": "text.delta", "partId": "text_1", "content": "长回答片段..." },
  { "type": "session.status", "sessionStatus": "idle" }
]
```

用户点击停止后：

```json
[
  { "type": "session.status", "sessionStatus": "idle" }
]
```

### 推荐提示词

```text
请输出一段较长的实现分析，至少分 8 段返回，方便我在中途点击停止按钮验证状态切换。
```

### 预期 UI

- `busy` 时底部按钮变停止态
- `idle` 时恢复发送态
- 点击停止后，当前流式消息被 `finalizeStreamingMessage`

### 校验点

- 停止成功后 footer 必须恢复到 `generate`
- 停止失败时 footer 保持 `generating`

---

## C11. `session.error` 会话级错误

### 适用场景

服务端在流式过程中发生会话级错误，需要在当前消息中展示错误块。

### 事件序列

```json
[
  { "type": "text.delta", "partId": "text_1", "content": "前置文本..." },
  { "type": "text.done", "partId": "text_1", "content": "前置文本..." },
  { "type": "session.error", "error": "agent connection lost while generating response" }
]
```

### 推荐提示词

当前本地 mock 已支持以下触发词：

```text
mock-session-error
```

或：

```text
触发session.error
```

### 预期 UI

- 若当前已有流式中的助手消息，则在原消息尾部追加 `error` part
- 若没有流式消息，则新建一条助手错误消息

### 校验点

- footer 恢复发送态
- 流式状态被终止
- 错误不只打印控制台，必须在消息区可见

---

## C12. `error` 通用错误

### 适用场景

服务端返回通用流式错误，但不是会话级错误。

### 事件序列

```json
[
  { "type": "text.delta", "partId": "text_1", "content": "前置文本..." },
  { "type": "error", "error": "internal server error" }
]
```

### 推荐提示词

当前本地 mock 已支持以下触发词：

```text
mock-error
```

或：

```text
error
```

### 预期 UI

- 追加错误块
- footer 恢复发送态
- 会话状态标记为 `error`

### 校验点

- `session.error` 与 `error` 走同一类消息内错误块渲染策略
- 错误消息使用兜底文案 `AI回复失败`

---

## C13. `snapshot` 全量恢复

### 适用场景

断线重连、页面恢复或 listener 重建后，服务端返回完整消息快照。

### 事件序列

```json
[
  {
    "type": "snapshot",
    "messages": [
      {
        "id": "msg_user_1",
        "role": "user",
        "content": "请总结这个页面",
        "createdAt": "2026-04-03T10:00:00.000Z"
      },
      {
        "id": "msg_assistant_1",
        "role": "assistant",
        "content": "这是页面总结",
        "createdAt": "2026-04-03T10:00:02.000Z",
        "parts": [
          { "partId": "text_1", "type": "text", "content": "这是页面总结" }
        ]
      }
    ]
  }
]
```

### 推荐提示词

不依赖用户提示词，通常由 SDK/服务端恢复机制触发。

### 预期 UI

- 当前消息列表被快照整体替换
- `latestUserContentRef` 更新为最后一条用户消息

### 校验点

- `snapshot` 会覆盖当前内存消息，而不是 append
- 服务端若按倒序给消息，前端当前会 `.reverse()` 后再落盘，需保证返回顺序与前端约定一致

---

## C14. `streaming` 补流恢复

### 适用场景

服务端在恢复中告诉前端“有一条消息仍在流式中”，并给出当前已生成的 parts 快照。

### 事件序列

```json
[
  {
    "type": "streaming",
    "role": "assistant",
    "sessionStatus": "busy",
    "parts": [
      { "partId": "thinking_1", "type": "thinking", "content": "正在分析", "status": "running" },
      { "partId": "text_1", "type": "text", "content": "先给出当前进度" }
    ]
  }
]
```

### 推荐提示词

不依赖用户提示词，通常由中断恢复触发。

### 预期 UI

- 直接创建一条 `isStreaming=true` 的助手消息
- parts 由快照映射而来
- 后续继续收到 `text.delta`、`tool.update` 等事件时复用这条消息

### 校验点

- `streaming` 事件本身不会补 `content`，而是由 `parts` 计算消息内容
- 若恢复后收到 `session.status=idle`，这条消息应结束流式态

---

## C15. `session.title` 返回

### 适用场景

服务端想同步会话标题。

### 当前实现情况

- 类型已定义
- `App.tsx` 无消费逻辑
- 当前不会更新左侧历史会话标题，也不会更新页面显示

### 推荐处理

- 如果要支持，应在 `App.tsx` 增加 `case 'session.title'`
- 同时同步当前会话和历史会话列表缓存

### 推荐提示词

```text
不建议作为当前有效联调用例；即使返回，页面也不会有可见变化。
```

---

## C16. `agent.online` / `agent.offline` 返回

### 适用场景

服务端想表达 agent 在线状态切换。

### 当前实现情况

- 类型已定义
- `App.tsx` 无消费逻辑
- 当前不会有 UI 提示

### 推荐处理

- 如需支持，可新增顶部状态条或输入框禁用策略

### 推荐提示词

```text
不建议作为当前有效联调用例；即使返回，页面也不会有可见变化。
```

## 5. 建议补齐的 mock 场景

当前本地 [`installJsApiMock.ts`](../src/mocks/installJsApiMock.ts) 只稳定覆盖了：

- 普通 `text.delta` / `text.done`
- `session.status`
- `session.error`
- `error`

如果要让 `weAgentCUI` 的联调和设计回归更完整，建议继续补以下 mock 触发词：

- `mock-thinking`
  目标：返回 `thinking.delta` + `thinking.done` + `text.done`
- `mock-tool`
  目标：返回一组 `tool.update` 状态流转
- `mock-question`
  目标：返回 `question` 卡片
- `mock-permission`
  目标：返回 `permission.ask`，点击按钮后再下发 `permission.reply`
- `mock-file`
  目标：返回 `file`
- `mock-snapshot`
  目标：返回 `snapshot`
- `mock-streaming`
  目标：返回 `streaming`
- `mock-step`
  目标：返回 `step.start` + `step.done`

## 6. 推荐回归顺序

建议联调按下面顺序进行，排查效率最高：

1. 先验证 C01、C10，确认基础发送、流式和停止正常
2. 再验证 C11、C12，确认异常收尾和消息内错误块正常
3. 再验证 C03、C04、C06、C07、C08，确认复杂 part 渲染正常
4. 最后验证 C13、C14，确认断线恢复和补流场景正常

## 7. Mock 输入触发文案

当前本地 mock 已补充以下输入触发词。进入本地页面后，在输入框直接发送下面任一文案即可触发对应场景：

| 类型 | 推荐输入文案 | 说明 |
| --- | --- | --- |
| 普通文本 | `请总结 weAgentCUI 的能力` | 默认走普通 `text.delta/text.done` |
| 代码块样式 | `mock-codeblock` | 返回“说明文字 + 列表 + fenced code block”，便于看代码块视觉效果 |
| 思考流 | `mock-thinking` | 触发 `thinking.delta/thinking.done` 后接正文 |
| 工具卡片 | `mock-tool` | 触发 `tool.update` 的 `pending/running/completed` |
| 追问卡片 | `mock-question` | 触发 `question` |
| 权限卡片 | `mock-permission` | 触发 `permission.ask`，点击卡片按钮后触发 `permission.reply` |
| 文件卡片 | `mock-file` | 触发 `file` |
| Step 元数据 | `mock-step` | 触发 `step.start/step.done`，并附带 `tokens/cost` |
| 快照恢复 | `mock-snapshot` | 触发 `snapshot` 并替换当前消息列表 |
| 补流恢复 | `mock-streaming` | 触发 `streaming` 后继续补发 `thinking/text` |
| 会话标题 | `mock-session-title` | 触发 `session.title`，当前页面无可见专属 UI |
| Agent 在线 | `mock-agent-online` | 触发 `agent.online`，当前页面无可见专属 UI |
| Agent 离线 | `mock-agent-offline` | 触发 `agent.offline`，当前页面无可见专属 UI |
| 会话错误 | `mock-session-error` | 触发 `session.error` |
| 通用错误 | `mock-error` | 触发 `error` |

如果你更习惯中文，也可以使用这些别名：

- `触发thinking`
- `触发代码块样式`
- `触发tool`
- `触发question`
- `触发permission`
- `触发file`
- `触发step`
- `触发snapshot`
- `触发streaming`
- `触发session.title`
- `触发agent.online`
- `触发agent.offline`
- `触发session.error`

## 8. 结论

`weAgentCUI` 当前已经具备对多种 `opencode` 返回形态的渲染基础，但真正本地可稳定复现的 case 还偏少。建议以后续补 mock 为主，把 `thinking / tool / question / permission / file / snapshot / streaming` 场景补齐后，再配合自动化测试收敛成完整回归集。
