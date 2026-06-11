# `助理 Tab 未读消息小红点技术方案`

- 方案日期：`2026-06-11`
- 目标工程：`skillSDK`、`ai-chat-viewer`
- 参考文档：`SkillClientSdkInterfaceV2.md`、`小程序JSAPI接口文档.md`、`ai-chat-viewer/docs/plans/技术方案模板.md`
- 方案类型：`跨端 SDK 未读消息同步与前端展示方案`

## 1. 背景

### 1.1 场景说明

当前助理 Tab 已支持打开当前助理的 `weAgentCUI` 页面和切换助理，但缺少会话未读消息提醒能力。新需求要求在助理 Tab 按钮、`weAgentCUI` 历史会话入口、历史会话列表 item 上展示未读小红点，帮助用户感知当前助理是否存在未读会话消息。

本方案将未读状态收口到服务端管控，端侧只做缓存、刷新、广播和 UI 展示，不在客户端计算未读数，也不对非当前选择助理展示 Tab 小红点。

需要特别处理三端页面生命周期差异：HarmonyOS 和 iOS 冷启动时会预加载 `weAgentCUI` 页面，并执行页面中的全部逻辑代码，但此时页面并未前台显示；Android 冷启动不会预加载 `weAgentCUI` 页面。因此 `weAgentCUI` 初始化阶段只能注册可见性监听和准备本地状态，不得直接上报已读，也不得把预加载视为用户已打开页面。所有会影响小红点消失的动作必须等待 `onVisible` 返回 `visibility = 1` 后执行。

### 1.2 需求目标

1. 助理 Tab 按钮只展示小红点，不展示也不计算未读消息数。
2. 助理 Tab 小红点只针对当前选择的助理生效，其他助理存在未读消息时不影响当前 Tab 按钮。
3. 从 A 助理在切换助理页面切换到 B 助理后，调用 SDK 接口获取 B 助理是否存在未读会话消息，并刷新助理 Tab 小红点。
4. 用户从 IM Tab 切换到助理 Tab 并打开当前助理 `weAgentCUI` 页面后，页面在移动端前台可见时请求服务端已读上报接口；服务端确认已读后，对应助理 Tab 小红点消失。
5. `weAgentCUI` 页面真实前台可见后调用 SDK 获取当前助理未读会话消息；若当前助理存在非当前会话的未读消息，历史会话列表按钮图标展示小红点；打开历史会话列表后，有未读消息的会话 item 展示小红点。
6. PC 端打开助理会话 CUI 页面并完成已读上报后，移动端对应助理会话的小红点需要消失。
7. 小红点是否展示由服务端后台管控：后台全员开关默认关闭；命中黑名单用户时不展示小红点。

### 1.3 非目标

1. 不展示未读消息数，不做未读数累加、合并或端侧计算。
2. 不改变助理 Tab 是否展示的 `isShowWeAgent` 逻辑。
3. 不改变现有消息收发、历史消息渲染和会话创建流程。
4. 不为非当前选择助理展示助理 Tab 小红点。

## 2. 方案图

### 2.1 整体方案图

```mermaid
flowchart TD
    A["SDK 初始化"] --> B["注册 IM 未读广播监听"]
    A --> C["请求服务端全量助理未读状态"]
    B --> D["接收服务端下发未读变更"]
    C --> E["写入 we_agent_unread_cache"]
    D --> E
    E --> F["读取 current_we_agent_detail"]
    F --> G{"当前助理是否有未读"}
    G -- "是" --> H["广播当前助理 unread=true"]
    G -- "否" --> I["广播当前助理 unread=false"]
    H --> J["助理 Tab 展示小红点"]
    I --> K["助理 Tab 隐藏小红点"]
    L["weAgentCUI 初始化"] --> Q["仅注册 onVisible，不上报已读"]
    Q --> R{"visibility 是否为 1"}
    R -- "否" --> S["保持未读状态，不清小红点"]
    R -- "是" --> M["上报当前会话已读"]
    M --> N["服务端返回/广播未读状态"]
    N --> E
    O["打开历史会话列表"] --> P["按会话未读状态展示 item 小红点"]
```

