# `WeAgent 历史会话删除方案`

- 方案日期：`2026-06-04`
- 目标工程：`ai-chat-viewer`
- 参考文档：`integration/skillSDK/ai-chat-viewer/docs/plans/技术方案模板.md`、`integration/skillSDK/ai-chat-viewer/docs/we-agent-history-sidebar-default-open.md`
- 方案类型：`功能方案`

## 1. 背景

### 1.1 场景说明

`weAgentCUI` 已支持历史会话列表、默认选中最近会话、新建会话、分页加载、标题更新和发送消息后的排序更新。当前历史列表只支持选择会话，不支持删除会话。移动端用户需要在历史对话列表内通过长按会话项触发删除入口，PC 用户需要通过右键会话项展示删除按钮，并在确认后删除指定会话。

现有历史列表由 `App` 维护 `HistorySessionsCache`，`WeAgentHistorySidebar` 消费缓存并在手动打开时静默刷新第一页。删除能力应继续复用这套缓存模型，避免侧边栏和主页面出现两份不一致状态。删除会话通过 `HWH5.fetch` 桥接方法调用服务端 DELETE 接口，服务端删除成功后会通过现有 websocket 链路推送 `session.deleted` 事件，多端同步复用现有 `registerSessionListener` 能力。

### 1.2 需求目标

1. 移动端 iOS、Android、鸿蒙移动端在历史对话列表长按会话项后，弹出删除按钮。
2. PC 端在历史对话列表右键会话项后，展示删除按钮。
3. 用户点击删除按钮后，弹出确认会话框，提示用户「删除对话后不可恢复」。
4. 用户点击「确认」后删除会话；点击「取消」后关闭确认框，不改变会话列表。
5. 删除成功后当前端立即移除本地缓存；同时兼容服务端通过 websocket 推送 `session.deleted` 事件后触发历史会话列表刷新。
6. 删除当前选中会话后，优先切换到被删会话后一条可用会话；没有后一条时切到前一条；都没有时插入并选中新会话。
7. 删除流程需要明确历史会话列表刷新时机、用户交互时序、多端同步时序和服务端接口对接位置。

### 1.3 非目标

1. 不新增新的跨设备实时推送通道；多端同步复用现有 websocket 和 `registerSessionListener`。
2. 不改变现有历史消息分页、流式消息监听和发送消息排序更新规则。
3. 不新增 PC 端键盘快捷键或批量删除能力。

## 2. 方案图

### 2.1 整体方案图

```mermaid
flowchart TD
    A["打开历史对话列表"] --> B{"当前端类型"}
    B -->|"移动端"| C["长按会话项"]
    B -->|"PC 端"| D["右键会话项"]
    C --> E["展示删除按钮"]
    D --> E
    E --> F["点击删除按钮"]
    F --> G["展示确认会话框"]
    G --> H{"用户选择"}
    H -->|"取消"| I["关闭确认框，列表不变"]
    H -->|"确认"| J["通过 HWH5.fetch 调用 DELETE /api/skill/sessions/{sessionId}"]
    J --> K{"删除结果"}
    K -->|"成功"| L["本地缓存移除会话"]
    L --> M["若删除当前选中会话，按后一条/前一条/新会话切换"]
    M --> N["收到 session.deleted 推送时刷新历史列表"]
    K -->|"失败"| O["展示失败提示，保留原列表"]
```

### 2.2 方案核心

删除成功后以 `HistorySessionsCache` 为唯一前端数据源：前端通过 `HWH5.fetch` 调用 `DELETE /api/skill/sessions/{sessionId}`，接口成功后立即移除被删除会话；服务端随后通过现有 websocket 推送 `session.deleted`，已注册监听的会话收到事件后刷新历史会话列表，完成多端校准。删除当前选中会话时，前端按「后一条、前一条、新会话」顺序完成会话切换。

### 2.3 历史会话刷新时机

```mermaid
flowchart TD
    A["进入 weAgentCUI"] --> B["getHistorySessionsList(page=0,size=50)"]
    B --> C["初始化 HistorySessionsCache"]

    D["用户打开历史列表"] --> E{"是否已有 cachedCache"}
    E -->|"有"| F["先展示 cachedCache"]
    E -->|"无"| G["展示加载态"]
    F --> H["静默刷新第一页"]
    G --> H
    H --> I["getHistorySessionsList(page=0,size=50)"]
    I --> J["更新 HistorySessionsCache"]

    K["点击加载更多"] --> L["getHistorySessionsList(page=currentPage+1,size=50)"]
    L --> M["合并到 HistorySessionsCache.content"]

    N["发送消息成功"] --> O["本地更新当前会话 updatedAt 并重排"]
    O --> P["不调用历史列表接口"]

    Q["删除会话成功"] --> R["本地移除 deleteTargetSession"]
    R --> S{"是否删除当前选中会话"}
    S -->|"是"| T["按后一条/前一条/新会话切换"]
    S -->|"否"| U["保持当前会话不变"]
    V["收到 session.deleted 推送"] --> W["刷新历史会话列表"]
```

