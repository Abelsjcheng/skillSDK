# ai-chat-viewer 与 Skill SDK 关联架构文档

## 概述

本文档基于以下资料梳理 `ai-chat-viewer` 与端侧 Skill SDK 的整体关联关系：

- [SkillClientSdkInterfaceV1.md](/F:/AIProject/skillSDK/SkillClientSdkInterfaceV1.md)
- [SkillClientSdkInterfaceV2.md](/F:/AIProject/skillSDK/SkillClientSdkInterfaceV2.md)
- [小程序JSAPI接口文档.md](/F:/AIProject/skillSDK/小程序JSAPI接口文档.md)
- `ai-chat-viewer` 路由、页面、桥接实现

目标是说明三件事：

1. 小程序页面有哪些，分别从什么场景进入。
2. 小程序通过哪些 JSAPI 调用 Skill SDK。
3. Skill SDK 再如何连接服务端 REST / WebSocket、本地缓存与宿主能力。

其中运行形态需要特别说明：

- Skill SDK 是移动端 App 或 PC 端 App 内部的一个模块，用于对接服务端，并为 `ai-chat-viewer` 提供统一接口。
- `ai-chat-viewer` 在移动端 App 上通过小程序形态运行。
- `ai-chat-viewer` 在 PC 端通过插件方式，在独立容器中运行。

## 架构图

![ai-chat-viewer 与 Skill SDK 架构图](/F:/AIProject/skillSDK/miniapp-sdk-architecture.png)

---

## 1. 总体分层

从整体上看，链路分为 5 层：

1. 入口场景层
2. `ai-chat-viewer` 页面层
3. 小程序 / 插件容器桥接层
4. 宿主 App 内 Skill SDK 能力层
5. 服务端与协议层

对应关系如下：

- 入口场景决定打开哪个页面或 URI。
- 页面通过 `src/utils/hwext.ts` 统一访问宿主暴露的桥接接口。
- `hwext.ts` 在移动端走 `window.HWH5EXT`，对应小程序调用移动端 App 内的 Skill SDK。
- `hwext.ts` 在 PC 端走 `Pedestal.callMethod(...)`，对应插件容器调用 PC 端 App 内的 Skill SDK。
- JSAPI 再映射到 Skill SDK V1 / V2。
- Skill SDK 访问服务端 REST / WebSocket，并管理本地缓存与会话状态。

---

## 2. 页面与入口场景

`ai-chat-viewer` 的主路由定义在 [AppRouter.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/routes/AppRouter.tsx)，核心页面如下：

| 页面路由 | 页面名称 | 页面文件 | 主要用途 | 常见入口场景 |
|---|---|---|---|---|
| `/weAgentCUI` | CUI聊天页面 | [weAgentCUI.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/weAgentCUI.tsx) | 助理聊天主页面 | 创建助理页面成功后、选择助理或者切换助理页面点击切换后，在客户端导航栏的助理 tab 中打开显示 |
| `/activateAssistant` | 激活页面 | [activateAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/activateAssistant.tsx) | 无助理时的激活引导页 | 客户端无当前助理时，在客户端导航栏的助理 tab 中打开显示 |
| `/selectAssistant` | 选择助理页面 | [selectAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/selectAssistant.tsx) | 选择已有助理并启动 | 激活页查询列表后跳转打开 |
| `/switchAssistant` | 切换助理页面 | [switchAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/switchAssistant.tsx) | 切换当前助理 | 客户端助理 tab 页面右上角 `+` 中点击打开 |
| `/assistantDetail` | 助理详情页面 | [assistantDetail.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/assistantDetail.tsx) | 查看助理详情、删除、进入编辑 | 客户端助理 tab 页面右上角 `+` 中点击打开 |
| `/editAssistant` | 助理编辑页面 | [editAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/editAssistant.tsx) | 编辑助理名称/头像/简介 | 详情页编辑按钮打开，或者被客户端通讯录模块调用 `openAssistantEditPage` 接口打开 |
| `/createAssistant` | 创建助理页面 | [createAssistantBasic.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/createAssistantBasic.tsx) | 创建助理第一页，填写基础信息 | 客户端助理 tab 页面右上角 `+` 中点击打开、客户端 IM 模块打开、扫二维码打开、PC 端通过 url 连接打开、选择助理底部左边按钮打开 |
| `/selectBrainAssistant` | 选择大脑助理页面 | [selectBrainAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/selectBrainAssistant.tsx) | 创建助理第二页，选择大脑助理类型 | 创建助理页面下一步进入 |

