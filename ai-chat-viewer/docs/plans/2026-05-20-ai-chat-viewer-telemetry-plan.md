# ai-chat-viewer 埋码总表

目标：快速梳理 `ai-chat-viewer` 已有埋码、待新增埋码，以及各自的使用场景和上报数据。

## 埋码总表

| 状态 | 埋码 / 日志 | 场景 | 数据 |
|---|---|---|---|
| 已有 | `WeLog` | 接口失败、运行异常、调试日志 | `{ content, type, errorMessage }` |
| 已有 | `activate_select_assistant_click` | 选择助理 | `{ clientType, entry, operationTime }` |
| 已有 | `select_assistant_create_click` | 创建助理 | `{ clientType, entry, operationTime }` |
| 已有 | `select_assistant_start_click` | 开始使用 | `{ clientType, entry, operationTime }` |
| 已有 | `switch_assistant_confirm_click` | 确认切换助理 | `{ clientType, entry, operationTime }` |
| 已有 | `weagent_history_click` | 打开历史会话 | `{ clientType, entry, operationTime }` |
| 已有 | `weagent_create_session_click` | 创建会话 | `{ clientType, entry, operationTime }` |
| 待新增 | `api_*` 系列 | 所有请求服务端的接口成功 / 失败 | `{ eventId, eventTitle, result, duration, msg, data }` |
| 待新增 | `*_page_show` | 页面曝光 | `{ page, clientType, entry, operationTime }` |
| 待新增 | `*_click` 补充项 | 发送消息、停止生成、发送到 IM、最小化、关闭、复制、编辑、删除、权限按钮、问题卡片 | `{ page, clientType, entry, operationTime, ...bizData }` |
| 待新增 | `flow_*` | 会话初始化、历史消息加载、AI 回复完成 / 失败、创建 / 编辑 / 删除助理结果 | `{ result, duration, errorCode, errorMessage, ...bizData }` |
| 待新增 | `browser_*` | 浏览器运行时异常、资源加载失败、未处理 Promise 异常 | `{ page, clientType, entry, errorType, message, filename, lineno, colno, stack, reason, resourceUrl, operationTime }` |

## 待新增埋码明细

| 类别 | 埋码 | 场景 | 数据 |
|---|---|---|---|
| 接口 | `api_create_new_session` | 创建会话成功 / 失败 | `{ result, duration, assistantAccount, welinkSessionId, errorCode, errorMessage }` |
| 接口 | `api_get_history_sessions` | 获取历史会话成功 / 失败 | `{ result, duration, assistantAccount, sessionCount, errorCode, errorMessage }` |
| 接口 | `api_get_session_message_history` | 获取历史消息成功 / 失败 | `{ result, duration, welinkSessionId, messageCount, errorCode, errorMessage }` |
| 接口 | `api_send_message` | 发送消息成功 / 失败 | `{ result, duration, welinkSessionId, contentLength, errorCode, errorMessage }` |
| 接口 | `api_reply_permission` | 权限回复成功 / 失败 | `{ result, duration, welinkSessionId, permType, errorCode, errorMessage }` |
| 接口 | `api_create_digital_twin` | 创建助理成功 / 失败 | `{ result, duration, partnerAccount, isInternalAssistant, errorCode, errorMessage }` |
| 曝光 | `weagent_chat_page_show` | 聊天页首次展示 | `{ page, clientType, entry, assistantAccount, welinkSessionId, operationTime }` |
| 曝光 | `weagent_detail_page_show` | 助理详情页展示 | `{ page, clientType, entry, partnerAccount, operationTime }` |
| 点击 | `weagent_send_message_click` | 点击发送消息 | `{ page, clientType, entry, welinkSessionId, contentLength, operationTime }` |
| 点击 | `weagent_stop_generate_click` | 点击停止生成 | `{ page, clientType, entry, welinkSessionId, operationTime }` |
| 点击 | `weagent_send_to_im_click` | 点击发送到 IM | `{ page, clientType, entry, welinkSessionId, operationTime }` |
| 点击 | `weagent_permission_allow_click` | 点击允许权限 | `{ page, clientType, entry, welinkSessionId, permType, operationTime }` |
| 点击 | `weagent_delete_assistant_click` | 点击删除助理 | `{ page, clientType, entry, partnerAccount, operationTime }` |
| 流程 | `flow_chat_init_result` | 会话初始化成功 / 失败 | `{ result, duration, assistantAccount, welinkSessionId, errorCode, errorMessage }` |
| 流程 | `flow_ai_reply_result` | AI 回复完成 / 中断 / 失败 | `{ result, duration, welinkSessionId, finishReason, errorCode, errorMessage }` |
| 流程 | `flow_create_assistant_result` | 创建助理流程成功 / 失败 | `{ result, duration, partnerAccount, errorCode, errorMessage }` |
| 浏览器异常 | `browser_js_error` | `window error` 捕获脚本运行时异常 | `{ page, clientType, entry, errorType: 'js_error', message, filename, lineno, colno, stack, assistantAccount, welinkSessionId, operationTime }` |
| 浏览器异常 | `browser_unhandled_rejection` | `unhandledrejection` 捕获未处理 Promise 异常 | `{ page, clientType, entry, errorType: 'unhandled_rejection', message, stack, reason, assistantAccount, welinkSessionId, operationTime }` |
| 浏览器异常 | `browser_resource_error` | 捕获 `img/script/link` 等资源加载失败 | `{ page, clientType, entry, errorType: 'resource_error', tagName, resourceUrl, outerHTML, assistantAccount, welinkSessionId, operationTime }` |

## 浏览器报错监听方案

现状：
`ai-chat-viewer` 目前主要依赖 `WeLog` 记录接口失败和业务异常，还没有统一监听浏览器全局报错。

建议：
在应用根入口统一注册一次浏览器异常监听，优先放在 `App.tsx` 或更上层的页面初始化入口，避免各页面重复注册。

建议监听范围：

1. `window.addEventListener('error', handler)`  
   用于捕获脚本运行时异常。
2. `window.addEventListener('error', handler, true)`  
   用于捕获资源加载失败，需通过 `event.target` 区分 `img/script/link`。
3. `window.addEventListener('unhandledrejection', handler)`  
   用于捕获未处理的 Promise 异常。

建议上报数据：

- 基础字段：`{ page, clientType, entry, assistantAccount, welinkSessionId, operationTime }`
- JS 异常：`{ errorType, message, filename, lineno, colno, stack }`
- Promise 异常：`{ errorType, reason, message, stack }`
- 资源异常：`{ errorType, tagName, resourceUrl, outerHTML }`

建议实现原则：

1. 监听只注册一次，组件卸载时清理，避免重复上报。
2. 埋码和 `WeLog` 一起保留。
3. 对重复报错建议做节流或去重，避免死循环场景刷量。
4. `stack`、`outerHTML` 建议截断，避免日志和埋码体积过大。
5. 仅上报必要上下文，不上报用户输入全文、token、敏感标识。

## 说明

1. 已有埋码以点击类 UEM 和 `WeLog` 为主。
2. 待新增埋码重点补齐“接口成功 / 失败都要埋码”。
3. 接口类建议统一走 `hwext.ts` 收口，页面和组件继续保留业务点击与流程埋码。
4. 浏览器报错监听建议统一走根入口收口，不放到单个业务组件内部。
5. 建议所有新增埋码默认带上 `clientType`、`entry`、`operationTime`，再按场景补充会话、助理、结果字段。
