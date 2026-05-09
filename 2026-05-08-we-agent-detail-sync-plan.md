# 助理详情更新与删除同步方案

## 1. 背景

基于 [SkillClientSdkInterfaceV2.md](/F:/AIProject/skillSDK/SkillClientSdkInterfaceV2.md)，当前助理相关能力已经具备以下基础：

- `getWeAgentDetails`：获取指定助理详情，并写入 `current_we_agent_detail`
- `getAssistantDetails`：优先返回 `we_agent_details` 缓存，并异步刷新缓存
- `updateWeAgent`：更新助理信息，并同步更新本地缓存
- `deleteWeAgent`：删除助理，并在删除当前助理时处理切换逻辑

由于存在多端同时操作同一个助理的场景，SDK 还需要补齐“服务端主动通知 + 本地缓存刷新 + 对外监听回调”的统一同步机制，保证宿主能及时感知助理详情更新和助理删除。

> 说明：以下方案默认“服务端主动通知”通过 SDK 已接入的长连接/推送通道下发。若后续服务端采用其他通知通道，仅替换通知接入层，缓存处理与对外回调规则保持不变。

---

## 2. 目标

1. 当服务端主动下发“助理详情更新”或“助理删除”通知时，SDK 能自动更新本地缓存，并通过监听接口对外通知。
2. 当客户端冷启动，或从断网离线恢复到在线时，SDK 能对 `we_agent_details` 中的所有助理做异步补偿刷新，并在检测到差异或发现助理已删除时通过监听接口对外通知。
3. 当本端主动调用 `updateWeAgent` 成功后，SDK 除了更新缓存，还要立即通过监听接口通知助理更新事件。
4. 当本端主动调用 `deleteWeAgent` 成功后，SDK 除了更新缓存和当前助理切换状态，还要立即通过监听接口通知助理删除事件。
5. `ai-chat-viewer` 的 `weAgentCUI` 页面在收到助理更新或删除通知后，能够及时刷新助理信息，或引导用户切换到其他助理。

---

## 3. 缓存基线

缓存仍沿用 `SkillClientSdkInterfaceV2.md` 现有约定，并按 `userId` 隔离；当前 `userId` 仍使用 mock 值 `mock_user_id`：

- `current_we_agent_detail`
  当前助理详情对象。
- `we_agent_details`
  助理详情缓存对象，key 为 `partnerAccount`，value 为对应助理详情对象。
- `we_agent_list_cache`
  助理列表缓存。

本方案不新增新的持久化缓存 key，重点是补齐这些既有缓存的同步策略。

---

## 4. 对外监听机制

建议 SDK 新增统一监听接口：

```typescript
registerWeAgentListener(params: RegisterWeAgentListenerParams): Promise<RegisterWeAgentListenerResult>
```

### 4.1 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `string` | 是 | 生命周期事件类型，合法值：`update`（助理更新）、`delete`（助理删除） |
| `func` | `function` | 是 | 对应事件回调函数 |

### 4.2 回调载荷

- 当 `type = update` 时：
  `func` 的回调内容为助理更新后的详情数据，即 `WeAgentDetails` 对象。
- 当 `type = delete` 时：
  `func` 的回调内容为一个对象，仅包含 `partnerAccount` 字段。

### 4.3 注册规则

1. SDK 内部按 `type` 维度维护监听函数集合。
2. `update` 类型监听只接收助理更新通知。
3. `delete` 类型监听只接收助理删除通知。
4. 若场景触发了助理更新或助理删除，SDK 需通过 `registerWeAgentListener` 注册的监听函数将事件回调出去。

### 4.4 类型定义建议

```typescript
type RegisterWeAgentListenerParams = {
  type: 'update' | 'delete'
  func: (payload: WeAgentDetails | { partnerAccount: string }) => void
}

type RegisterWeAgentListenerResult = {
  status: 'success'
}
```

### 4.5 ai-chat-viewer 页面消费规则

`ai-chat-viewer` 中的 `weAgentCUI` 页面应作为当前助理生命周期事件的主要消费方：

1. 页面初始化后，分别调用两次 `registerWeAgentListener`：
   - 一次注册 `type = update`
   - 一次注册 `type = delete`
2. `update` 监听仅处理“当前聊天助理”的更新事件：
   - 若回调中的 `partnerAccount` 与当前页面助理一致，则更新页面中的助理名称、简介、头像等信息
   - 若不一致，则忽略
