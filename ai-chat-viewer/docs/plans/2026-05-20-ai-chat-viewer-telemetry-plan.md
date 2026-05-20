# ai-chat-viewer 埋码梳理与补充方案

- 方案日期：2026-05-20
- 目标工程：`ai-chat-viewer`
- 目标范围：现有埋码盘点、服务端请求成功/失败埋码补齐、可新增埋码场景补充、统一实现方案

## 1. 目标

本方案目标：

1. 梳理 `ai-chat-viewer` 当前所有埋码与运行日志入口。
2. 区分“已有点击埋码”“已有运行日志”“尚未覆盖的埋码缺口”。
3. 补充“所有请求服务端的接口成功和失败都要埋码”的统一方案。
4. 给出适合当前代码结构的最小侵入实现建议，优先复用 `src/utils/hwext.ts` 与 `src/utils/uemUtil.ts`。

## 2. 当前埋码现状

当前代码里实际存在两类“埋码 / 日志”能力：

1. `WeLog`
   - 文件：`src/utils/logger.ts`
   - 实际行为：调用 `window.HWH5.log({ content, type: 'i' })`
   - 作用：运行日志、错误日志、调试日志
   - 特点：当前主要覆盖失败分支，缺少成功埋码、缺少统一事件结构

2. `UEM` 点击埋码
   - 文件：`src/utils/hwext.ts`
   - 方法：`reportUemEvent(eventId, eventTitle, data)`
   - 当前限制：
     - 移动端可上报
     - PC 端还是 `TODO`
     - `result` 被固定为 `true`
     - 无法表达失败、耗时、错误码

### 2.1 当前 UEM 业务点击埋码

当前已接入的点击埋码如下：

| 事件 ID | 事件名称 | 当前调用位置 |
|---|---|---|
| `activate_select_assistant_click` | 选择助理 | `src/pages/activateAssistant.tsx` |
| `select_assistant_create_click` | 创建助理 | `src/pages/selectAssistant.tsx` |
| `select_assistant_start_click` | 开始使用 | `src/pages/selectAssistant.tsx` |
| `switch_assistant_confirm_click` | 确认切换 | `src/pages/switchAssistant.tsx` |
| `weagent_history_click` | 历史会话 | `src/components/assistant/WeAgentHistorySidebar.tsx` |
| `weagent_create_session_click` | 创建会话 | `src/App.tsx` |

### 2.2 当前 UEM 工具封装

当前 `src/utils/uemUtil.ts` 提供的能力：

1. `reportSelectAssistantClick`
2. `reportCreateAssistantClick`
3. `reportEnableNowClick`
4. `reportSwitchAssistantClick`
5. `reportViewHistoryClick`
6. `reportCreateSessionClick`

当前问题：

1. 仅覆盖点击，不覆盖接口结果。
2. `reportCreateSessionClick(detail, error)` 虽然传入了 `detail` 和 `error`，但当前实现未使用。
3. `data` 固定为基础字段，缺少业务上下文。

### 2.3 当前 WeLog 分布

当前 `WeLog` 主要分布在以下模块：

#### 页面与会话流程

1. `src/App.tsx`
   - 键盘监听初始化失败
   - `assistantAccount` 缺失
   - 初始化会话失败
   - 创建会话失败

2. `src/hooks/useChatSession.ts`
   - 加载历史消息失败
   - 发送消息失败
   - session listener error / close
   - 停止生成失败
   - 发送到 IM 失败
   - 最小化失败
   - 关闭失败
   - 复制失败

#### 助理选择与详情

1. `src/pages/activateAssistant.tsx`
   - `getWeAgentList` 失败

2. `src/pages/selectAssistant.tsx`
   - `getWeAgentList` 失败
   - `openWeAgentCUI` 失败

3. `src/pages/switchAssistant.tsx`
   - `getWeAgentList` 失败
   - `openWeAgentCUI` 失败

4. `src/pages/assistantDetail.tsx`
   - `getWeAgentDetails` 失败
   - 复制失败
   - `deleteWeAgent` 失败