### 2.2 方案核心

核心方案是：SDK 初始化和 IM 广播共同维护“助理 + 会话”的未读状态缓存；助理 Tab 只消费当前助理的布尔未读态；`weAgentCUI` 初始化时只注册可见性监听，在移动端真实前台可见时才上报已读并读取 SDK 未读接口刷新小红点。

## 3. 时序图

### 3.1 SDK 初始化获取未读状态

```mermaid
sequenceDiagram
    participant Host as 宿主/前端
    participant SDK as SDK
    participant IM as IM 模块通知广播
    participant Storage as 本地缓存
    participant Server as 服务端

    Host->>SDK: 初始化 SDK
    SDK->>IM: 注册未读消息广播监听
    SDK->>Server: 获取所有助理未读消息状态
    Server-->>SDK: 返回助理与会话未读状态
    SDK->>Storage: 写入 we_agent_unread_cache
    SDK->>Storage: 读取 current_we_agent_detail
    SDK-->>Host: 广播当前助理未读状态
    Host->>Host: 刷新助理 Tab 小红点
```

### 3.2 IM 广播触发未读状态更新

```mermaid
sequenceDiagram
    participant Server as 服务端
    participant IM as IM 模块通知广播
    participant SDK as SDK
    participant Storage as 本地缓存
    participant Host as 宿主/前端

    Server->>IM: 下发未读消息变更数据
    IM->>SDK: 透传服务端未读消息数据
    SDK->>Storage: 合并写入 we_agent_unread_cache
    SDK->>Storage: 读取 current_we_agent_detail
    SDK-->>Host: 广播当前助理未读状态
    Host->>Host: 只刷新当前助理 Tab 小红点
```

### 3.3 切换助理后刷新 Tab 小红点

```mermaid
sequenceDiagram
    participant User as 用户
    participant Switch as 切换助理页面
    participant SDK as SDK
    participant Storage as 本地缓存
    participant Server as 服务端
    participant Host as 宿主/前端

    User->>Switch: 从 A 助理切换到 B 助理
    Switch->>SDK: 更新当前助理为 B
    Switch->>SDK: getWeAgentUnreadMessage({ partnerAccount: B })
    SDK->>Storage: 优先读取 B 助理未读缓存
    SDK-->>Switch: 返回缓存态 unread
    SDK->>Server: 异步刷新 B 助理未读状态
    Server-->>SDK: 返回最新 unread
    SDK->>Storage: 更新 we_agent_unread_cache
    SDK-->>Host: 广播 B 助理未读状态
    Host->>Host: 更新助理 Tab 小红点
```

### 3.4 weAgentCUI 预加载与前台可见后上报已读

```mermaid
sequenceDiagram
    participant User as 用户
    participant Host as 宿主/前端
    participant CUI as weAgentCUI 页面
    participant SDK as SDK
    participant Server as 服务端

    Host->>CUI: iOS/HarmonyOS 冷启动预加载 weAgentCUI
    CUI->>CUI: HWH5.addEventListener({ type: 'onVisible', func })
    CUI->>CUI: visibility = 0 或未收到前台可见事件
    CUI-->>CUI: 不上报已读，不调用页面展示用未读刷新
    User->>Host: 从 IM Tab 切换到助理 Tab
    Host->>CUI: 前台展示当前助理 weAgentCUI
    CUI->>CUI: visibility = 1
    CUI->>Server: 上报当前助理当前会话已读
    Server-->>CUI: 已读上报成功
    CUI->>SDK: getWeAgentUnreadMessage({ currentOnly: true })
    SDK-->>CUI: 返回当前助理未读状态
    SDK-->>Host: 广播当前助理 unread=false
    Host->>Host: 助理 Tab 小红点消失
```