历史会话列表在进入助手页、打开历史列表和加载更多时继续触发 `getHistorySessionsList`。发送消息成功只更新本地缓存；删除成功先更新本地缓存，后续若收到服务端 `session.deleted` 推送，则复用现有刷新逻辑重新拉取历史会话列表。

## 3. 时序图

### 3.1 用户删除历史会话

```mermaid
sequenceDiagram
    participant User as 用户
    participant Sidebar as WeAgentHistorySidebar
    participant App as App
    participant API as HWH5.fetch
    participant Server as 服务端

    alt 移动端
        User->>Sidebar: 长按历史会话项
    else PC 端
        User->>Sidebar: 右键历史会话项
    end
    Sidebar->>Sidebar: 记录 deleteTargetSession
    Sidebar->>Sidebar: 展示删除按钮
    User->>Sidebar: 点击删除按钮
    Sidebar->>Sidebar: 展示确认会话框

    alt 用户取消
        User->>Sidebar: 点击取消
        Sidebar->>Sidebar: 关闭确认框，清理 deleteTargetSession
    else 用户确认
        User->>Sidebar: 点击确认
        Sidebar->>API: HWH5.fetch("/api/skill/sessions/{sessionId}", { method: "delete" })
        API->>Server: DELETE /api/skill/sessions/{sessionId}
        Server-->>API: { code: 0, data: { status: "deleted", welinkSessionId } }
        alt 删除成功
            API-->>Sidebar: 返回成功
            Sidebar->>App: onSessionDeleted(welinkSessionId)
            App->>App: 从 HistorySessionsCache.content 移除会话
            App->>Sidebar: cachedCache 更新
        else 删除失败
            API-->>Sidebar: 400 无效ID / 403 无权限 / 网络异常
            Sidebar->>Sidebar: 展示失败提示，恢复删除中态
            Sidebar->>Sidebar: 保留原列表
        end
    end
```

### 3.2 删除当前选中会话后的前端状态切换

```mermaid
sequenceDiagram
    participant User as 用户
    participant Sidebar as WeAgentHistorySidebar
    participant App as App
    participant Chat as useChatSession
    participant API as HWH5.fetch
    participant SDK as HWH5EXT（现有接口）

    User->>Sidebar: 确认删除当前选中会话
    Sidebar->>App: 通知准备删除当前选中会话
    App->>App: 进入会话切换中状态，禁用输入、发送、停止和历史会话选择
    Sidebar->>API: DELETE /api/skill/sessions/{currentWelinkSessionId}
    alt 删除失败
        API-->>Sidebar: 返回失败
        Sidebar->>App: 通知取消当前会话删除状态
        App->>App: 退出会话切换中状态
    else 删除成功
        API-->>Sidebar: 删除成功
        Sidebar->>App: onSessionDeleted(currentWelinkSessionId)
        App->>Chat: resetTransientState()
        App->>App: 从缓存移除当前会话
        App->>App: 选择下一条可用会话

        alt 当前会话后一条存在
            App->>App: setWelinkSessionId(nextSessionId)
            Chat->>SDK: getSessionMessageHistory(nextSessionId)
            Chat->>SDK: registerSessionListener(nextSessionId)
            App->>App: 退出会话切换中状态
        else 当前会话后一条不存在但前一条存在
            App->>App: setWelinkSessionId(nextSessionId)
            Chat->>SDK: getSessionMessageHistory(nextSessionId)
            Chat->>SDK: registerSessionListener(nextSessionId)
            App->>App: 退出会话切换中状态
        else 前后均无可用会话
            App->>SDK: createNewSession()
            SDK-->>App: newSession
            App->>App: 插入新会话并 setWelinkSessionId(newSessionId)
            App->>App: 退出会话切换中状态
        end
    end
```

### 3.3 多端同步