3. `delete` 监听仅处理“当前聊天助理”的删除事件：
   - 若回调中的 `partnerAccount` 与当前页面助理一致，则弹窗提示用户“助理已删除”
   - 弹窗底部按钮固定为“切换助理”
   - 弹窗不可取消
   - 点击“切换助理”后跳转到切换助理页面
   - 若删除的不是当前页面助理，则忽略

### 4.6 weAgentCUI 页面更新范围

当 `weAgentCUI` 页面收到当前助理的 `update` 通知时，建议至少同步以下展示字段：

- 助理名称
- 助理简介
- 助理头像
- 页面内依赖助理详情展示的其他轻量信息

页面不需要再次主动调用 `getWeAgentDetails`，可直接使用 `registerWeAgentListener(update)` 回调返回的最新 `WeAgentDetails` 更新 UI。

---

## 5. 助理详情更新方案

## 5.1 服务端主动下发详情更新通知

### 触发条件

服务端主动通知某个助理详情已更新。

### SDK 处理规则

1. SDK 从通知载荷中解析助理唯一标识，优先使用 `partnerAccount`，若服务端同时提供 `robotId` 也一并保留。
2. SDK 读取本地 `we_agent_details`，检查是否已存在该助理的缓存详情：
   - 若存在，则使用通知中的助理更新内容覆盖更新 `we_agent_details[partnerAccount]`
   - 若 `current_we_agent_detail` 命中同一助理，则同步覆盖为最新内容
3. 若本地 `we_agent_details` 中不存在该助理缓存详情，则不新增缓存，不调用查详情服务端接口补拉。
4. 该场景下不删除旧缓存，也不触发删除监听。
5. SDK 最后通过 `registerWeAgentListener` 触发 `type = update` 的监听函数，将通知中的助理更新内容直接对外广播；缓存是否存在、是否更新成功都不影响本次广播。

### 说明

- 该场景以服务端主动通知载荷作为广播与缓存更新的数据源，不再额外调用 `getWeAgentDetails` 或对应服务端查详情接口。
- 只有本地已存在该助理缓存详情时，SDK 才更新缓存；若本地不存在，则保持“不新增缓存”的最简策略。
- 广播触发时机固定放在缓存处理之后，且缓存处理结果不影响广播。

## 5.2 冷启动与离线恢复在线的缓存补偿刷新

### 触发条件

- SDK 冷启动初始化完成后
- 网络状态从离线切换为在线后

### SDK 处理规则

1. SDK 读取按 `userId` 隔离的 `we_agent_details` 缓存对象。
2. 若缓存为空，则直接结束，不发起补偿刷新。
3. SDK 从缓存对象中取出所有 `partnerAccount`，并按逗号拼接成字符串 `partnerAccounts`。
4. SDK 异步调用批量查详情服务端接口：`GET /v1/robot-partners/{partnerAccounts}`，其中 `partnerAccounts` 为以逗号分隔的字符串。
5. SDK 解析服务端返回的助理详情列表，并建立以 `partnerAccount` 为 key 的映射。
6. 对缓存中的每个 `partnerAccount` 分别处理：
   - 若服务端返回了对应助理详情，则与旧缓存详情比较；
   - 若存在差异，则更新 `we_agent_details[partnerAccount]`，并触发 `type = update` 的监听函数，将最新 `WeAgentDetails` 作为回调内容；
   - 若该助理同时命中 `current_we_agent_detail`，则同步覆盖当前助理缓存；
   - 若服务端未返回对应 `partnerAccount` 的助理详情，则同步删除 `we_agent_details` 中对应助理详情缓存；
   - 若服务端未返回对应 `partnerAccount` 的助理详情，且 `we_agent_list_cache` 中存在该助理，则同步从列表缓存中删除对应助理；
   - 若服务端未返回对应 `partnerAccount` 的助理详情，则触发 `type = delete` 的监听函数，将 `{ partnerAccount }` 作为回调内容；
7. 若批量请求失败，则仅记录日志，不更新缓存，也不触发广播。

### 说明

- 该场景下，服务端未返回某个缓存中的 `partnerAccount` 时，视为该助理已删除。
- 该场景的删除处理包含“删除本地详情缓存 + 删除列表缓存中的对应项 + 触发删除广播”；不复用 `deleteWeAgent` 的当前助理切换逻辑，也不组装 `nextUris`。
- 若删除的是当前助理，SDK 在该场景下也不同步删除 `current_we_agent_detail`；页面侧后续如何响应，由 `registerWeAgentListener(delete)` 的消费方决定。

## 5.3 本端调用 updateWeAgent 成功后的同步

### 触发条件

本端调用 `updateWeAgent` 成功，且服务端返回 `code = 200`。

