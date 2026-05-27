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
| 待新增 | `api_*` 系列 | 所有请求服务端的接口成功 / 失败 | `{ type, duration, ...requestData, ...responseData }` |
| 待新增 | `*_click` 补充项 | 发送消息、停止生成、发送到 IM、最小化、关闭、复制、编辑、删除、权限按钮、问题卡片 | `{ page, clientType, entry, operationTime, ...bizData }` |
| 待新增 | `flow_*` | 会话初始化、历史消息加载、AI 回复完成 / 失败、创建 / 编辑 / 删除助理结果 | `{ type, duration, errorCode, errorMessage, ...bizData }` |
| 待新增 | `browser_js_error` | 浏览器脚本运行时异常 | `{ page, clientType, entry, errorType, message, filename, lineno, colno, stack, operationTime }` |

## 待新增埋码明细

| 类别 | 埋码 | 场景 | 数据 |
|---|---|---|---|
| 接口 | `api_create_new_session` | 创建会话成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 接口结果标识；成功为 ok，失败为 error duration, // 接口耗时，单位 ms request: { assistantAccount, // 助理账号 businessSessionDomain, // 会话域 businessSessionType, // 会话类型 businessSessionId, // 业务会话标识 ak, // 助理 appKey 或 ak }, response: { welinkSessionId, // 创建成功后的会话 id status, // 会话状态 }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 接口 | `api_get_history_sessions` | 获取历史会话成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 接口结果标识 duration, // 接口耗时，单位 ms request: { assistantAccount, // 助理账号 businessSessionDomain, // 会话域 page, // 页码 size, // 每页数量 }, response: { sessionCount, // 返回的历史会话数量 latestWelinkSessionId, // 最新会话 id }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 接口 | `api_get_session_message_history` | 获取历史消息成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 接口结果标识 duration, // 接口耗时，单位 ms request: { welinkSessionId, // 当前会话 id beforeSeq, // 历史消息游标 size, // 每页数量 }, response: { messageCount, // 返回的历史消息数量 nextBeforeSeq, // 下一页游标 }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 接口 | `api_send_message` | 发送消息成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 接口结果标识 duration, // 接口耗时，单位 ms request: { welinkSessionId, // 当前会话 id contentLength, // 发送内容长度，不上报原文 toolCallId, // 工具调用 id questionId, // 问题卡片 id subagentSessionId, // subagent 会话 id }, response: { messageId, // 新创建的消息 id }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 接口 | `api_reply_permission` | 权限回复成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 接口结果标识 duration, // 接口耗时，单位 ms request: { welinkSessionId, // 当前会话 id permId, // 权限 id response, // 权限回复结果 once / always / reject subagentSessionId, // subagent 会话 id }, response: { permissionId, // 返回的权限 id }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 接口 | `api_create_digital_twin` | 创建助理成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 接口结果标识 duration, // 接口耗时，单位 ms request: { name, // 助理名称 descriptionLength, // 助理描述长度，不上报原文 bizRobotId, // 内置助手类型 id qrcode, // 二维码标识 weCrewType, // 助理类型 }, response: { partnerAccount, // 创建成功后的助理账号 robotId, // 创建成功后的 robotId isInternalAssistant, // 是否为内置助手 }, errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 点击 | `weagent_send_message_click` | 点击发送消息 | `{ page, // 页面标识 clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 入口来源 welinkSessionId, // 当前会话 id contentLength, // 发送内容长度，不上报原文 operationTime // 操作时间戳 }` |
| 点击 | `weagent_stop_generate_click` | 点击停止生成 | `{ page, // 页面标识 clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 入口来源 welinkSessionId, // 当前会话 id operationTime // 操作时间戳 }` |
| 点击 | `weagent_send_to_im_click` | 点击发送到 IM | `{ page, // 页面标识 clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 入口来源 welinkSessionId, // 当前会话 id operationTime // 操作时间戳 }` |
| 点击 | `weagent_permission_allow_click` | 点击允许权限 | `{ page, // 页面标识 clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 入口来源 welinkSessionId, // 当前会话 id permType, // 权限类型 operationTime // 操作时间戳 }` |
| 点击 | `weagent_delete_assistant_click` | 点击删除助理 | `{ page, // 页面标识 clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 入口来源 partnerAccount, // 助理账号 operationTime // 操作时间戳 }` |
| 流程 | `flow_chat_init_result` | 会话初始化成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 流程结果标识 duration, // 流程耗时，单位 ms assistantAccount, // 助理账号 welinkSessionId, // 初始化后的会话 id errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 流程 | `flow_ai_reply_result` | AI 回复完成 / 中断 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 流程结果标识 duration, // 流程耗时，单位 ms welinkSessionId, // 当前会话 id finishReason, // 回复结束原因 errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 流程 | `flow_create_assistant_result` | 创建助理流程成功 / 失败 | `{ clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 type: 'ok' \| 'error', // 流程结果标识 duration, // 流程耗时，单位 ms partnerAccount, // 创建后的助理账号 errorCode, // 失败错误码 errorMessage // 失败错误信息 }` |
| 浏览器异常 | `browser_js_error` | `window error` 捕获脚本运行时异常 | `{ page, // 页面标识 clientType, // 端类型 versionName, // 应用版本名称 environment, // 环境 entry, // 入口来源 errorType: 'js_error', // 错误类型 message, // 错误信息 filename, // 报错脚本文件名 lineno, // 报错行号 colno, // 报错列号 stack, // 错误堆栈 assistantAccount, // 当前助理账号 welinkSessionId, // 当前会话 id operationTime // 触发时间戳 }` |