```mermaid
sequenceDiagram
    participant DeviceA as 设备 A
    participant Server as 服务端
    participant DeviceB as 设备 B

    participant DeviceAListener as 设备 A registerSessionListener
    participant DeviceBListener as 设备 B registerSessionListener

    DeviceA->>Server: HWH5.fetch DELETE /api/skill/sessions/{sessionId}
    Server-->>DeviceA: { code: 0, data: { status: "deleted", welinkSessionId } }
    DeviceA->>DeviceA: 本地移除会话

    Server-->>DeviceAListener: session.deleted
    Server-->>DeviceBListener: session.deleted

    DeviceAListener->>DeviceA: 刷新历史会话列表
    DeviceBListener->>DeviceB: 刷新历史会话列表

    alt 设备 B 已打开会话且已注册监听
        DeviceB->>Server: getHistorySessionsList(page=0,size=50)
        Server-->>DeviceB: 不包含已删除会话
        DeviceB->>DeviceB: 更新 HistorySessionsCache
    else 设备 B 未打开会话或未注册监听
        DeviceB->>DeviceB: 暂不收到推送
        DeviceB->>Server: getHistorySessionsList(page=0,size=50)
        Server-->>DeviceB: 不包含已删除会话
        DeviceB->>DeviceB: 下次进入/打开历史列表时校准缓存
    end
```

## 4. 技术细节

### 4.1 实现清单

1. `WeAgentHistorySidebar`：新增移动端长按入口、PC 右键入口、删除按钮、确认弹窗和删除中态。
2. `App`：新增 `onSessionDeleted` 处理，统一维护 `HistorySessionsCache`、当前会话切换和无可用会话兜底创建。
3. `deleteHistorySession`：新增统一删除封装，底层按宿主桥接规范走 `HWH5.fetch`。
4. `registerSessionListener` 消息处理：识别 `session.deleted` 类型，收到后刷新历史会话列表；如果被删会话是当前会话，则复用当前会话删除后的切换逻辑。
5. i18n：新增删除按钮、确认弹窗、删除成功和删除失败文案。

### 4.2 状态设计

1. `deleteTargetSession`：归属 `WeAgentHistorySidebar`，记录当前待删除会话，至少包含 `welinkSessionId` 和标题；取消、切换目标、关闭侧边栏或删除结束后清理。
2. `isDeletingSession`：归属 `WeAgentHistorySidebar`，删除请求进行中置为 `true`，用于禁用删除按钮和确认按钮，防止重复提交。
3. `isSwitchingSessionAfterDelete`：归属 `App`，用户确认删除当前正在使用的会话后、发起删除请求前置为 `true`，用于禁用输入、发送、停止和历史会话选择；删除失败或下一会话、新会话就绪后清理。

### 4.3 数据与缓存处理

1. 删除接口成功后先从 `HistorySessionsCache.content` 移除目标会话，并同步递减 `total`。
2. 收到服务端 `session.deleted` websocket 推送后，刷新历史会话列表，校准服务端状态。
3. 删除非当前会话时不影响 `useChatSession`；删除当前会话时先清空旧会话 transient state，再按后一条/前一条/新会话顺序切换。
4. 删除当前会话后的候选会话选择顺序固定为：当前会话在已加载列表中的后一条、前一条、新会话。
5. 删除当前会话且前后均无可用会话时，复用 `createNewSession` 创建新会话，并插入缓存头部。
6. 删除失败时不修改本地缓存，不切换当前会话。
7. 分页缓存先只更新已加载内容：删除后按新的 `total` 和 `pageSize` 重新计算 `totalPages`、`hasMore`；收到 `session.deleted` 后再通过刷新历史列表校准分页。

### 4.4 接口接入

1. `deleteHistorySession`
   - 状态：新增 HTTP 接口封装。
   - 调用方式：通过 `HWH5.fetch` 发起请求；业务层只调用统一的 `deleteHistorySession(params)`。
   - URL 统一由 `src/utils/apiEndpoints.ts` 管理，后续域名、文根或 path 调整只改该文件。
   - 环境根地址：
     - UAT：`https://www.example-beta.com/mag`
     - 生产：`https://www.example.com/mag`
   - 接口 path：`/api/skill/sessions/{sessionId}`。
   - 最终请求 URL：`${环境根地址}/api/skill/sessions/{sessionId}`。
   - Method：`delete`。
   - Request：无 body。
   - Response：

```json
{
  "code": 0,
  "data": {
    "status": "deleted",
    "welinkSessionId": "{sessionId}"
  }
}
```

   - Errors：`400` 表示无效 ID；`403` 表示无权限。
   - `HWH5.fetch` 调用示例：

```typescript
const url = buildDeleteHistorySessionUrl(sessionId);
const headers = {
  'Content-Type': 'application/json',
};

HWH5.fetch(url, { method: 'delete', headers })
  .then((res) => res.json())
  .then((reply) => {
    console.log('服务端返回：', reply);
  })
  .catch((error) => {
    console.log('请求异常', error);
  });
```