### SDK 处理规则

1. 先按 `SkillClientSdkInterfaceV2.md` 既有约定更新本地缓存：
   - 若 `current_we_agent_detail` 命中当前助理，则同步更新名称、头像、简介
   - 若 `we_agent_details` 中存在对应助理缓存，则同步更新名称、头像、简介
2. 组装“最新助理详情快照”：
   - 优先使用更新后的本地缓存对象；
   - 若本地没有命中缓存，则本次不新增缓存，但仍可基于入参组装一个最小详情对象用于通知。
3. 触发 `type = update` 的监听函数，并将最新 `WeAgentDetails` 作为回调内容。

### 说明

- 该通知不依赖 `notifyAssistantDetailUpdated`。
- `notifyAssistantDetailUpdated` 仍只负责 `openAssistantEditPage` 的本地编辑页回调，不替代宿主级监听通知。

## 5.4 weAgentCUI 页面收到更新通知后的处理

### 触发条件

`weAgentCUI` 页面已注册 `type = update` 监听，且 SDK 回调了助理更新事件。

### 页面处理规则

1. 页面读取当前聊天助理的 `partnerAccount`。
2. 将回调载荷中的 `partnerAccount` 与当前页面助理做比对：
   - 若不一致，则直接忽略
   - 若一致，则继续处理
3. 使用回调中的最新 `WeAgentDetails` 更新页面内存态：
   - 助理名称
   - 助理简介
   - 助理头像
4. 页面中若存在依赖助理详情展示的头部、资料区或说明区，也同步刷新对应文案与图片。

### 说明

- 页面不需要再次请求 `getWeAgentDetails`，避免重复网络请求。
- SDK 已在回调前完成缓存更新，页面只消费最终结果即可。

---

## 6. 助理删除方案

## 6.1 服务端主动下发助理删除通知

### 触发条件

服务端主动通知某个助理已被删除。

### SDK 处理原则

该场景不再复用 `deleteWeAgent` 成功后的“当前助理切换”逻辑，而是采用更轻量的通知清理策略：

- 不再调用删除服务端接口
- 读取并清理本地 `we_agent_list_cache` 与 `we_agent_details`
- 若删除的是当前助理，也不同步删除 `current_we_agent_detail`
- 最后再触发删除广播

### SDK 处理规则

1. SDK 根据通知载荷拿到删除目标标识：
   - `partnerAccount` 与 `robotId` 至少一个存在
2. SDK 读取本地 `we_agent_list_cache`：
   - 若存在，则从列表缓存中删除对应助理并回写
3. SDK 读取本地 `we_agent_details`：
   - 若存在对应助理详情缓存，则移除对应条目并回写
4. SDK 最后触发 `type = delete` 的监听函数，并将 `{ partnerAccount }` 作为回调内容；缓存是否存在、是否删除成功都不影响本次广播。

### 说明

- 该场景的核心目的是“删除广播 + 删除列表缓存 + 删除详情缓存”。
- 与本端 `deleteWeAgent` 成功后的处理不同，该场景不做当前助理切换，不组装 `nextUris`，也不调用 `openWeAgentCUI`。
- 该场景不读取也不修改 `current_we_agent_detail`；是否为当前助理、页面应如何响应，由 `registerWeAgentListener(delete)` 的消费方自行判断。
- 广播触发时机固定放在缓存处理之后，且缓存处理结果不影响广播。

## 6.2 本端调用 deleteWeAgent 成功后的同步

### 触发条件

本端调用 `deleteWeAgent` 成功，且服务端返回 `code = 200`。

### SDK 处理规则

1. 先复用 `SkillClientSdkInterfaceV2.md` 中既有的删除后缓存处理逻辑：
   - 删除非当前助理：仅更新列表缓存
   - 删除当前助理：执行下一个助理定位、当前助理缓存切换、`nextUris` 组装
2. 在既有逻辑基础上，补充两点：
   - 若 `we_agent_details` 中存在被删除助理条目，同步删除对应详情缓存
   - 删除逻辑结束后，触发 `type = delete` 的监听函数，并将 `{ partnerAccount }` 作为回调内容

### 说明

- 删除通知应放在本地缓存更新完成后触发，保证宿主收到回调时，SDK 本地状态已经一致。
- 若删除的是当前助理，即使 `nextDetail` 为空，也需要基于 fallback 规则提供 `nextUris`，方便宿主后续直接拉起“激活助理”或其他兜底页。

## 6.3 weAgentCUI 页面收到删除通知后的处理

### 触发条件