### 2.1 激活、选择与聊天入口链路

激活链路在 [activateAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/activateAssistant.tsx)：

- 页面启动后先调用 `getWeAgentList`
- 如果已有助理：
  - 跳转打开选择助理页面
- 如果没有助理：
  - 在客户端导航栏的助理 tab 中打开激活页面

选择与聊天入口链路补充如下：

- 选择助理页面由激活页查询列表后跳转打开
- 在选择助理页面点击切换后，打开 CUI聊天页面，并在客户端导航栏的助理 tab 中显示
- 在切换助理页面点击切换后，同样打开 CUI聊天页面，并在客户端导航栏的助理 tab 中显示
- 创建助理页面成功后，也会打开 CUI聊天页面，并在客户端导航栏的助理 tab 中显示

### 2.2 助理详情、切换与编辑链路

详情链路在 [assistantDetail.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/assistantDetail.tsx)：

- 页面从 query 里读取 `partnerAccount`
- 调用 `getWeAgentDetails` 拉取详情
- 删除时调用 `deleteWeAgent`
- 页面入口为客户端助理 tab 页面右上角 `+` 中点击打开

切换链路在 [switchAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/switchAssistant.tsx)：

- 页面入口为客户端助理 tab 页面右上角 `+` 中点击打开
- 页面中点击切换后打开 CUI聊天页面

编辑链路在 [EditAssistantContent.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/components/assistant/EditAssistantContent.tsx)：

- 从详情页进入时优先使用已有 `detail`
- 外部直开时根据 `partnerAccount` 调用 `getWeAgentDetails`
- 提交时调用 `updateWeAgent`
- 如果是“外部直开”场景，再调用 `notifyAssistantDetailUpdated`
- 移动端完成后 `window.HWH5.navigateBack()`
- 页面入口包括：
  - 详情页编辑按钮打开
  - 客户端通讯录模块调用 `openAssistantEditPage` 接口打开

### 2.3 创建助理链路

创建第一页在 [createAssistantBasic.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/createAssistantBasic.tsx)：

- 页面入口包括：
  - 客户端助理 tab 页面右上角 `+` 中点击打开
  - 客户端 IM 模块打开
  - 扫二维码打开
  - PC 端通过 url 连接打开
  - 选择助理底部左边按钮打开

- 普通场景：
  - 填完基础信息后跳到 `/selectBrainAssistant`
- 二维码场景：
  - 先调用 `queryQrcodeInfo`
  - 页面生命周期中按状态调用 `updateQrcodeInfo`
  - 确认后可直接调用 `createDigitalTwin`

创建第二页在 [selectBrainAssistant.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/selectBrainAssistant.tsx)：

- 调用 `createDigitalTwin`
- 如果不是 `from=weAgent` 场景：
  - 走 `handleCreateForOtherScene`
- 如果是 `from=weAgent`：
  - 再调用 `getWeAgentDetails`
  - 基于详情组装 `openWeAgentCUI` 入参
  - 最终打开聊天页

### 2.4 聊天主链路

聊天页入口在 [weAgentCUI.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/pages/weAgentCUI.tsx)，它从 query 读取 `assistantAccount` 并传给 [App.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/App.tsx)。

`App.tsx` 内核心流程：

1. `getUserInfo`
2. `getWeAgentDetails`
3. `getHistorySessionsList`
4. 若没有可复用会话则 `createNewSession`
5. `getSessionMessageHistory`
6. `registerSessionListener`
7. 对话中使用：
   - `sendMessage`
   - `stopSkill`
   - `replyPermission`
   - `getSessionMessageHistory`
   - `createNewSession`

---

## 3. JSAPI 与 Skill SDK 的映射关系

桥接统一收口在 [hwext.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/hwext.ts)。
`ai-chat-viewer` 不直接访问服务端，而是统一通过宿主桥接调用宿主 App 内的 Skill SDK。

### 3.1 移动端桥接

移动端以小程序形态运行在移动端 App 内，直接调用：

```typescript
window.HWH5EXT.xxx(...)
```

### 3.2 PC 端桥接

PC 端通过插件方式运行在独立容器内，再由容器通过 `Pedestal.callMethod(...)` 适配成与移动端一致的 `HWH5EXT` 形态：

- 通用 Skill 能力：
  `method://agentSkills/handleSdk`