2. `getHistorySessionsList`
   - 复用现有接口。
   - 进入助手页、打开历史列表和加载更多时沿用现有刷新机制。
   - 收到 `session.deleted` 推送后触发刷新，用于同步服务端删除结果。
3. `createNewSession`
   - 复用现有接口。
   - 仅在删除当前会话且前后均无可用会话时调用。
4. `registerSessionListener`
   - 复用现有 websocket 监听能力。
   - 服务端删除接口成功后推送事件：

```json
{
  "type": "session.deleted",
  "sessionId": "{sessionId}",
  "content": {
    "welinkSessionId": "{sessionId}"
  }
}
```

   - 已打开会话收到 `session.deleted` 后刷新 session 列表；如果删除的是当前选中会话，则执行后一条/前一条/新会话切换逻辑。

### 4.5 边界约束

1. 移动端长按只展示删除入口，普通点击仍切换会话。
2. PC 端右键只展示删除入口，不触发 `onSessionSelect`。
3. 删除按钮出现后，点击其他会话、关闭侧边栏或点击遮罩应清理 `deleteTargetSession`。
4. 删除当前正在生成的会话前，前端不额外调用 `stopSkill`；服务端删除接口是否影响生成流程不在本方案中定义。
5. 文案「删除对话后不可恢复」按当前需求确认。

### 4.6 未确认项

1. UI 样式设计：删除按钮展示位置、右键操作态、暗黑模式样式、确认弹窗视觉细节待设计确认。
2. 国际化文本：删除按钮、确认弹窗标题、确认描述、成功/失败 toast 的中英文最终文案待产品/设计确认。

## 5. 性能

删除能力新增 1 次删除请求。删除接口成功后先做本地缓存移除；收到 `session.deleted` 推送后会触发 1 次历史列表刷新，用于校准服务端状态。该刷新复用现有 `getHistorySessionsList(page=0,size=50)` 能力，不增加首屏初始化请求。移动端长按态、PC 右键操作态和确认框只影响当前侧边栏局部状态，不引入大规模计算。

如果用户连续删除多条会话，应串行处理删除请求，避免并发删除导致缓存状态覆盖。

## 6. 功耗

不新增轮询、长连接、后台任务或持续动画。多端同步不增加新的实时推送通道，依赖现有 websocket 和 `registerSessionListener` 接收 `session.deleted` 后刷新列表，因此功耗影响较低。

## 7. 埋码

1. `openplatform_mobile_weagent_deletetopic`
   - 触发时机：移动端用户在确认弹窗点击确认，且发起删除会话请求时上报。
   - 适用端：iOS、Android、Harmony 移动端。
   - 字段：`entry`、`clientType`、`robot_id`、`bizRobotId`、`topicid`。
2. `opecodeplatform_pc_weagent_deletopic`
   - 触发时机：PC 端用户在确认弹窗点击确认，且发起删除会话请求时上报。
   - 适用端：PC。
   - 字段：`entry`、`clientType`、`robot_id`、`bizRobotId`、`topicid`。

字段口径：

1. `entry`：沿用现有埋码基础字段，建议固定为 `WeAgent`。
2. `clientType`：端类型，移动端取设备/宿主端类型，PC 端按现有 PC 口径填充。
3. `robot_id`：机器人/助理标识，取当前助手详情中的机器人主标识。
4. `bizRobotId`：业务机器人标识，取当前助手详情中的 `bizRobotId`。
5. `topicid`：被删除的会话 ID，对应当前方案中的 `welinkSessionId`。

触发规则：

1. 只在用户点击确认删除并准备发起 `deleteHistorySession` 时上报。
2. 取消删除、展示删除按钮、打开确认框不再上报。
3. 删除接口成功或失败不拆分额外事件；结果维度不在本次埋码章节中扩展。
4. 上报方式沿用现有 `uemUtil` fire-and-forget 原则，不阻塞删除交互和接口调用。

## 8. 影响范围

### 8.1 直接影响

1. `WeAgentHistorySidebar` 的移动端会话项交互、PC 会话项交互、长按态、右键操作态和弹窗展示。
2. `App` 内 `HistorySessionsCache` 的删除、刷新和当前会话兜底切换逻辑。
3. `deleteHistorySession` 统一 HTTP 封装和 `HWH5.fetch` 桥接适配。
4. 暗黑模式样式、i18n 文案和相关单元测试。

### 8.2 间接影响