5. `src/components/assistant/WeAgentHistorySidebar.tsx`
   - `getHistorySessionsList` 失败

6. `src/components/assistant/EditAssistantContent.tsx`
   - `getWeAgentDetails` 失败
   - `updateWeAgent` 失败
   - `notifyAssistantDetailUpdated` 失败

#### 创建助理流程

1. `src/components/createAssistant/StepBasicInfo.tsx`
   - `uploadFile` 失败
   - `chooseImage` 失败

2. `src/components/createAssistant/StepBrainSelect.tsx`
   - `getAgentType` 失败

3. `src/pages/createAssistantBasic.tsx`
   - `updateQrcodeInfo` 失败
   - `queryQrcodeInfo` 失败
   - 创建前再次查询二维码失败
   - `createDigitalTwin` 返回结果非法
   - `createDigitalTwin` 失败

4. `src/pages/selectBrainAssistant.tsx`
   - `createDigitalTwin` 返回结果非法
   - 创建确认整体失败

#### 卡片与组件动作

1. `src/components/PermissionCard.tsx`
   - `replyPermission` 失败

2. `src/components/QuestionCard.tsx`
   - 提交回答失败

3. `src/components/CodeBlock.tsx`
   - 复制失败

4. `src/components/MessageBubble.tsx`
   - 复制失败

5. `src/components/skillCUI/SkillCUIHeader.tsx`
   - 最小化失败
   - 关闭失败

#### 宿主与基础设施

1. `src/utils/hwext.ts`
   - `registerSessionListener` 失败
   - `unregisterSessionListener` 失败
   - UEM 上报失败
   - 更新检查日志

2. `src/utils/useMobileStatusBarHeight.ts`
   - 获取状态栏高度失败

3. `src/i18n/config.ts`
   - 语言初始化失败

## 3. 当前缺口

当前埋码存在以下明显缺口：

1. 只有少量点击埋码，没有接口成功埋码。
2. 大多数接口只有失败 `WeLog`，没有成功埋码。
3. `reportUemEvent` 固定 `result: true`，无法表达失败。
4. 没有接口耗时埋码。
5. 没有统一的接口埋码入口，当前接口结果日志散落在页面、hook、组件中。
6. 没有页面曝光埋码。
7. 没有关键流程埋码，例如：
   - 会话初始化成功
   - 历史会话加载成功
   - 消息发送成功
   - AI 回复完成 / 失败
   - 权限处理成功
   - 问题回答成功
   - 助理创建成功 / 删除成功 / 编辑成功

## 4. 需要纳入“服务端请求成功/失败埋码”的接口清单

以下接口属于“需要请求服务端或宿主转发服务端”的能力，建议统一补充成功与失败埋码。

### 4.1 会话与消息类

1. `createNewSession`
2. `getHistorySessionsList`
3. `getSessionMessage`
4. `getSessionMessageHistory`
5. `sendMessage`
6. `sendMessageToIM`
7. `regenerateAnswer`
8. `stopSkill`
9. `replyPermission`

### 4.2 助理管理类

1. `getWeAgentList`
2. `getWeAgentDetails`
3. `getAgentType`
4. `createDigitalTwin`
5. `updateWeAgent`
6. `deleteWeAgent`
7. `notifyAssistantDetailUpdated`
8. `getWeAgentUri`

### 4.3 二维码与权限类

1. `queryQrcodeInfo`
2. `updateQrcodeInfo`
3. `checkCreateAssistantWhitelist`

### 4.4 文件与媒体类

1. `uploadFile`

说明：

1. `chooseImage` 属于本地选择器，不属于服务端请求，不强制纳入“接口成功/失败埋码”。
2. `openWeAgentCUI` 更偏宿主打开页面动作，不属于服务端接口，但建议单独做动作埋码。
3. `registerSessionListener` / `unregisterSessionListener` 属于 SDK/宿主能力注册，建议保留 `WeLog`，可选补宿主接口埋码。
4. `controlSkillWeCode` 更偏宿主动作，不属于服务端接口，但建议单独做动作埋码。

