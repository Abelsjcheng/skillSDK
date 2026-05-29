# ai-chat-viewer 埋码总表

目标：同步当前 `ai-chat-viewer` 代码里已经落地的埋码，作为实现对照表。

## 统一说明

- 点击埋码通过 `reportUemEvent` 上报。
- 接口成功 / 失败埋码统一收口在 `uemUtil.ts`，由 `hwext.ts` 调用。
- 公共字段来源：
  - `clientType`：`HWH5.getDeviceInfo().osType`
  - `versionName`：`HWH5.getAppInfo().versionName`
  - `environment`：`HWH5.getAppInfo().environment`
  - `entry`：固定为 `WeAgent`
  - `operationTime`：触发时的时间戳

## 已实现埋码总表

| 类别 | 埋码 | 场景 | 数据 |
|---|---|---|---|
| 点击 | `activate_select_assistant_click` | 激活页点击“选择助理” | `{ entry, // 固定 WeAgent operationTime // 操作时间戳 }` |
| 点击 | `select_assistant_create_click` | 选择助理页点击“创建助理” | `{ entry, // 固定 WeAgent operationTime // 操作时间戳 }` |
| 点击 | `select_assistant_start_click` | 选择助理页点击“开始使用” | `{ entry, // 固定 WeAgent operationTime // 操作时间戳 }` |
| 点击 | `switch_assistant_confirm_click` | 切换助理页点击“确认切换” | `{ entry, // 固定 WeAgent operationTime // 操作时间戳 }` |
| 点击 | `weagent_history_click` | WeAgentCUI 点击历史会话 | `{ entry, // 固定 WeAgent operationTime, // 操作时间戳 page: 'weAgentCUI', // 页面 assistantAccount // 助理账号 }` |
| 点击 | `weagent_create_session_click` | WeAgentCUI 点击创建会话 | `{ entry, // 固定 WeAgent operationTime, // 操作时间戳 page: 'weAgentCUI', // 页面 assistantAccount, // 助理账号 bizRobotTag, // 助理标签 type: 'ok' \| 'error' // 创建会话触发结果 }` |
| 点击 | `weagent_send_message_click` | WeAgentCUI / skillCUI 点击发送消息 | `{ entry, // 固定 WeAgent operationTime, // 操作时间戳 page: 'weAgentCUI' \| 'skillCUI', // 页面 welinkSessionId, // 当前会话 id contentLength // 消息长度，不上报原文 }` |
| 接口 | `api_create_new_session` | 创建会话成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 固定 WeAgent operationTime, // 操作时间戳 type: 'ok' \| 'error', // 结果 request: { assistantAccount, // 助理账号 businessSessionDomain, // 会话域 businessSessionType, // 会话类型 businessSessionId, // 业务会话标识 ak, // appKey / ak }, response: { welinkSessionId, // 会话 id status // 会话状态 }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 接口 | `api_get_history_sessions` | 获取历史会话成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { assistantAccount, // 助理账号 businessSessionDomain, // 会话域 page, // 页码 size // 分页大小 }, response: { sessionCount, // 会话数量 latestWelinkSessionId // 最新会话 id }, errorCode, errorMessage }` |
| 接口 | `api_get_session_message_history` | 获取历史消息成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { welinkSessionId, // 会话 id beforeSeq, // 历史游标 size // 分页大小 }, response: { messageCount, // 消息数量 nextBeforeSeq // 下一页游标 }, errorCode, errorMessage }` |
| 接口 | `api_send_message` | 发送消息成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { welinkSessionId, // 会话 id contentLength, // 消息长度，不上报原文 toolCallId, // 工具调用 id questionId, // 问题卡片 id subagentSessionId // subagent 会话 id }, response: { messageId // 消息 id }, errorCode, errorMessage }` |
| 接口 | `api_reply_permission` | 权限回复成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { welinkSessionId, // 会话 id permId, // 权限 id response, // once / always / reject subagentSessionId // subagent 会话 id }, response: { permissionId // 权限 id }, errorCode, errorMessage }` |
| 接口 | `api_create_digital_twin` | 创建助理成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { name, // 助理名称 descriptionLength, // 描述长度 bizRobotId, // 内置助理类型 qrcode, // 二维码 weCrewType // 助理类型 }, response: { partnerAccount, // 助理账号 robotId, // robotId isInternalAssistant // 是否内置助理 }, errorCode, errorMessage }` |
| 接口 | `api_query_qrcode_info` | 查询二维码信息成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { qrcode // 二维码 }, response: { status, // 状态 expired, // 是否过期 expireTime // 过期时间 }, errorCode, errorMessage }` |
| 接口 | `api_update_qrcode_info` | 更新二维码状态成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { qrcode, // 二维码 robotId, // 助理 robotId status // 二维码状态 }, response: { status // 返回状态 }, errorCode, errorMessage }` |
| 接口 | `api_get_weagent_details` | 获取助理详情成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { partnerAccount, // 单个助理账号 partnerAccounts // PC 批量助理账号 }, response: { detailCount, // 详情数量 bizRobotId, // 助理类型 id bizRobotTag // 助理标签 }, errorCode, errorMessage }` |
| 接口 | `api_get_weagent_list` | 获取助理列表成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { pageNumber, // 页码 pageSize // 分页大小 }, response: { listCount, // 列表数量 hasMyAgent // 是否包含专属助手 }, errorCode, errorMessage }` |
| 接口 | `api_stop_skill` | 停止生成成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { welinkSessionId, // 会话 id subagentSessionId // subagent 会话 id }, response: { status // 返回状态 }, errorCode, errorMessage }` |
| 接口 | `api_send_message_to_im` | 发送到 IM 成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { welinkSessionId, // 会话 id chatId, // 会话 / 群 id contentLength // 消息长度，不上报原文 }, response: { success // 是否成功 }, errorCode, errorMessage }` |
| 接口 | `api_update_weagent` | 更新助理成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { partnerAccount, // 助理账号 robotId, // robotId name, // 助理名称 descriptionLength // 描述长度 }, response: { updateResult // 更新结果 }, errorCode, errorMessage }` |
| 接口 | `api_delete_weagent` | 删除助理成功 / 失败 | `{ clientType, versionName, environment, entry, operationTime, type: 'ok' \| 'error', request: { partnerAccount, // 助理账号 robotId // robotId }, response: { deleteResult // 删除结果 }, errorCode, errorMessage }` |
| 流程 | `flow_onmessage_error` | `onMessage` 收到错误消息，或 listener error | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 固定 WeAgent operationTime, // 操作时间戳 type: 'error', // 固定错误 page, // 页面 welinkSessionId, // 会话 id messageId, // 当前消息 id subagentSessionId, // subagent 会话 id messageType, // 消息类型 errorCode, // 错误码 errorMessage // 错误信息 }` |
| 浏览器异常 | `browser_js_error` | 浏览器运行时脚本异常 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 固定 WeAgent operationTime, // 操作时间戳 type: 'error', // 固定错误 page, // 页面 assistantAccount, // 助理账号 welinkSessionId, // 会话 id errorType: 'js_error', // 错误类型 message, // 错误信息 filename, // 文件名 lineno, // 行号 colno, // 列号 stack // 堆栈，已做截断 }` |

## 页面 / 模块对应关系

- `activateAssistant.tsx`
  - `activate_select_assistant_click`
- `selectAssistant.tsx`
  - `select_assistant_create_click`
  - `select_assistant_start_click`
- `switchAssistant.tsx`
  - `switch_assistant_confirm_click`
- `App.tsx`
  - `browser_js_error`
  - `weagent_create_session_click`
- `skillCUI.tsx`
  - `browser_js_error`
- `WeAgentHistorySidebar.tsx`
  - `weagent_history_click`
- `useChatSession.ts`
  - `weagent_send_message_click`
  - `flow_onmessage_error`
- `hwext.ts` + `uemUtil.ts`
  - 所有 `api_*` 接口埋码

## 已删除，不再保留在当前文档

以下埋码已从代码实现中移除，本方案不再作为当前埋码要求：

- `weagent_stop_generate_click`
- `weagent_send_to_im_click`
- `weagent_permission_allow_click`
- `weagent_question_answer_click`
- `flow_chat_init_result`
- `flow_create_assistant_result`
- `flow_edit_assistant_result`
- `flow_delete_assistant_result`
- `flow_onmessage_start`
- `flow_onmessage_finish`
- `flow_ai_reply_result`

## 说明

- 当前文档只描述“代码里已实现”的埋码，不再保留“待新增”列表。
- 若后续继续补埋码，建议优先沿用现有收口方式：
  - 点击类：`uemUtil.ts`
  - 接口类：`hwext.ts` 调用 `uemUtil.ts`
  - 流程类 / 浏览器异常：`telemetry.ts`