### 3.5 历史会话列表小红点展示

```mermaid
sequenceDiagram
    participant CUI as weAgentCUI 页面
    participant SDK as SDK
    participant Server as 服务端
    participant List as 历史会话列表

    CUI->>CUI: 等待 onVisible 返回 visibility = 1
    CUI->>SDK: getWeAgentUnreadMessage({ currentOnly: true })
    SDK-->>CUI: 返回 assistantUnread 与 sessionUnreadMap
    CUI->>CUI: 判断是否存在非当前会话未读
    CUI->>CUI: 历史会话按钮展示/隐藏小红点
    CUI->>List: 打开历史会话列表
    List->>SDK: getWeAgentUnreadMessage({ currentOnly: true })
    SDK->>Server: 异步刷新当前助理未读状态
    SDK-->>List: 返回会话未读状态
    List->>List: 有未读的会话 item 展示小红点
```

### 3.6 PC 端已读同步到移动端

```mermaid
sequenceDiagram
    participant PC as PC 助理 CUI
    participant Server as 服务端
    participant IM as IM 模块通知广播
    participant SDK as 移动端 SDK
    participant Host as 移动端宿主

    PC->>Server: 打开会话并上报已读
    Server->>Server: 更新该助理会话未读状态
    Server->>IM: 下发未读变更
    IM->>SDK: 透传未读变更
    SDK->>SDK: 更新本地未读缓存
    SDK-->>Host: 广播当前助理未读状态
    Host->>Host: 助理 Tab / 历史入口 / 会话 item 小红点消失
```

## 4. 技术细节

### 4.1 调整点

1. SDK 初始化时注册 IM 模块未读消息广播监听，接收服务端下发的助理未读状态变更。
2. SDK 初始化时请求服务端获取所有助理未读消息状态，并写入本地缓存。
3. SDK 新增获取助理未读消息接口，优先返回缓存，同时异步请求服务端刷新缓存并广播最新状态。
4. SDK 新增或封装已读上报能力，供 `weAgentCUI` 页面在移动端前台可见时调用。
5. SDK 新增当前助理未读状态广播，宿主根据广播刷新助理 Tab 小红点。
6. `weAgentCUI` 页面初始化阶段只监听 `HWH5.addEventListener({ type: 'onVisible', func })`，不执行已读上报，也不触发用于页面展示的未读刷新。
7. `weAgentCUI` 收到 `visibility = 1` 后才上报已读，并调用 SDK 未读接口刷新历史按钮小红点和会话 item 小红点。
8. 服务端通过后台开关和黑名单控制是否返回或下发小红点可见状态，端侧不绕过服务端开关。

### 4.2 核心实现方式

#### 4.2.1 未读缓存结构

新增按 `userId` 隔离的 SDK 本地缓存 key：

| 缓存 key | 说明 |
|---|---|
| `we_agent_unread_cache` | 助理未读状态缓存，key 为 `partnerAccount` |

建议缓存结构：

```typescript
type WeAgentUnreadCache = {
  updatedAt: number
  assistants: Record<string, WeAgentUnreadState>
}

type WeAgentUnreadState = {
  partnerAccount: string
  robotId?: string
  assistantUnread: boolean
  sessions: Record<string, WeAgentSessionUnreadState>
  redDotVisible: boolean
}

type WeAgentSessionUnreadState = {
  welinkSessionId: string
  unread: boolean
  updatedAt?: string
}
```

说明：

1. `assistantUnread` 只表示当前助理是否存在未读会话消息，不表示未读数。
2. `sessions[welinkSessionId].unread` 用于历史会话列表 item 小红点展示。
3. `redDotVisible` 由服务端后台开关、黑名单和未读状态共同决定；当服务端返回 `false` 时，即使存在未读，端侧也不展示小红点。
4. SDK 对外广播时只广播当前助理的未读状态，避免非当前助理影响助理 Tab。