## 5. 建议补充的埋码场景

除了“所有服务端接口成功/失败都要埋码”，还建议补充以下场景。

### 5.1 页面曝光

建议新增页面曝光埋码：

1. `weagent_activate_page_show`
2. `weagent_select_assistant_page_show`
3. `weagent_switch_assistant_page_show`
4. `weagent_detail_page_show`
5. `weagent_create_assistant_basic_page_show`
6. `weagent_select_brain_page_show`
7. `weagent_chat_page_show`
8. `skill_cui_page_show`

### 5.2 关键操作点击

当前点击埋码还可以补充：

1. 发送消息按钮点击
2. 停止生成按钮点击
3. 发送到 IM 按钮点击
4. 最小化按钮点击
5. 关闭按钮点击
6. 历史会话条目点击
7. 历史会话侧边栏关闭点击
8. 权限按钮点击
   - 允许一次
   - 总是允许
   - 拒绝
9. 问题卡片点击
   - 选项点击
   - 自定义回答提交
10. 助理详情页
   - 编辑点击
   - 删除点击
   - 复制 appId / secret 点击
11. 创建助理页
   - 上传头像点击
   - 选择默认头像点击
   - 下一步点击
   - 上一步点击
   - 创建确认点击

### 5.3 关键流程结果

建议新增流程结果埋码：

1. 会话初始化成功 / 失败
2. 创建会话成功 / 失败
3. 选择助理后打开成功 / 失败
4. 切换助理成功 / 失败
5. 加载历史会话成功 / 失败
6. 加载历史消息成功 / 失败
7. 发送消息成功 / 失败
8. AI 回复完成 / 中断 / 失败
9. 权限处理成功 / 失败
10. 问题回答成功 / 失败
11. 创建助理成功 / 失败
12. 编辑助理成功 / 失败
13. 删除助理成功 / 失败
14. 二维码失效 / 无权限 / 校验失败

## 6. 埋码规范建议

### 6.1 事件分类

建议将埋码分成 4 类：

1. 页面曝光事件
   - `*_page_show`

2. 点击事件
   - `*_click`

3. 接口事件
   - `api_*`

4. 流程结果事件
   - `flow_*`

### 6.2 统一字段

建议所有埋码统一包含以下字段：

| 字段 | 说明 |
|---|---|
| `clientType` | `mobile` / `pc` |
| `entry` | 固定 `WeAgent` / `SkillCUI` |
| `operationTime` | 时间戳 |
| `page` | 当前页面标识 |
| `assistantAccount` | 当前助理账号 |
| `partnerAccount` | 当前操作对象助理账号 |
| `welinkSessionId` | 会话 ID |
| `requestId` | 本次接口请求唯一 ID |
| `duration` | 接口耗时 |
| `result` | 成功 / 失败 |
| `errorCode` | 失败错误码 |
| `errorMessage` | 失败错误摘要 |

### 6.3 隐私与数据约束

以下字段不建议直接上报：

1. 用户输入原文
2. AI 回复正文
3. 权限请求正文
4. 问题卡片自定义回答全文
5. 文件本地路径
6. secret 原文

建议替换为：

1. `contentLength`
2. `hasCustomAnswer`
3. `permType`
4. `fileSize`
5. `fileMime`
6. `isInternalAssistant`

## 7. 统一实现方案

## 7.1 总体原则

实现上分两层：

1. `hwext.ts` 统一处理“服务端接口成功/失败埋码”
2. 页面 / 组件处理“点击埋码、曝光埋码、流程埋码”

这样可以保证：

1. 接口埋码不会漏
2. 页面层不需要每次手写成功失败埋码
3. 点击与流程埋码保留业务语义

### 7.2 `reportUemEvent` 扩展

当前：

```ts
reportUemEvent(eventId, eventTitle, data)
```