- 助理管理部分接口：
  `method://agentSkillsDialog/*`

这样页面层不需要区分两套接口签名，只需要面向统一的桥接能力编程。

### 3.3 关键接口映射

| ai-chat-viewer 调用 | JSAPI | SDK 文档归属 | 主要用途 |
|---|---|---|---|
| `createNewSession` | `createNewSession` | V1 / JSAPI | 创建聊天会话 |
| `registerSessionListener` | `registerSessionListener` | V1 / JSAPI | 监听 WebSocket 流式消息 |
| `sendMessage` | `sendMessage` | V1 / JSAPI | 发送用户消息 |
| `stopSkill` | `stopSkill` | V1 / JSAPI | 停止生成 |
| `replyPermission` | `replyPermission` | V1 / JSAPI | 权限卡片回复 |
| `getSessionMessageHistory` | `getSessionMessageHistory` | V1 / JSAPI | 历史消息加载 |
| `getHistorySessionsList` | `getHistorySessionsList` | V1 / JSAPI | 会话历史侧栏 |
| `sendMessageToIM` | `sendMessageToIM` | V1 / JSAPI | AI 消息回传 IM |
| `createDigitalTwin` | `createDigitalTwin` | V2 / JSAPI | 创建助理 |
| `getAgentType` | `getAgentType` | V2 / JSAPI | 获取大脑助理类型 |
| `getWeAgentList` | `getWeAgentList` | V2 / JSAPI | 助理列表 |
| `getWeAgentDetails` | `getWeAgentDetails` | V2 / JSAPI | 助理详情 |
| `updateWeAgent` | `updateWeAgent` | V2 / JSAPI | 更新助理 |
| `deleteWeAgent` | `deleteWeAgent` | V2 / JSAPI | 删除助理 |
| `notifyAssistantDetailUpdated` | `notifyAssistantDetailUpdated` | V2 / JSAPI | 编辑回调通知 |
| `queryQrcodeInfo` | `queryQrcodeInfo` | V2 / JSAPI | 查询二维码状态 |
| `updateQrcodeInfo` | `updateQrcodeInfo` | V2 / JSAPI | 更新二维码状态 |
| `getWeAgentUri` | `getWeAgentUri` | V2 / JSAPI | 生成助理相关页面 URI |
| `openWeAgentCUI` | `openWeAgentCUI` | V2 / JSAPI | 打开助理聊天页 |

---

## 4. ai-chat-viewer 中的关键调用链

## 4.1 助理打开链路

助理打开辅助逻辑在 [assistantSelection.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/assistantSelection.ts)：

1. `getWeAgentDetails`
2. 从详情中提取 `weCodeUrl`、`partnerAccount`、`id`
3. 用 `buildOpenWeAgentCUIParams(...)` 组装：
   - `weAgentUri`
   - `assistantDetailUri`
   - `switchAssistantUri`
4. 移动端调用 `openWeAgentCUI`
5. PC 端调用 `handleWeAgentOpenInitPc`

这和 [SkillClientSdkInterfaceV2.md](/F:/AIProject/skillSDK/SkillClientSdkInterfaceV2.md) 里 `getWeAgentUri / openWeAgentCUI` 的职责是一致的，只是页面侧在部分场景下会自行先查详情再组装。

## 4.2 聊天消息链路

聊天消息主链路在 [App.tsx](/F:/AIProject/skillSDK/ai-chat-viewer/src/App.tsx)：

- 初始化阶段：
  - `getWeAgentDetails`
  - `getHistorySessionsList`
  - `createNewSession`
  - `getSessionMessageHistory`
  - `registerSessionListener`
- 运行阶段：
  - `sendMessage`
  - `stopSkill`
  - `replyPermission`
- 数据处理：
  - WebSocket `StreamMessage` 经 `StreamAssembler` 聚合为 UI 消息
  - 再交给 `Content`、`MessageBubble`、`PermissionCard` 等组件渲染

这一层主要依赖 SDK V1。

## 4.3 助理管理链路

助理管理主要依赖 SDK V2：

- 激活、选择、切换：
  `getWeAgentList`、`getWeAgentDetails`、`openWeAgentCUI`
- 详情：
  `getWeAgentDetails`
- 编辑：
  `getWeAgentDetails`、`updateWeAgent`、`notifyAssistantDetailUpdated`
- 删除：
  `deleteWeAgent`