#### 4.2.2 SDK 未读接口

建议新增接口：

```typescript
getWeAgentUnreadMessage(params?: GetWeAgentUnreadMessageParams): Promise<GetWeAgentUnreadMessageResult>
```

入参：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 否 | 指定助理账号；不传时默认使用 `current_we_agent_detail.partnerAccount` |
| `currentOnly` | `boolean` | 否 | 是否只查询当前助理；默认 `true` |
| `forceRefresh` | `boolean` | 否 | 是否等待服务端刷新结果；默认 `false`，即缓存优先、异步刷新 |

出参：

| 参数名 | 类型 | 说明 |
|---|---|---|
| `partnerAccount` | `string` | 助理账号 |
| `robotId` | `string` | 助理 robotId |
| `assistantUnread` | `boolean` | 当前助理是否存在未读会话 |
| `redDotVisible` | `boolean` | 当前助理小红点是否允许展示 |
| `sessions` | `Array<WeAgentSessionUnreadState>` | 当前助理下会话未读状态 |
| `source` | `'cache' \| 'server'` | 本次返回来源 |

返回示例：

```json
{
  "partnerAccount": "123",
  "robotId": "123",
  "assistantUnread": true,
  "redDotVisible": true,
  "sessions": [
    {
      "welinkSessionId": "session_1",
      "unread": true,
      "updatedAt": "2026-06-11T10:00:00+08:00"
    }
  ],
  "source": "cache"
}
```

#### 4.2.3 已读上报接口

建议新增接口：

```typescript
reportWeAgentSessionRead(params: ReportWeAgentSessionReadParams): Promise<ReportWeAgentSessionReadResult>
```

入参：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 当前助理账号 |
| `robotId` | `string` | 否 | 当前助理 robotId |
| `welinkSessionId` | `string` | 否 | 当前会话 ID；不传时表示当前助理当前会话已读 |

出参：

| 参数名 | 类型 | 说明 |
|---|---|---|
| `status` | `string` | 固定返回 `success` |

已读上报成功后，SDK 立即将对应会话缓存置为已读，并重新计算当前助理 `assistantUnread` 与 `redDotVisible`；随后等待服务端广播或异步刷新校正最终状态。

#### 4.2.4 SDK 未读广播

建议新增 SDK 对外广播事件：

```typescript
type: 'agentskills.weAgentUnreadChanged'
```

广播 payload：

```json
{
  "partnerAccount": "123",
  "robotId": "123",
  "assistantUnread": true,
  "redDotVisible": true,
  "sessions": [
    {
      "welinkSessionId": "session_1",
      "unread": true
    }
  ],
  "source": "serverPush"
}
```

广播规则：

1. SDK 初始化服务端查询完成后广播一次当前助理未读状态。
2. IM 模块透传服务端未读变更后，若变更影响当前助理，则广播当前助理未读状态。
3. 切换助理后调用 `getWeAgentUnreadMessage`，返回缓存态后可广播一次；服务端刷新完成且状态变化时再广播一次。
4. 已读上报成功后广播当前助理最新未读状态。
5. 若服务端后台开关关闭或命中黑名单，`redDotVisible=false`，宿主和页面均不得展示小红点。

#### 4.2.5 助理 Tab 展示规则

1. 助理 Tab 只消费当前选择助理的 `redDotVisible`。
2. `redDotVisible=true` 时展示小红点；`false` 时隐藏小红点。
3. 不读取、不展示、不计算未读数。
4. 当前助理为空、激活页状态、服务端接口失败或缓存缺失时，默认不展示小红点。
5. 从 A 助理切到 B 助理后，必须以 B 助理为准重新调用 `getWeAgentUnreadMessage`，不能沿用 A 助理状态。

#### 4.2.6 weAgentCUI 页面展示规则