`weAgentCUI` 页面已注册 `type = delete` 监听，且 SDK 回调了助理删除事件。

### 页面处理规则

1. 页面读取当前聊天助理的 `partnerAccount`。
2. 将回调载荷中的 `partnerAccount` 与当前页面助理做比对：
   - 若不一致，则直接忽略
   - 若一致，则继续处理
3. 弹出“助理已删除”提示弹窗。
4. 弹窗底部按钮固定为：
   - “切换助理”
5. 弹窗不可取消。
6. 点击“切换助理”：
   - 跳转到切换助理页面

### 说明

- 该弹窗只针对“当前聊天助理被删除”场景弹出。
- 删除非当前助理时，`weAgentCUI` 页面无需做任何 UI 变化。
- 弹窗不提供“取消”或关闭能力，用户需通过“切换助理”继续后续流程。
- “切换助理”跳转只负责把用户带到切换助理页面，后续由切换助理页面继续承接选择和打开新助理的流程。

---

## 7. 推荐的内部实现拆分

为避免三端实现继续膨胀，建议把“更新”和“删除”统一拆成内部公共流程。

## 7.1 详情更新公共流程

建议抽成统一内部方法：

```text
broadcastWeAgentDetailUpdated(payload)
```

职责：

1. 解析通知中的 `partnerAccount`
2. 检查本地 `we_agent_details` 是否存在对应助理缓存
3. 若存在则更新 `we_agent_details`
4. 若命中当前助理则同步更新 `current_we_agent_detail`
5. 最后回调 `type = update` 的监听函数

该方法可复用于：

- 服务端主动详情更新通知

## 7.2 删除后处理公共流程

建议抽成统一内部方法：

```text
handleWeAgentDeletedByServerNotification(partnerAccount, robotId)
```

职责：

1. 更新 `we_agent_list_cache`
2. 删除 `we_agent_details` 中被删除助理条目
3. 最后触发 `type = delete` 的监听函数

该方法仅复用于：

- 服务端主动删除通知

---

## 8. 时序建议

## 8.1 详情更新时序

```mermaid
flowchart TD
    A["开始"] --> B{"触发来源"}
    B -- "服务端主动详情更新通知" --> C["解析通知载荷"]
    C --> D["提取 partnerAccount / robotId"]
    D --> E["读取 we_agent_details"]
    E --> F{"是否存在该助理缓存"}
    F -- "否" --> G["不新增缓存"]
    F -- "是" --> H["用通知内容覆盖 we_agent_details 对应条目"]
    H --> I{"是否命中 current_we_agent_detail"}
    I -- "是" --> J["同步更新 current_we_agent_detail"]
    I -- "否" --> K["跳过当前助理缓存更新"]
    G --> L["回调 registerWeAgentListener(update)"]
    J --> L
    K --> L
    L --> M["结束"]

    B -- "冷启动 / 离线恢复在线补偿刷新" --> N["读取 we_agent_details 缓存对象"]
    N --> O{"缓存是否为空"}
    O -- "是" --> P["直接结束"]
    O -- "否" --> Q["提取全部 partnerAccount"]
    Q --> R["按逗号拼接为 partnerAccounts"]
    R --> S["异步调用 GET /v1/robot-partners/{partnerAccounts}"]
    S --> T{"批量请求是否成功"}
    T -- "否" --> U["记录日志并结束"]
    T -- "是" --> V["按 partnerAccount 建立返回结果映射"]
    V --> W["遍历缓存中的每个 partnerAccount"]
    W --> X{"服务端是否返回该助理详情"}
    X -- "否" --> Y["删除 we_agent_details 对应条目"]
    Y --> Z{"we_agent_list_cache 中是否存在该助理"}
    Z -- "是" --> AA["同步删除 we_agent_list_cache 对应条目"]
    Z -- "否" --> AB["跳过列表缓存删除"]
    AA --> AC["回调 registerWeAgentListener(delete)"]
    AB --> AC
    AC --> AD{"是否还有未处理 partnerAccount"}
    X -- "是" --> AE["取出 latestDetail"]
    AE --> AF["与旧缓存详情比较"]
    AF --> AG{"是否存在差异"}
    AG -- "否" --> AH["跳过更新广播"]
    AG -- "是" --> AI["更新 we_agent_details 对应条目"]
    AI --> AJ{"是否命中 current_we_agent_detail"}
    AJ -- "是" --> AK["同步更新 current_we_agent_detail"]
    AJ -- "否" --> AL["跳过当前助理缓存更新"]
    AK --> AM["回调 registerWeAgentListener(update)"]
    AL --> AM
    AH --> AD
    AM --> AD
    AD -- "是" --> W
    AD -- "否" --> AN["结束"]

    B -- "本端 updateWeAgent 成功" --> AO["收到服务端 code = 200"]
    AO --> AP["按既有规则更新本地缓存"]
    AP --> AQ{"current_we_agent_detail 是否命中当前助理"}
    AQ -- "是" --> AR["同步更新 current_we_agent_detail 的名称/头像/简介"]
    AQ -- "否" --> AS["跳过当前助理缓存更新"]
    AR --> AT{"we_agent_details 是否存在对应助理缓存"}
    AS --> AT
    AT -- "是" --> AU["同步更新 we_agent_details 对应条目的名称/头像/简介"]
    AT -- "否" --> AV["不新增 we_agent_details 缓存"]
    AU --> AW["组装最新助理详情快照"]
    AV --> AW
    AW --> AX["回调 registerWeAgentListener(update)"]
    AX --> AY["结束"]
```