- 创建：
  `createDigitalTwin`、`getWeAgentDetails`、`openWeAgentCUI`
- 二维码：
  `queryQrcodeInfo`、`updateQrcodeInfo`

---

## 5. 页面打开入口总表

| 页面 | 页面名称 | 直接入口 | 间接入口 / 跳转方 | 备注 |
|---|---|---|---|---|
| `weAgentCUI` | CUI聊天页面 | 客户端导航栏的助理 tab | 创建助理页面成功后、选择助理或者切换助理页面点击切换后 | 依赖 `assistantAccount` |
| `activateAssistant` | 激活页面 | 客户端导航栏的助理 tab | 客户端无当前助理时打开 | 默认引导页 |
| `selectAssistant` | 选择助理页面 | 激活页查询列表后跳转 | 激活页面 | 用于选择已有助理 |
| `switchAssistant` | 切换助理页面 | 客户端助理 tab 页面右上角 `+` 中点击打开 | 助理 tab 页面 | 点击切换后进入 CUI聊天页面 |
| `assistantDetail` | 助理详情页面 | 客户端助理 tab 页面右上角 `+` 中点击打开 | 助理 tab 页面 | 带 `partnerAccount` |
| `editAssistant` | 助理编辑页面 | 客户端通讯录模块调用 `openAssistantEditPage` 接口打开 | 详情页编辑按钮打开 | `source=assistantDetail` 时复用当前详情 |
| `createAssistant` | 创建助理页面 | 客户端助理 tab 页面右上角 `+` 中点击打开、客户端 IM 模块打开、扫二维码打开、PC 端通过 url 连接打开 | 选择助理底部左边按钮打开 | 创建第一页 |
| `selectBrainAssistant` | 选择大脑助理页面 | 创建助理页面下一步 | `createAssistant` | 依赖 route state 中的 draft |

---

## 6. 宿主协同与平台差异

## 6.1 移动端

移动端运行形态是“移动端 App + 小程序 + 宿主内 Skill SDK”，主要依赖：

- `window.HWH5EXT`
- `window.HWH5`
- `openWebview`
- `navigateBack`
- `close`
- `openIMChat`
- `getUserInfo / getDeviceInfo / uploadFile / chooseImage`

页面跳转更多依赖 H5 地址与宿主打开 webview，小程序页面本身不直接持有端能力实现。

## 6.2 PC 端

PC 端运行形态是“PC 端 App + 插件独立容器 + 宿主内 Skill SDK”，主要依赖：

- `window.Pedestal.callMethod(...)`
- hash 切页
- `assistantHostBridge.ts` 的自定义事件
- 组件化弹窗 / 对话框宿主能力

目前 [assistantPcHandle.ts](/F:/AIProject/skillSDK/ai-chat-viewer/src/utils/assistantPcHandle.ts) 中仍有多个 `todo`，说明 PC 宿主联动还保留了扩展位。

---

## 7. 缓存与状态关系

根据 V2 文档，助理相关状态主要由 SDK 持有：

- `current_we_agent_detail`
- `we_agent_details`
- `we_agent_list_cache`

`ai-chat-viewer` 页面本身只持有 UI 层状态，例如：

- 当前详情 `detail`
- 当前选择的助理 ID
- 当前会话消息列表
- 历史会话列表缓存

因此页面层是“轻状态”，真正跨页面复用、URI 组装、删除后切换、助理缓存刷新等能力都应以 Skill SDK 为主。

---

## 8. 结论

可以把当前架构概括成一句话：

`ai-chat-viewer` 是 Skill SDK 的页面化消费层。移动端场景下，它以小程序形态运行在移动端 App 中；PC 场景下，它以插件方式运行在独立容器中。页面统一通过 `hwext.ts` 调用宿主桥接接口，再由宿主 App 内的 Skill SDK 承接聊天会话能力（V1）和助理管理能力（V2），并连接服务端 REST / WebSocket 以及本地缓存。

从职责边界看：

- `ai-chat-viewer` 负责页面编排、交互、展示
- JSAPI 负责 Web 与端侧桥接
- Skill SDK 负责协议、缓存、会话、助理生命周期
- 服务端负责真实业务数据与流式事件

后续如果继续补齐文档，建议优先补两类内容：

1. `registerWeAgentListener` 等新增助理生命周期监听接口与小程序侧使用方式
2. PC 端 `assistantPcHandle.ts` 中宿主能力的正式约定与入口说明