1. 页面初始化后立即调用 `HWH5.addEventListener({ type: 'onVisible', func })` 监听可见性。
2. 页面初始化阶段不得直接调用已读上报接口；HarmonyOS 和 iOS 冷启动预加载会执行页面代码，但不代表用户已前台打开 `weAgentCUI`。
3. 页面初始化阶段不得主动触发用于页面展示的 `getWeAgentUnreadMessage({ currentOnly: true })` 异步刷新；助理 Tab 小红点由 SDK 初始化全量未读查询和 IM 广播负责。
4. 回调中 `visibility = 1` 表示页面在移动端前台显示，页面先调用已读上报接口，再调用 `getWeAgentUnreadMessage({ currentOnly: true })` 获取最新未读状态。
5. 回调中 `visibility = 0` 表示页面不可见，不触发已读上报，不清理当前会话未读状态，不隐藏小红点。
6. Android 冷启动不会预加载 `weAgentCUI`，但仍按同一规则处理：页面初始化只注册监听，收到 `visibility = 1` 后再上报已读和刷新未读状态。
7. 页面需要维护本次前台可见周期的幂等标记，避免同一 `welinkSessionId` 在连续 `visibility = 1` 回调中重复上报已读；当会话或助理切换后重置该标记。
8. 如果存在非当前会话的未读消息，则历史会话列表按钮图标展示小红点。
9. 打开历史会话列表后，根据 `sessions[].unread` 给对应会话 item 展示小红点。
10. 当前正在打开的会话已读后，不再在该会话 item 上展示小红点；其他会话未读状态保持不变。

### 4.3 兼容与边界

1. 服务端后台开关默认关闭时，SDK 查询结果和 IM 广播均应返回 `redDotVisible=false` 或不返回未读数据；端侧默认不展示小红点。
2. 命中黑名单用户时，即使存在未读会话，服务端也应控制 `redDotVisible=false`，端侧不展示小红点。
3. 初始化请求失败时保留本地缓存；若本地也无缓存，默认当前助理无小红点。
4. IM 广播乱序时，以服务端返回的更新时间或版本号为准，旧版本未读状态不得覆盖新状态。
5. PC 端和移动端同时打开同一助理会话时，以服务端已读状态为准；移动端收到服务端广播后刷新缓存和 UI。
6. 当前助理切换过程中，旧助理未读广播不得影响新助理 Tab 小红点；广播消费方需要校验 `partnerAccount` 与当前助理一致。
7. 历史会话分页加载时，未读状态来自 SDK 未读缓存或服务端未读接口，不从历史会话列表条目自行推断。
8. HarmonyOS 和 iOS 冷启动预加载 `weAgentCUI` 时，页面执行初始化逻辑但未前台展示；该阶段不得触发已读上报，也不得因为页面代码执行而隐藏助理 Tab、历史按钮或会话 item 小红点。
9. 若预加载阶段没有收到 `onVisible` 回调，页面默认按不可见处理；只有明确收到 `visibility = 1` 才进入前台已读流程。

### 4.4 相关接口联动

1. SDK 初始化入口：注册 IM 未读广播监听，并触发一次全量助理未读状态查询。
2. `getWeAgentUnreadMessage`：新增 SDK 接口，缓存优先、异步刷新，返回当前助理未读状态与会话未读列表。
3. `reportWeAgentSessionRead`：新增 SDK 或页面可调用能力，仅用于 `weAgentCUI` 收到 `visibility = 1` 后上报当前会话已读。
4. `getWeAgentUri` / `openWeAgent`：打开或切换当前助理后，触发当前助理未读状态刷新。
5. `getHistorySessionsList`：历史会话列表仍负责返回会话列表；小红点状态通过未读接口补充，不要求该接口直接承载未读数。
6. `HWH5.addEventListener`：`weAgentCUI` 页面监听 `onVisible`，根据 `visibility` 判断是否上报已读。
7. SDK 对外广播：`agentskills.weAgentUnreadChanged` 通知宿主和页面刷新当前助理小红点。