## 8.2 删除时序

```mermaid
flowchart TD
    A["开始"] --> B{"触发来源"}
    B -- "服务端主动删除通知" --> C["解析通知载荷"]
    C --> D["识别 partnerAccount / robotId"]
    D --> E["读取 we_agent_list_cache"]
    E --> F{"列表缓存是否存在"}
    F -- "是" --> G["删除 we_agent_list_cache 中对应助理并回写"]
    F -- "否" --> H["跳过列表缓存处理"]
    G --> I["读取 we_agent_details"]
    H --> I
    I --> J{"详情缓存是否存在对应助理"}
    J -- "是" --> K["删除 we_agent_details 中对应条目并回写"]
    J -- "否" --> L["跳过详情缓存处理"]
    K --> M["回调 registerWeAgentListener(delete)"]
    L --> M
    M --> N["结束"]

    B -- "本端 deleteWeAgent 成功" --> O["调用方收到 code = 200"]
    O --> P["读取 current_we_agent_detail"]
    P --> Q{"删除目标是否命中当前助理"}
    Q -- "否" --> R["尝试更新 we_agent_list_cache"]
    R --> S["删除 we_agent_details 中对应条目"]
    S --> T["回调 registerWeAgentListener(delete)"]
    T --> U["结束"]
    Q -- "是" --> V["优先读取 we_agent_list_cache"]
    V --> W{"列表缓存是否存在"}
    W -- "否" --> X["调用 getWeAgentList 对应服务端接口获取列表"]
    W -- "是" --> Y["使用本地列表缓存"]
    X --> Z["基于删除前列表预计算下一个助理"]
    Y --> Z
    Z --> AA["从列表缓存中移除被删除助理并回写"]
    AA --> AB{"是否存在下一个助理"}
    AB -- "否" --> AC["删除 current_we_agent_detail"]
    AB -- "是" --> AD["优先从 we_agent_details 读取 nextDetail"]
    AD --> AE{"本地是否存在 nextDetail"}
    AE -- "是" --> AF["设置 current_we_agent_detail = nextDetail"]
    AE -- "否" --> AG["调用 GET /v1/robot-partners/{partnerAccount} 获取 nextDetail"]
    AG --> AH{"是否成功获取 nextDetail"}
    AH -- "是" --> AF
    AH -- "否" --> AC
    AF --> AI["删除 we_agent_details 中被删除助理条目"]
    AC --> AI
    AI --> AJ["按 fallback 规则组装 nextUris"]
    AJ --> AK["回调 registerWeAgentListener(delete)"]
    AK --> AL["结束"]
```

---

## 9. 与现有接口文档的关系

本方案不改变以下既有接口语义：

- `getWeAgentDetails`
- `getAssistantDetails`
- `updateWeAgent`
- `deleteWeAgent`
- `notifyAssistantDetailUpdated`

本方案是在其基础上补齐“跨端同步”和“宿主感知”的处理流程，并新增 `registerWeAgentListener` 作为统一的对外通知接口。

---

## 10. 落地建议

1. 先在文档层确认 `registerWeAgentListener` 的入参、监听回调载荷、注册规则。
2. 三端内部各自抽出统一的“详情刷新并通知”和“删除后处理并通知”公共方法，避免重复分支。
3. 先接入服务端主动通知，再补冷启动/离线恢复在线的补偿刷新。
4. `ai-chat-viewer` 优先在 `weAgentCUI` 页面接入 `registerWeAgentListener`，先打通“当前聊天助理更新/删除”的页面联动。
5. 最后将 `registerWeAgentListener` 正式补充到 SDK 接口文档中。