建议改为：

```ts
reportUemEvent({
  eventId,
  eventTitle,
  result,
  msg,
  duration,
  data,
})
```

建议字段：

```ts
interface UemEventPayload {
  eventId: string;
  eventTitle: string;
  result?: boolean;
  msg?: string;
  duration?: number;
  data?: Record<string, unknown>;
}
```

这样可以直接表达：

1. 成功
2. 失败
3. 耗时
4. 错误消息

### 7.3 新增统一接口埋码工具

建议新增文件：

- `src/utils/telemetry.ts`

建议提供以下能力：

1. `createBaseTelemetryData()`
2. `reportClickTelemetry(eventId, eventTitle, data?)`
3. `reportPageShowTelemetry(eventId, eventTitle, data?)`
4. `reportApiSuccess(apiName, data?)`
5. `reportApiFailure(apiName, error, data?)`
6. `withApiTelemetry(apiName, eventTitle, requestData, executor)`

推荐核心封装：

```ts
async function withApiTelemetry<T>(
  apiName: string,
  eventTitle: string,
  requestData: Record<string, unknown>,
  executor: () => Promise<T>,
): Promise<T>
```

行为：

1. 记录开始时间
2. 执行真实接口
3. 成功时上报成功埋码
4. 失败时上报失败埋码
5. 失败后继续向上抛错，不吞异常

### 7.4 `hwext.ts` 统一包裹接口

建议优先改造 `src/utils/hwext.ts` 导出的这些方法：

1. `createNewSession`
2. `getHistorySessionsList`
3. `getSessionMessage`
4. `getSessionMessageHistory`
5. `sendMessage`
6. `sendMessageToIM`
7. `regenerateAnswer`
8. `stopSkill`
9. `replyPermission`
10. `getWeAgentList`
11. `getWeAgentDetails`
12. `getAgentType`
13. `createDigitalTwin`
14. `updateWeAgent`
15. `deleteWeAgent`
16. `queryQrcodeInfo`
17. `updateQrcodeInfo`
18. `notifyAssistantDetailUpdated`
19. `getWeAgentUri`
20. `checkCreateAssistantWhitelist`
21. `uploadFile`

改造方式：

1. 页面层调用方式不变
2. 只在 `hwext.ts` 出口统一上报
3. 页面层保留 `WeLog` 和 `showToast`
4. 页面层不再重复补“接口成功/失败埋码”

### 7.5 点击埋码仍保留在页面 / 组件层

以下仍建议保留在 `uemUtil.ts` 或未来的 `telemetry.ts` 业务方法中：

1. 页面主按钮点击
2. 权限操作点击
3. 问题回答点击
4. 历史会话点击
5. 复制点击
6. 最小化 / 关闭点击

原因：

1. 这些动作具有明确业务语义
2. 不适合下沉到 `hwext.ts`

## 8. 接口埋码事件命名建议

建议接口事件统一命名为：

| 接口 | 建议事件 ID | 建议标题 |
|---|---|---|
| `createNewSession` | `api_create_new_session` | 创建会话 |
| `getHistorySessionsList` | `api_get_history_sessions` | 获取历史会话 |
| `getSessionMessage` | `api_get_session_message` | 获取会话消息 |
| `getSessionMessageHistory` | `api_get_session_message_history` | 获取历史消息 |
| `sendMessage` | `api_send_message` | 发送消息 |
| `sendMessageToIM` | `api_send_message_to_im` | 发送到 IM |
| `regenerateAnswer` | `api_regenerate_answer` | 重新生成 |
| `stopSkill` | `api_stop_skill` | 停止生成 |
| `replyPermission` | `api_reply_permission` | 回复权限 |
| `getWeAgentList` | `api_get_weagent_list` | 获取助理列表 |
| `getWeAgentDetails` | `api_get_weagent_details` | 获取助理详情 |
| `getAgentType` | `api_get_agent_type` | 获取智能体类型 |
| `createDigitalTwin` | `api_create_digital_twin` | 创建助理 |
| `updateWeAgent` | `api_update_weagent` | 更新助理 |
| `deleteWeAgent` | `api_delete_weagent` | 删除助理 |
| `queryQrcodeInfo` | `api_query_qrcode_info` | 查询二维码 |
| `updateQrcodeInfo` | `api_update_qrcode_info` | 更新二维码状态 |
| `notifyAssistantDetailUpdated` | `api_notify_assistant_detail_updated` | 通知助理更新 |
| `getWeAgentUri` | `api_get_weagent_uri` | 获取助理 URI |
| `checkCreateAssistantWhitelist` | `api_check_create_assistant_whitelist` | 校验创建助理权限 |
| `uploadFile` | `api_upload_file` | 上传文件 |