## 新增埋码字段说明

### 接口类埋码公共字段

```ts
{
  clientType?: string, // 端类型；从 HWH5.getDeviceInfo().osType 获取
  versionName?: string, // 应用版本名称；从 HWH5.getAppInfo().versionName 获取
  environment?: string, // 环境；从 HWH5.getAppInfo().environment 获取
  type: 'ok' \| 'error', // 接口结果标识；成功固定为 'ok'，失败固定为 'error'
  duration: number, // 接口调用耗时，单位 ms
  request: {
    // 接口请求入参，按接口实际透传的关键字段上报
  },
  response: {
    // 接口成功后的关键返回字段；失败时可不传
  },
  errorCode?: string, // 接口失败码；无明确错误码可不传
  errorMessage?: string, // 接口失败信息；建议截断，避免过长
}
```

### 接口类字段补充说明

```ts
{
  assistantAccount?: string, // 助理账号
  businessSessionDomain?: string, // 会话域，例如 miniapp / skill
  businessSessionType?: string, // 会话类型，例如 direct
  businessSessionId?: string, // 业务侧会话标识
  ak?: string, // 助理 appKey 或 ak
  welinkSessionId?: string, // 会话 id
  page?: number, // 分页页码
  size?: number, // 分页大小
  beforeSeq?: number, // 历史消息游标
  contentLength?: number, // 用户输入长度，不上报原文
  toolCallId?: string, // 工具调用 id
  questionId?: string, // 问题卡片 id
  subagentSessionId?: string, // subagent 会话 id
  permId?: string, // 权限 id
  response?: 'once' | 'always' | 'reject', // 权限回复结果
  name?: string, // 助理名称；如有敏感顾虑可不上报
  descriptionLength?: number, // 助理描述长度，不上报原文
  bizRobotId?: string, // 内置助手类型 id
  qrcode?: string, // 二维码标识；如过于敏感可改为脱敏值
  weCrewType?: number, // 助理类型，内部/外部
  sessionCount?: number, // 历史会话数量
  latestWelinkSessionId?: string, // 最新会话 id
  messageCount?: number, // 历史消息数量
  nextBeforeSeq?: number, // 下一页游标
  messageId?: string, // 新发送消息 id
  permissionId?: string, // 权限结果中的权限 id
  robotId?: string, // 创建助理后的 robotId
  isInternalAssistant?: boolean, // 是否为内置助手
  status?: string, // 接口返回状态
}
```

### 通用字段说明

```ts
{
  page?: string, // 页面标识，例如 weAgentCUI / assistantDetail / skillCUI
  clientType?: string, // 端类型；从 HWH5.getDeviceInfo().osType 获取
  versionName?: string, // 应用版本名称；从 HWH5.getAppInfo().versionName 获取
  environment?: string, // 环境；从 HWH5.getAppInfo().environment 获取
  entry?: string, // 入口来源，当前固定为 WeAgent
  operationTime?: number, // 触发时间戳，单位 ms
  partnerAccount?: string, // 助理 partnerAccount
  permType?: string, // 权限类型，例如 file_write / command / network
  finishReason?: string, // AI 回复结束原因，例如 done / stopped / error
  errorType?: string, // 浏览器异常类型，例如 js_error
  message?: string, // 错误摘要或提示信息
  filename?: string, // 报错脚本文件名
  lineno?: number, // 报错行号
  colno?: number, // 报错列号
  stack?: string, // 错误堆栈；建议截断
}
```

## 浏览器报错监听方案

现状：
`ai-chat-viewer` 目前主要依赖 `WeLog` 记录接口失败和业务异常，还没有统一监听浏览器全局报错。

建议：
在应用根入口统一注册一次浏览器异常监听，优先放在 `App.tsx` 或更上层的页面初始化入口，避免各页面重复注册。

建议监听范围：

1. `window.addEventListener('error', handler)`  
   用于捕获脚本运行时异常。

建议上报数据：

- 基础字段：`{ page, clientType, versionName, environment, entry, assistantAccount, welinkSessionId, operationTime }`
- JS 异常：`{ errorType, message, filename, lineno, colno, stack }`

建议实现原则：

1. 监听只注册一次，组件卸载时清理，避免重复上报。
2. 埋码和 `WeLog` 一起保留。
3. 对重复报错建议做节流或去重，避免死循环场景刷量。
4. `stack` 建议截断，避免日志和埋码体积过大。
5. 仅上报必要上下文，不上报用户输入全文、token、敏感标识。

## 说明

1. 已有埋码以点击类 UEM 和 `WeLog` 为主。
2. 待新增埋码重点补齐“接口成功 / 失败都要埋码”。
3. 接口类建议统一走 `hwext.ts` 收口，页面和组件继续保留业务点击与流程埋码。
4. 浏览器报错监听建议统一走根入口收口，不放到单个业务组件内部。
5. 建议所有新增埋码默认带上 `clientType`、`versionName`、`environment`、`entry`、`operationTime`，再按场景补充会话、助理、结果字段。
6. `versionName` 表示应用版本名称，`environment` 表示当前环境，属于待新增埋码统一公共字段。