### 4.5 文档需要同步修改的内容

1. `SkillClientSdkInterfaceV2.md`：补充 `getWeAgentUnreadMessage`、`reportWeAgentSessionRead` 接口定义、缓存优先和异步刷新规则。
2. `小程序JSAPI接口文档.md`：补充 `HWH5.addEventListener({ type: 'onVisible', func })` 在 `weAgentCUI` 已读上报场景的使用约束。
3. Android / iOS / HarmonyOS SDK 接口说明：补充 IM 未读广播监听、未读缓存、广播事件和失败降级规则。
4. `ai-chat-viewer` 相关文档：补充助理 Tab、历史会话按钮和历史会话 item 的小红点消费规则。

## 5. 性能

1. SDK 初始化新增一次全量助理未读状态查询；该请求只返回布尔状态和会话未读标识，不返回消息内容和未读数。
2. `getWeAgentUnreadMessage` 默认缓存优先，避免切 Tab 和打开页面时阻塞首屏。
3. 服务端异步刷新完成后仅在状态变化时广播，避免重复渲染。
4. 历史会话列表 item 小红点使用未读缓存映射，不对每个会话单独请求。
5. 已读上报只在 `weAgentCUI` 移动端前台可见时触发，避免 HarmonyOS / iOS 冷启动预加载造成额外请求和误清小红点。

## 6. 功耗

1. 不新增轮询机制。
2. 不新增独立长连接，复用 IM 模块通知广播通道。
3. 不新增后台常驻任务。
4. 页面不可见或处于 HarmonyOS / iOS 冷启动预加载态时不触发已读上报。
5. 未读状态变化才触发广播和 UI 刷新，避免频繁重绘。

## 7. 埋码

1. `we_agent_unread_init_request`
   - 说明：记录 SDK 初始化拉取未读状态的结果，建议包含 `success`、`assistantCount`、`duration`、`errorCode`。
2. `we_agent_unread_push_received`
   - 说明：记录 IM 未读广播接收情况，建议包含 `partnerAccount`、`robotId`、`sessionCount`、`version`。
3. `we_agent_unread_cache_update`
   - 说明：记录未读缓存更新结果，建议包含 `partnerAccount`、`assistantUnread`、`redDotVisible`、`source`。
4. `we_agent_unread_broadcast_sent`
   - 说明：记录 SDK 对外广播发送情况，建议包含 `partnerAccount`、`assistantUnread`、`redDotVisible`、`source`。
5. `we_agent_session_read_report`
   - 说明：记录已读上报结果，建议包含 `partnerAccount`、`welinkSessionId`、`visibility`、`success`、`errorCode`。
6. `we_agent_red_dot_exposure`
   - 说明：记录助理 Tab、历史会话按钮、历史会话 item 小红点展示情况，建议包含 `position(tab/historyButton/historyItem)`、`partnerAccount`。

## 8. 影响范围

### 8.1 直接影响

1. Android SDK、iOS SDK、HarmonyOS SDK 初始化流程、未读接口、缓存和广播能力。
2. 服务端未读状态查询、已读上报、IM 未读变更下发能力。
3. 宿主助理 Tab 小红点展示逻辑。
4. `ai-chat-viewer` 的 `weAgentCUI` 页面可见性监听、已读上报、历史会话按钮和 item 小红点展示。

### 8.2 间接影响

1. 切换助理页面在切换成功后需要触发当前助理未读状态刷新。
2. PC 端会话已读状态会通过服务端影响移动端小红点。
3. 弱网或离线恢复后，未读缓存可能短暂使用旧值，服务端刷新或广播到达后再校正。

### 8.3 不影响

1. 不影响助理 Tab 是否展示的开关能力。
2. 不影响现有消息收发、历史消息分页、会话恢复和流式消息渲染。
3. 不改变历史会话列表排序规则。
4. 不改变 `updateWeAgent`、`deleteWeAgent`、助理详情同步等既有接口语义。