1. 当前正在使用的会话被删除后，`useChatSession` 的监听清理、历史消息加载、会话切换中状态和输入区禁用状态。
2. 历史列表分页状态，尤其是删除后 `total`、`totalPages` 和「加载更多」按钮展示。
3. 多端场景下，已注册监听的设备会通过 `session.deleted` 刷新；未打开或未注册监听的设备在下次进入/打开历史列表前可能短暂展示已删除会话。

### 8.3 不影响

1. 历史消息内容渲染、Markdown 渲染、代码块渲染。
2. 发送消息、停止生成、权限回复和重新生成答案的协议。
3. PC 端默认展开历史侧边栏的初始打开逻辑。
4. 新建会话、标题更新和发送消息后的排序更新逻辑。

## 9. 测试范围

### 9.1 功能测试

1. 移动端长按历史会话项后展示删除按钮。
2. PC 端右键历史会话项后展示删除按钮。
3. 点击删除按钮后展示确认会话框，展示删除不可恢复类提示，最终文案以 i18n 确认结果为准。
4. 点击取消后关闭确认框，历史列表和当前会话不变。
5. 点击确认且删除成功后，被删除会话从本地列表移除；收到 `session.deleted` 推送后刷新历史列表。
6. 删除接口失败时展示失败提示，列表不变。
7. 删除非当前会话时，当前聊天内容和 `welinkSessionId` 不变。
8. 删除当前正在使用的会话时，立即进入会话切换中状态，输入框、发送按钮、停止按钮和历史会话选择暂时禁用。
9. 删除当前正在使用的会话且当前会话后一条存在时，切换到后一条会话。
10. 删除当前正在使用的会话且当前会话后一条不存在、前一条存在时，切换到前一条会话。
11. 删除当前正在使用的会话且前后均无可用会话时，自动创建新会话并选中。
12. 当前会话正在生成中时，删除前端不额外调用 `stopSkill`。
13. 移动端普通点击会话项仍能切换会话，不触发删除入口。
14. PC 端右键会话项不触发会话切换。

### 9.2 兼容测试

1. iOS、Android、Harmony 移动端长按行为一致。
2. PC 端不响应移动端长按入口，但右键会话项可展示删除按钮。
3. 移动端侧边栏关闭、点击遮罩、切换会话时能清理长按态。
4. PC 端点击其他会话、关闭侧边栏时能清理旧会话项的右键操作态。
5. 历史列表分页加载后，移动端长按或 PC 右键第二页会话仍能正确更新本地缓存，不因主动刷新第一页丢失已加载页。
6. 多端场景中，设备 A 删除后，已打开会话且已注册监听的设备 B 收到 `session.deleted` 并刷新历史会话列表，不再展示已删除会话。
7. 亮色和暗黑模式下，删除按钮、确认弹窗、遮罩和选中项均可读、可点击，文本和图标不重叠。
8. 中文和英文环境下，删除按钮、确认弹窗标题、描述和 toast 文案均来自 i18n 资源，长英文不撑破容器。
9. 设备未打开会话或未注册监听时，下次打开历史列表或重新进入助手页后，现有刷新机制能从服务端校准已删除会话。

### 9.3 文档一致性检查

1. 检查 `deleteHistorySession` HTTP 封装、`HWH5.fetch` 调用方式与服务端接口文档命名一致。
2. 检查 i18n key 与 `src/i18n/resources/zh.ts`、`src/i18n/resources/en.ts` 命名一致。
3. 检查确认框文案、toast 文案和测试断言一致。
4. 检查暗黑模式样式是否沿用 `theme.less` 变量和现有 `@media (prefers-color-scheme: dark)` 规则。
5. 检查历史列表刷新时机与 `we-agent-history-sidebar-default-open.md` 保持一致。
6. 检查本方案不再描述删除请求走 `HWH5EXT`、`Pedestal.callMethod` 或 `window.fetch`。

## 10. 最终建议

推荐采用「移动端长按入口 + PC 右键入口 + 确认框 + `HWH5.fetch` 删除接口 + 删除成功本地移除 + `session.deleted` 推送刷新列表」方案。该方案复用现有 `HistorySessionsCache`、历史列表刷新机制和 `registerSessionListener` websocket 能力，不新增推送通道；删除当前选中会话时按后一条、前一条、新会话顺序兜底。改动范围集中在侧边栏交互、`App` 缓存维护、当前会话删除切换、`deleteHistorySession` HTTP 封装和 `session.deleted` 事件处理。后续动作是进入实现阶段，并在实现时补齐 `HWH5.fetch` 桥接异常、`400/403` 错误提示和多端同步测试。
