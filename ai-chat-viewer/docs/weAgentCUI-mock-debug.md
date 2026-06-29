# WeAgentCUI Mock 调试速查

本地入口:

`http://localhost:3000/index.html#/weAgentCUI?assistantAccount=mock_assistant_001&mockJsApi=1`

说明:

- 发送下面任一文案到输入框即可触发对应 mock。
- mock 逻辑来自 [`src/mocks/installJsApiMock.ts`](../src/mocks/installJsApiMock.ts)。

## 1. 常用触发词

| 输入文案 | 落入场景 | 结果 |
| --- | --- | --- |
| `mock-codeblock` | 代码块 | 普通回复里带 fenced code block，方便看代码块样式 |
| `mock-thinking` | thinking | 先出 `thinking.delta` / `thinking.done`，再出正文 |
| `mock-tool` | tool | 触发 `tool.update` 的 `pending` / `running` / `completed` |
| `mock-question` | question | 触发追问卡片 |
| `mock-permission` | permission | 触发权限卡片，点按钮后回 `permission.reply` |
| `mock-file` | file | 触发文件卡片 |
| `mock-um-file` | UM file | Return UM encoded text and render file card through UM decode |
| `mock-step` | step | 触发 `step.start` / `step.done`，带 `tokens/cost` |
| `mock-snapshot` | snapshot | 触发快照恢复，替换当前消息列表 |
| `mock-streaming` | streaming | 先出 `streaming`，再继续补发 `thinking/text` |
| `mock-subagent` | subagent 基础展示 | 主流程 + 子 agent 的 `thinking/tool/text` |
| `mock-subagent-question` | subagent 追问 | 子 agent 发起追问，回传带 `subagentSessionId` |
| `mock-subagent-permission` | subagent 权限 | 子 agent 发起权限申请，回传带 `subagentSessionId` |
| `mock-session-title` | session.title | 仅发事件，当前页无专属 UI |
| `mock-agent-online` | agent.online | 仅发事件，当前页无专属 UI |
| `mock-agent-offline` | agent.offline | 追加“agent已离线”错误块并结束生成态 |
| `mock-session-error` | session.error | 追加会话错误块 |
| `mock-error` | error | 追加通用错误块 |
| `mock-message-user` | message.user | 模拟一条用户消息回流到当前会话 |

## 2. registerSessionListener 调试

### 2.1 replay 会话入口

`http://localhost:3000/index.html#/skillCUI?welinkSessionId=mock_skill_cui_replay_session_001&mockJsApi=1`

说明:

- `mock_skill_cui_replay_session_001` 是 mock 里预置的未完成轮次会话。
- 页面进入后会先拉历史，再注册监听，然后收到 replay 事件。

### 2.2 预期事件顺序

1. 页面先调用 `getSessionMessageHistory`。
2. 页面调用 `registerSessionListener`。
3. mock 先补发 replay:
   - `session.status`
   - `streaming`
   - 最后一条 replay 事件带 `replayDone = true`
4. replay 结束后继续下发 live:
   - `text.delta`
   - `text.done`
   - `session.status = idle`

### 2.3 排查建议

在 [`src/hooks/useChatSession.ts`](../src/hooks/useChatSession.ts) 的 `onMessage` 临时打印:

```ts
console.log('[registerSessionListener]', {
  type: msg.type,
  welinkSessionId: msg.welinkSessionId,
  deliveryMode: msg.deliveryMode,
  replayDone: msg.replayDone,
  messageId: msg.messageId,
  partId: msg.partId,
});
```

重点看:

- replay 阶段是否是 `deliveryMode = replay`
- 只有最后一条 replay 是否 `replayDone = true`
- replay 后的新事件是否切回 `deliveryMode = live`

## 3. 推荐调试顺序

1. 先测 `mock-codeblock`，确认代码块样式、复制按钮和高亮。
2. 再测 `mock-thinking`、`mock-tool`、`mock-question`、`mock-permission`。
3. 最后测 `mock-streaming` 和 `registerSessionListener` replay 会话。