## 9. 测试范围

### 9.1 功能测试

1. SDK 初始化成功拉取所有助理未读状态，当前助理存在未读时助理 Tab 展示小红点。
2. SDK 初始化成功拉取所有助理未读状态，当前助理无未读时助理 Tab 不展示小红点。
3. 当前助理无未读、非当前助理有未读时，助理 Tab 不展示小红点。
4. 从 A 助理切换到 B 助理后，校验 SDK 重新获取 B 助理未读状态，Tab 小红点按 B 助理刷新。
5. IM 广播下发当前助理未读变更为 `true` 时，SDK 更新缓存并广播，助理 Tab 展示小红点。
6. IM 广播下发当前助理未读变更为 `false` 时，SDK 更新缓存并广播，助理 Tab 小红点消失。
7. HarmonyOS / iOS 冷启动预加载 `weAgentCUI` 并执行页面初始化代码时，校验不触发已读上报，不调用页面展示用未读刷新，不隐藏助理 Tab 小红点。
8. Android 冷启动不预加载 `weAgentCUI`，校验页面打开后仍等待 `visibility=1` 再触发已读上报和未读刷新。
9. 用户从 IM Tab 切换到助理 Tab 并打开 `weAgentCUI`，页面 `visibility=1` 时上报已读，服务端成功后助理 Tab 小红点消失。
10. `weAgentCUI` 页面 `visibility=0` 时不触发已读上报。
11. `weAgentCUI` 前台可见后调用 `getWeAgentUnreadMessage`，存在非当前会话未读时历史会话按钮展示小红点。
12. 打开历史会话列表后，有未读消息的会话 item 展示小红点，无未读的 item 不展示。
13. 当前打开会话已读后，该会话 item 小红点消失，其他未读会话 item 保持显示。
14. 同一助理同一会话连续收到多次 `visibility=1` 回调时，校验只执行一次有效已读上报；切换会话或切换助理后允许重新上报。
15. PC 端打开并上报已读后，移动端收到服务端广播，当前助理 Tab、历史按钮和对应会话 item 小红点消失。
16. 服务端后台开关关闭时，即使存在未读数据，端侧也不展示任何助理未读小红点。
17. 命中黑名单用户时，端侧不展示助理 Tab、历史按钮和历史 item 小红点。
18. 初始化请求失败但本地有缓存时，优先展示缓存状态，并在后续刷新成功后校正。
19. 初始化请求失败且本地无缓存时，默认不展示小红点。

### 9.2 兼容测试

1. Android、iOS、HarmonyOS 三端未读接口出参、广播事件名和 payload 字段保持一致。
2. 旧版本未实现未读接口时，助理 Tab 默认不展示小红点，不影响打开助理。
3. 弱网、断网恢复、IM 广播延迟或乱序场景下，最终以服务端最新状态为准。
4. PC 与移动端同时打开同一助理会话时，小红点状态最终一致。

### 9.3 文档一致性检查

1. `SkillClientSdkInterfaceV2.md` 中新增接口、缓存规则、广播 payload 与本方案保持一致。
2. `小程序JSAPI接口文档.md` 中 `onVisible` 的 `visibility` 含义与本方案保持一致。
3. `ai-chat-viewer` 文档中助理 Tab、历史按钮、历史 item 的展示规则与本方案保持一致。

## 10. 最终建议

建议采用“服务端管控 + SDK 缓存广播 + 页面按当前助理消费”的方案。服务端负责开关、黑名单、跨端已读一致性和最终未读状态；SDK 负责初始化拉取、IM 广播接收、本地缓存和当前助理未读广播；宿主和 `weAgentCUI` 只消费布尔小红点状态，不计算未读数。后续优先补齐服务端协议和 `SkillClientSdkInterfaceV2.md` 接口定义，再推进 Android、iOS、HarmonyOS 与 `ai-chat-viewer` 联调。