说明：

1. 同一事件 ID 即可表达成功与失败，通过 `result` 区分。
2. 若后续数据平台要求拆分，也可以扩展为 `_success` / `_fail`，但当前不建议一开始就双倍扩散事件名。

## 9. 建议新增的页面 / 流程埋码矩阵

### 9.1 聊天页

建议补充：

1. 页面曝光
2. 会话初始化成功 / 失败
3. 新建会话成功 / 失败
4. 历史会话加载成功 / 失败
5. 历史消息加载成功 / 失败
6. 发送消息点击
7. 发送消息成功 / 失败
8. AI 回复首包到达
9. AI 回复完成
10. AI 回复失败
11. 停止生成点击
12. 停止生成成功 / 失败
13. 发送到 IM 点击
14. 发送到 IM 成功 / 失败
15. 最小化点击
16. 关闭点击

### 9.2 权限与问题卡片

建议补充：

1. 权限卡片曝光
2. 权限允许一次点击
3. 权限总是允许点击
4. 权限拒绝点击
5. 权限回复成功 / 失败
6. 问题卡片曝光
7. 选项点击
8. 自定义回答提交点击
9. 回答成功 / 失败

### 9.3 助理管理

建议补充：

1. 助理列表加载成功 / 失败
2. 助理详情加载成功 / 失败
3. 助理编辑提交点击
4. 助理编辑成功 / 失败
5. 助理删除确认点击
6. 助理删除成功 / 失败
7. 历史会话条目点击

### 9.4 创建助理

建议补充：

1. 创建页曝光
2. 二维码查询成功 / 失败
3. 二维码失效
4. 白名单校验成功 / 失败
5. 无创建权限
6. 头像上传成功 / 失败
7. 下一步点击
8. 脑图页曝光
9. 获取智能体类型成功 / 失败
10. 创建助理成功 / 失败
11. 创建成功后打开助理页成功 / 失败

## 10. 推荐落地顺序

建议分三步实施：

### 第一步

统一底座：

1. 扩展 `reportUemEvent`
2. 新增 `telemetry.ts`
3. 在 `hwext.ts` 对所有服务端接口补统一成功/失败埋码

### 第二步

补页面动作埋码：

1. 聊天页主按钮
2. 权限卡片
3. 问题卡片
4. 助理选择 / 切换 / 创建按钮

### 第三步

补流程与曝光埋码：

1. 页面曝光
2. 会话初始化成功 / 失败
3. AI 回复完成 / 失败
4. 创建助理全链路结果

## 11. 本方案建议结论

本次建议的核心结论：

1. 当前 `ai-chat-viewer` 已有少量 UEM 点击埋码和大量 `WeLog` 失败日志，但整体不成体系。
2. “请求服务端的接口成功和失败都要埋码”最适合在 `src/utils/hwext.ts` 统一收口实现。
3. 点击埋码、曝光埋码、流程埋码仍应保留在页面 / 组件层，避免丢失业务语义。
4. `reportUemEvent` 必须支持 `result=false`、`duration` 和错误信息，否则无法满足接口成功/失败埋码要求。
5. 本次实现时优先保证“接口埋码不漏”，再逐步补齐页面曝光和关键动作埋码。
