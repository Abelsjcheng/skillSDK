# `助理详情更新与删除同步方案`

- 方案日期：`2026-05-08`
- 目标工程：`skillSDK`、`ai-chat-viewer`
- 参考文档：`SkillClientSdkInterfaceV2.md`、`ai-chat-viewer/docs/plans/技术方案模板.md`
- 方案类型：`跨端 SDK 同步机制设计`

## 1. 背景

### 1.1 场景说明

基于 [SkillClientSdkInterfaceV2.md](/F:/AIProject/skillSDK/SkillClientSdkInterfaceV2.md)，当前助理相关能力已经具备以下基础：

1. `getWeAgentDetails`：获取指定助理详情，并写入 `current_we_agent_detail`。
2. `getAssistantDetails`：优先返回 `we_agent_details` 缓存，并异步刷新缓存。
3. `updateWeAgent`：更新助理信息，并同步更新本地缓存。
4. `deleteWeAgent`：删除助理，并在删除当前助理时处理切换逻辑。

由于存在多端同时操作同一个助理的场景，SDK 还需要补齐“服务端主动通知 + 本地缓存刷新 + 对外广播通知”的统一同步机制，保证宿主能及时感知助理详情更新和助理删除。

以下方案默认“服务端主动通知”先由 IM 模块通知广播透传给 SDK，IM 模块广播载荷保持服务端返回数据原样透传，不在 IM 模块做字段改写或业务解析。SDK 收到 IM 模块通知广播后，先判断外层 `notify_module` 是否为 `welink-athena`，命中后再解析 `notify_data` 字符串中的业务 JSON。若后续服务端采用其他通知通道，仅替换通知接入层，缓存处理与对外回调规则保持不变。

### 1.2 需求目标

1. IM 模块通知广播注册方法先由外部宿主或 IM 模块接入层实现并标记 TODO；本阶段 SDK 只实现收到 IM 透传 payload 后的解析、缓存处理和对外广播逻辑。
2. 服务端主动下发助理详情更新或删除通知时，SDK 自动更新本地缓存，并通过客户端已有广播机制对外通知。
3. 客户端冷启动时，SDK 读取 `we_agent_details` 和 `current_we_agent_detail`，合并去重后使用现有 `getWeAgentDetails` 对应服务端接口批量查询有效 `partnerAccount`，并根据返回结果补偿更新或删除本地缓存；网络从离线恢复在线后的补偿刷新场景本阶段仍不实现。
4. 本端主动调用 `updateWeAgent` 成功后，在现有缓存更新逻辑完成后补充广播助理更新事件。
5. 本端主动调用 `deleteWeAgent` 成功后，在列表缓存与当前助理跳转逻辑完成后补充广播助理删除事件；若删除目标是当前助理，则直接调用 `SkillClientSdkInterfaceV2.md` 中的 `getWeAgentUri` 方法，由该方法内部判断是否存在主助理，有主助理时返回主助理 URI，否则返回激活页面 URI。
6. 专属助手的详情页不显示编辑按钮。
7. `ai-chat-viewer` 的 `weAgentCUI` 页面在收到助理更新或删除通知后，能够及时刷新助理信息，或引导用户切换到其他助理。
8. 面向通讯录提供助理更新与删除联动能力：通讯录可通过 SDK 端侧详情广播通知和删除广播通知感知状态变化，并通过既有 JSAPI 调用 `openAssistantEditPage` 与 `deleteWeAgent` 完成编辑入口打开和删除操作。
9. 通讯录调用 `openAssistantEditPage` 时按 `SkillClientSdkInterfaceV2.md` 仅使用必填 `partnerAccount` 定位助理；更新后的助理详情数据不再通过 `openAssistantEditPage` 回调返回，通讯录统一通过注册 `agentskills.agentUpdated` 端侧详情广播通知获取。

### 1.3 非目标

1. 不新增统一监听接口，继续复用客户端已有广播机制。
2. 不新增新的持久化缓存 key，继续沿用 `current_we_agent_detail`、`we_agent_details`、`we_agent_list_cache`。
3. 服务端主动删除通知场景下，不复用 `deleteWeAgent` 的当前助理跳转逻辑，不组装跳转 URI。

## 2. 方案图

### 2.1 整体方案图

```mermaid
flowchart TD
    A["外部 IM 接入层 TODO"] --> B["透传服务端通知 payload 给 SDK"]
    B --> C["SDK 接收 IM 模块透传的服务端通知"]
    D["冷启动补偿 / 本端更新删除成功"] --> E["SDK 解析助理标识与详情数据"]
    C --> E
    E --> F["更新 we_agent_details / we_agent_list_cache / current_we_agent_detail"]
    F --> G["broadcastWeAgentEvent"]
    G --> H["客户端已有 WeBroadCast"]
    H --> I["ai-chat-viewer weAgentCUI 消费更新或删除事件"]
    H --> J["通讯录消费端侧详情/删除广播通知"]
    K["通讯录"] --> L["openAssistantEditPage / deleteWeAgent"]
    L --> E
```

### 2.2 方案核心

IM 模块通知广播注册先由外部接入层处理并保留 TODO；SDK 本阶段暴露或保留内部入口接收 IM 模块透传的原始 payload。SDK 收到透传载荷后，先校验外层 `notify_module = welink-athena`，再将 `notify_data` 按 JSON 字符串解析为 `action + weCrew + notifyWecodeId` 业务载荷，最后统一将助理详情更新和删除事件收口为“缓存处理后广播”的内部流程。服务端主动通知、本端操作成功和冷启动补偿刷新复用同一套事件语义；网络从离线恢复在线后的补偿刷新本阶段暂不实现。

## 3. 时序图

### 3.1 IM 通知透传接收处理

```mermaid
sequenceDiagram
    participant Host as 宿主/前端
    participant SDK as SDK
    participant IM as IM 模块通知广播

    Host->>IM: TODO 注册 IM 模块通知广播监听
    IM-->>Host: 透传服务端返回数据
    Host->>SDK: 调用 SDK 接收处理入口并传入原始 payload
    SDK->>SDK: 校验 notify_module = welink-athena
    SDK->>SDK: 解析 notify_data 并分发 update/delete
```

### 3.2 服务端主动下发详情更新

```mermaid
sequenceDiagram
    participant Server as 服务端
    participant SDK as SDK
    participant Cache as 本地缓存
    participant Broadcast as 客户端广播
    participant Page as weAgentCUI

    Server->>SDK: 下发 IM 通知 { notify_module, notify_data }
    SDK->>SDK: 校验 notify_module = welink-athena
    SDK->>SDK: 将 notify_data 字符串解析为 action / weCrew / notifyWecodeId
    SDK->>Server: GET /v1/robot-partners/{partnerAccount}
    Server-->>SDK: 返回完整助理详情
    SDK->>Cache: 命中已有详情时覆盖 we_agent_details
    SDK->>Cache: 命中当前助理时覆盖 current_we_agent_detail
    SDK->>Broadcast: agentskills.agentUpdated
    Broadcast-->>Page: 推送 { type: update, data: assistantDetail, extraData }
    Page->>Page: 当前助理一致时按完整详情刷新
```

服务端通过 IM 模块通知广播下发更新详情的数据结构调整为：

```json
{
  "notify_module": "welink-athena",
  "notify_data": "{\"action\":\"update\",\"weCrew\":{\"robotId\":\"123\",\"partnerAccount\":\"123\",\"name\":\"分身小白\",\"icon\":\"/mcloud/xxx\",\"description\":\"数字分身小白能做...\"},\"notifyWecodeId\":[\"123456\"]}"
}
```

其中 `notify_data` 是 JSON 字符串，解析后的业务 JSON 为：

```json
{
  "action": "update",
  "weCrew": {
    "robotId": "123",
    "partnerAccount": "123",
    "name": "分身小白",
    "icon": "/mcloud/xxx",
    "description": "数字分身小白能做..."
  },
  "notifyWecodeId": ["123456"]
}
```

### 3.3 服务端主动下发删除

```mermaid
sequenceDiagram
    participant Server as 服务端
    participant SDK as SDK
    participant Cache as 本地缓存
    participant Broadcast as 客户端广播
    participant Page as weAgentCUI

    Server->>SDK: 下发 IM 通知 { notify_module, notify_data }
    SDK->>SDK: 校验 notify_module = welink-athena
    SDK->>SDK: 将 notify_data 字符串解析为 action / weCrew / notifyWecodeId
    SDK->>Cache: 从 we_agent_list_cache 移除目标助理
    SDK->>Cache: 从 we_agent_details 移除目标助理
    SDK->>Broadcast: agentskills.agentUpdated
    Broadcast-->>Page: 推送删除标识与 extraData
    Page->>Page: 当前助理一致时弹出“助理已删除”
```

服务端通过 IM 模块通知广播下发删除的数据结构调整为：

```json
{
  "notify_module": "welink-athena",
  "notify_data": "{\"action\":\"delete\",\"weCrew\":{\"robotId\":\"123\",\"partnerAccount\":\"123\"},\"notifyWecodeId\":[\"123456\"]}"
}
```

其中 `notify_data` 是 JSON 字符串，解析后的业务 JSON 为：

```json
{
  "action": "delete",
  "weCrew": {
    "robotId": "123",
    "partnerAccount": "123"
  },
  "notifyWecodeId": ["123456"]
}
```

### 3.4 冷启动补偿刷新

```mermaid
sequenceDiagram
    participant SDK as SDK
    participant Cache as 本地缓存
    participant Server as 服务端
    participant Broadcast as 客户端广播

    SDK->>Cache: 读取 we_agent_details 和 current_we_agent_detail
    SDK->>SDK: 合并去重有效 partnerAccount
    SDK->>Server: 复用 getWeAgentDetails 接口，传入逗号拼接的 partnerAccounts
    Server-->>SDK: 返回助理详情列表
    SDK->>Cache: 返回详情时覆盖已有详情缓存及命中的当前详情
    SDK->>Cache: 未返回对应助理时删除详情、列表及命中的当前详情
    SDK->>Broadcast: 按差异广播 update 或 delete，source=server
```

网络从离线恢复在线后的补偿刷新本阶段不实现。

### 3.5 本端主动更新或删除成功

```mermaid
sequenceDiagram
    participant Host as 宿主/前端
    participant SDK as SDK
    participant Server as 服务端
    participant Cache as 本地缓存
    participant Broadcast as 客户端广播

    Host->>SDK: updateWeAgent / deleteWeAgent
    SDK->>Server: 调用对应服务端接口
    Server-->>SDK: code = 200
    SDK->>Cache: 按既有规则更新本地缓存
    SDK->>Broadcast: 广播 agentskills.agentUpdated，payload 携带 extraData.source
    SDK-->>Host: 返回原接口结果
```

### 3.6 详情更新详细流程图

```mermaid
flowchart TD
    A["开始"] --> A1["外部接入层透传 IM payload / 本端 API 成功"]
    A1 --> B{"触发来源"}
    B -- "IM 模块透传服务端详情更新通知" --> C["读取外层 notify_module / notify_data"]
    C --> C0{"notify_module 是否为 welink-athena"}
    C0 -- "否" --> C2["忽略非 welink-athena 通知"]
    C0 -- "是" --> C3["将 notify_data 字符串解析为业务 JSON"]
    C3 --> C4{"notify_data 是否解析成功"}
    C4 -- "否" --> C2
    C4 -- "是" --> C1{"action 是否为 update"}
    C1 -- "否" --> C2["忽略非 update 通知"]
    C2 --> M["结束"]
    C1 -- "是" --> D["从 weCrew 提取 partnerAccount / robotId / name / icon / description"]
    D --> E["读取 we_agent_details"]
    E --> F{"是否存在该助理缓存"}
    F -- "否" --> G["不新增缓存"]
    F -- "是" --> H["用 weCrew 更新内容覆盖 we_agent_details 对应条目"]
    H --> I{"是否命中 current_we_agent_detail"}
    I -- "是" --> J["同步更新 current_we_agent_detail"]
    I -- "否" --> K["跳过当前助理缓存更新"]
    G --> L["调用 broadcastWeAgentEvent(agentskills.agentUpdated, updatePayload, source=server)"]
    J --> L
    K --> L
    L --> L1{"能否获取完整助理详情"}
    L1 -- "否" --> L2["记录日志，不广播"]
    L1 -- "是" --> L3["广播 data=完整助理详情"]
    L2 --> M
    L3 --> M

    B -- "冷启动补偿刷新" --> N["读取 we_agent_details 和 current_we_agent_detail"]
    N --> O["合并去重有效 partnerAccount"]
    O --> P{"待查询集合是否为空"}
    P -- "是" --> AN["结束"]
    P -- "否" --> Q["按逗号拼接 partnerAccounts"]
    Q --> R["复用 getWeAgentDetails 服务端接口批量查询"]
    R --> S{"请求是否成功"}
    S -- "否" --> AN
    S -- "是" --> T["按 partnerAccount 建立服务端详情映射"]
    T --> U["逐个比较本地缓存与服务端详情"]
    U --> V{"服务端是否返回该助理"}
    V -- "是且有差异" --> W["覆盖已有详情缓存及命中的当前详情"]
    W --> X["直接以完整详情广播 update，source=server"]
    V -- "是且无差异" --> Y["不广播"]
    V -- "否" --> Z["删除详情缓存、列表缓存及命中的当前详情"]
    Z --> AA["广播 delete，source=server"]
    X --> AB["处理下一账号"]
    Y --> AB
    AA --> AB
    AB --> AN

    B -- "本端 updateWeAgent 成功" --> AO["服务端更新接口成功"]
    AO --> AP["调用现有 updateCachedWeAgentDetails / updateCachedDetails"]
    AP --> AQ{"current_we_agent_detail 是否匹配 partnerAccount"}
    AQ -- "是" --> AR["更新 current_we_agent_detail 的 name / icon / description"]
    AQ -- "否" --> AS["保持 current_we_agent_detail 不变"]
    AR --> AT{"we_agent_details 是否命中对应详情缓存"}
    AS --> AT
    AT -- "是" --> AU["更新已命中的 we_agent_details 详情缓存"]
    AT -- "否" --> AV["不新增 we_agent_details 缓存"]
    AU --> AW["组装 updatePayload，extraData.source=local"]
    AV --> AW["组装 updatePayload，extraData.source=local"]
    AW --> AX["调用 broadcastWeAgentEvent(agentskills.agentUpdated, updatePayload)"]
    AX --> AX1{"GET /v1/robot-partners/{partnerAccount} 是否成功"}
    AX1 -- "否" --> AX2["不广播"]
    AX1 -- "是" --> AX3["广播 data=完整助理详情"]
    AX2 --> AY["结束"]
    AX3 --> AY
```

### 3.7 删除详细流程图

```mermaid
flowchart TD
    A["开始"] --> A1["外部接入层透传 IM payload / 本端 API 调用"]
    A1 --> B{"触发来源"}
    B -- "IM 模块透传服务端删除通知" --> C["读取外层 notify_module / notify_data"]
    C --> C0{"notify_module 是否为 welink-athena"}
    C0 -- "否" --> C2["忽略非 welink-athena 通知"]
    C0 -- "是" --> C3["将 notify_data 字符串解析为业务 JSON"]
    C3 --> C4{"notify_data 是否解析成功"}
    C4 -- "否" --> C2
    C4 -- "是" --> C1{"action 是否为 delete"}
    C1 -- "否" --> C2["忽略非 delete 通知"]
    C2 --> N["结束"]
    C1 -- "是" --> D["从 weCrew 识别 partnerAccount / robotId"]
    D --> E["读取 we_agent_list_cache"]
    E --> F{"列表缓存是否存在"}
    F -- "是" --> G["删除 we_agent_list_cache 中对应助理并回写"]
    F -- "否" --> H["跳过列表缓存处理"]
    G --> I["读取 we_agent_details"]
    H --> I
    I --> J{"详情缓存是否存在对应助理"}
    J -- "是" --> K["删除 we_agent_details 中对应条目并回写"]
    J -- "否" --> L["跳过详情缓存处理"]
    K --> M["调用 broadcastWeAgentEvent(agentskills.agentUpdated, deletePayload, source=server)"]
    L --> M
    M --> N

    B -- "本端调用 deleteWeAgent" --> O["校验必填 partnerAccount"]
    O --> P["构建 DeleteWeAgentContext"]
    P --> Q{"删除目标是否命中 current_we_agent_detail"}
    Q -- "否" --> R["标记为删除非当前助理"]
    Q -- "是" --> AA["标记为删除当前助理"]
    R --> AB["调用 DELETE /v4-1/we-crew"]
    AA --> AB
    AB --> AC{"删除接口是否成功"}
    AC -- "否" --> AD["返回错误，不更新缓存，不广播"]
    AD --> AL["结束"]
    AC -- "是" --> AE{"是否删除当前助理"}
    AE -- "否" --> AF{"本地是否存在列表缓存"}
    AF -- "是" --> AG["从 we_agent_list_cache 移除目标助理并回写"]
    AF -- "否" --> AH["不处理列表缓存"]
    AG --> AI["若 we_agent_details 有对应详情缓存则删除"]
    AH --> AI
    AI --> AJ["调用 broadcastWeAgentEvent(agentskills.agentUpdated, deletePayload, source=local)"]
    AJ --> AL
    AE -- "是" --> AM{"本地是否存在列表缓存"}
    AM -- "是" --> AN["从 we_agent_list_cache 移除目标助理并回写"]
    AM -- "否" --> AO["不处理列表缓存"]
    AN --> AU["删除 current_we_agent_detail 和 we_agent_details 中的目标助理缓存"]
    AO --> AU
    AU --> AV["调用 getWeAgentUri 获取删除后的目标 URI"]
    AV --> AW["按 getWeAgentUri 返回结果跳转"]
    AW --> AX["调用 broadcastWeAgentEvent(agentskills.agentUpdated, deletePayload, source=local)"]
    AX --> AL
```

## 4. 技术细节

### 4.1 调整点

1. IM 模块通知广播注册由外部接入层 TODO；SDK 本阶段只提供接收透传 payload 后的解析、缓存处理和广播逻辑。
2. 新增 SDK 内部广播封装：`broadcastWeAgentEvent(eventName: string, data: any): void`。
3. 服务端主动通知载荷统一为 IM 外层 `notify_module + notify_data` 结构；SDK 仅处理 `notify_module = welink-athena` 的通知，并将 `notify_data` JSON 字符串解析为 `action + weCrew + notifyWecodeId` 业务结构。
4. 助理更新与删除统一广播 `agentskills.agentUpdated`，通过 payload 中的 `type` 区分 `update` 与 `delete`。
5. 助理详情更新广播前必须通过 `GET /v1/robot-partners/{partnerAccount}` 获取完整助理详情，广播 payload 中的 `data` 为该完整助理详情对象；若本次详情请求失败或无法确定 `partnerAccount`，则不触发更新广播。
6. 助理更新与删除广播 payload 均新增 `extraData` 对象，`extraData.source` 用于区分本地广播来源：`server` 表示由服务端通知触发，`local` 表示由本端主动 API 成功触发。
7. 冷启动时执行批量补偿刷新；网络从离线恢复在线后的补偿刷新本阶段暂不实现。
8. `weAgentCUI` 页面订阅更新和删除广播，仅处理当前聊天助理相关事件。
9. 新增 SDK 内部助理缓存处理队列，所有会修改 `we_agent_details`、`we_agent_list_cache`、`current_we_agent_detail` 的事件都进入队列串行处理，避免本端主动操作与服务端同步广播回流并发写缓存。
10. 新增通讯录接入说明：通讯录复用 `openAssistantEditPage` 打开编辑页，复用 `deleteWeAgent` 删除助理，并订阅端侧详情广播通知和删除广播通知保持通讯录列表与详情同步。

### 4.2 核心实现方式

缓存仍沿用 `SkillClientSdkInterfaceV2.md` 现有约定，并按 `userId` 隔离；当前 `userId` 仍使用 mock 值 `mock_user_id`。

| 缓存 key | 说明 |
|---|---|
| `current_we_agent_detail` | 当前助理详情对象 |
| `we_agent_details` | 助理详情缓存对象，key 为 `partnerAccount`，value 为对应助理详情对象 |
| `we_agent_list_cache` | 助理列表缓存 |

SDK 内部新增助理缓存处理队列：

1. 队列为 SDK 内部实现，不新增公开接口，也不新增持久化缓存 key。
2. 所有会修改助理缓存的事件都必须先进入队列，由队列按入队顺序串行处理；同一时刻只处理一个事件，当前事件完成缓存读写和广播后再处理下一个事件。
3. 队列事件来源包括：
   - 本端主动 `updateWeAgent` 成功；
   - 本端主动 `deleteWeAgent` 成功；
   - 服务端主动广播 `action = update`；
   - 服务端主动广播 `action = delete`；
   - 冷启动补偿刷新；
4. 队列事件建议结构：
   ```typescript
   type WeAgentCacheMutation = {
     action: 'update' | 'delete';
     source: 'localApi' | 'serverPush' | 'coldStart';
     partnerAccount?: string;
     robotId?: string;
     data: Record<string, unknown>;
     enqueueTime: number;
   };
   ```
5. 本阶段不做服务端回流广播去重，不做广播前最终态 diff；本端主动操作成功后的队列事件处理完成后必须广播，服务端广播回流到达后也按服务端广播规则处理。
6. 服务端未返回 `version` 和 `eventTime`，队列不做版本或时间戳比较。
7. `update` 事件只更新本地已存在的助理缓存；若 `we_agent_details` 不存在对应助理缓存，则不新增缓存、不补拉详情，因此删除后迟到的 `update` 不会恢复已删除助理。
8. `delete` 事件按幂等方式处理；若列表缓存或详情缓存中已不存在目标助理，则跳过对应缓存处理，不报错。

SDK 内部统一封装广播调用：

```typescript
broadcastWeAgentEvent(eventName: string, data: any): void
```

方法职责：

1. 在方法内部统一接入客户端已有广播机制。
2. 方法内部直接调用 `WeBroadCast(eventName, data)` 完成实际广播。
3. `WeBroadCast(eventName, data)` 需按事件映射触发通过 `HWH5EXT.registerEventListener` 注册的页面监听回调，并将 `data` 作为回调参数透传给页面。
4. 所有助理更新和删除场景都统一复用该方法，不在业务分支中直接散落调用 `WeBroadCast(...)`。
5. 当 `data.type = 'update'` 时，方法内部先从 payload 或缓存中解析 `partnerAccount`，再请求 `GET /v1/robot-partners/{partnerAccount}` 获取完整助理详情，并使用接口返回的完整助理详情对象覆盖 `data.data` 后再广播。
6. 当更新广播无法确定 `partnerAccount`，或 `GET /v1/robot-partners/{partnerAccount}` 请求失败、超时、返回结构异常、未返回有效助理详情时，方法记录日志并终止本次广播，不调用 `WeBroadCast(...)`。
7. 当 `data.type = 'delete'` 时，不额外请求详情接口，直接广播删除 payload。

广播约定：

| 场景 | SDK 内部 eventName | HWH5EXT.registerEventListener type | payload |
|---|---|---|---|
| 助理详情更新 | `agentskills.agentUpdated` | `agentskills.agentUpdated` | `{ type: 'update', data: assistantDetail, extraData: { source } }`，其中 `data` 为 `GET /v1/robot-partners/{partnerAccount}` 返回的完整助理详情对象 |
| 助理删除 | `agentskills.agentUpdated` | `agentskills.agentUpdated` | `{ type: 'delete', data: weCrew, extraData: { source } }`；本端主动 `deleteWeAgent` 触发时 `data` 包含必填 `partnerAccount`，服务端通知触发时 `data` 与服务端 `weCrew` 保持一致 |

广播规则：

1. 若场景触发了助理更新，SDK 调用 `broadcastWeAgentEvent('agentskills.agentUpdated', updatePayload)`；`broadcastWeAgentEvent` 成功补拉完整助理详情后才对外广播。
2. 若场景触发了助理删除，SDK 调用 `broadcastWeAgentEvent('agentskills.agentUpdated', deletePayload)` 对外广播。
3. `updatePayload` 结构固定为：
   ```json
   {
     "type": "update",
     "data": {
       "name": "分身小白",
       "icon": "/mcloud/xxx",
       "desc": "数字分身小白能做...",
       "moduleId": "M1000",
       "partnerAccount": "123",
       "appKey": "",
       "appSecret": "",
       "createdBy": "",
       "creatorWorkId": "",
       "creatorW3Account": "",
       "creatorName": "",
       "creatorNameEn": "",
       "ownerWelinkId": "",
       "ownerW3Account": "",
       "ownerName": "",
       "ownerNameEn": "",
       "ownerDeptName": "",
       "ownerDeptNameEn": "",
       "id": "123",
       "bizRobotId": "biz_123",
       "bizRobotName": "业务助手",
       "bizRobotNameEn": "Business Agent",
       "bizRobotTag": "myAgent",
       "tagName": "助手",
       "tagNameEn": "Agent",
       "weCodeUrl": "h5://S008623/index.html?assistantAccount=123"
     },
     "extraData": {
       "source": "server"
     }
   }
   ```
4. `updatePayload.data` 必须为完整助理详情对象，字段以 `GET /v1/robot-partners/{partnerAccount}` 返回的 `WeAgentDetails` 为准；若后续服务端新增字段，SDK 需在最终广播 `data` 中原样透传。
5. `deletePayload` 结构固定为：
   ```json
   {
     "type": "delete",
     "data": {
       "partnerAccount": "123"
     },
     "extraData": {
       "source": "local"
     }
   }
   ```
6. `extraData.source = 'server'` 表示该广播由服务端主动通知触发；`extraData.source = 'local'` 表示该广播由本端主动调用 `updateWeAgent` 或 `deleteWeAgent` 成功触发。
7. 广播触发时机固定放在本地缓存处理之后；删除广播不受缓存命中结果影响，更新广播受完整详情补拉结果影响，补拉失败则不广播。

通讯录更新与删除接入：

接口能力明细表：

| 能力 | 接入方式 | 调用/订阅方 | 入参或 payload | 返回或回调 | 触发时机 | 通讯录处理 | 备注 |
|---|---|---|---|---|---|---|---|
| 打开助理编辑页 | `openAssistantEditPage(params)` | 通讯录主动调用 | `partnerAccount` 必填 | 返回打开结果；不包含更新回调 | 用户在通讯录点击编辑入口 | 只负责进入编辑页，不从该接口读取更新后的名称、头像、简介 | 该接口不发起服务端请求，不承载数据回传 |
| 删除助理 | `deleteWeAgent(params)` | 通讯录主动调用 | `partnerAccount` 必填 | 成功返回 `deleteResult: "success"`；失败沿用现有错误返回 | 用户在通讯录确认删除助理 | 成功后等待或消费删除广播移除条目；失败时保留条目并展示错误提示 | 通讯录不直接调用服务端删除接口，统一走 SDK 删除链路 |
| 详情更新通知 | `agentskills.agentUpdated', func })` | 通讯录订阅 | `{ type: 'update', data: assistantDetail, extraData: { source } }`，`data` 为完整助理详情对象 | 通过 `func` 接收广播 payload | 服务端主动更新、本端 `updateWeAgent` 成功，且完整详情补拉成功 | 按 `partnerAccount` 优先、`robotId` 兜底匹配条目，刷新名称、头像、简介等详情字段 | 通讯录获取更新后数据的唯一推荐通道 |
| 删除通知 | `agentskills.agentUpdated, func })` | 通讯录订阅 | `{ type: 'delete', data: weCrew, extraData: { source } }`，本端主动删除时 `data.partnerAccount` 必填，服务端通知时 `data` 与服务端 `weCrew` 一致 | 通过 `func` 接收广播 payload | 服务端主动删除、本端 `deleteWeAgent` 成功 | 按 `partnerAccount` 移除条目；当前正在展示详情时关闭详情或展示已删除状态 | 删除广播需幂等处理，重复收到不报错 |

1. 通讯录打开编辑页时调用 `openAssistantEditPage({ partnerAccount })`，入参与 `SkillClientSdkInterfaceV2.md` 保持一致：`partnerAccount` 必填，SDK 仅使用 `partnerAccount` 作为助理标识。
2. `openAssistantEditPage` 只负责打开助理编辑页面，不再接收或注册更新回调，也不承载通讯录的数据回传职责。
3. 通讯录需要通过既有客户端事件机制订阅 `agentskills.agentUpdated`，消费 SDK 端侧详情广播通知和删除广播通知。
4. 编辑页完成更新并触发 SDK 更新成功链路后，SDK 先通过 `GET /v1/robot-partners/{partnerAccount}` 获取完整助理详情；请求成功时通过 `agentskills.agentUpdated` 下发 `{ type: 'update', data: assistantDetail, extraData: { source: 'local' } }`，请求失败时不下发更新广播。
5. 通讯录收到 `{ type: 'update', data: assistantDetail, extraData }` 后，按 `partnerAccount` 优先、`robotId` 兜底匹配本地通讯录条目，刷新对应助理的名称、头像、简介等详情字段，并可通过 `extraData.source` 判断该广播来自服务端链路还是本端链路。
6. 通讯录收到 `{ type: 'delete', data: weCrew, extraData }` 后，按 `partnerAccount` 移除对应通讯录条目；若当前正在展示该助理详情，则关闭详情或展示已删除状态，并可通过 `extraData.source` 判断该广播来自服务端链路还是本端链路。
7. 通讯录删除助理时调用 `deleteWeAgent({ partnerAccount })`，不直接绕过 SDK 调用服务端删除接口；SDK 在删除成功后处理缓存、当前助理跳转和 `agentskills.agentUpdated` 删除广播。
8. `deleteWeAgent` 调用失败时沿用现有失败处理，不更新缓存，不触发删除广播；通讯录保持原有条目并展示自身错误提示。

```mermaid
sequenceDiagram
    participant Contact as 通讯录
    participant SDK as SDK
    participant Edit as 助理编辑页
    participant Server as 服务端
    participant Cache as 本地缓存
    participant Broadcast as 客户端广播

    Contact->>SDK: openAssistantEditPage({ partnerAccount })
    SDK->>Edit: 打开助理编辑页
    Edit->>SDK: 提交助理详情更新
    SDK->>Server: GET /v1/robot-partners/{partnerAccount}
    Server-->>SDK: 返回完整助理详情
    SDK->>Broadcast: agentskills.agentUpdated(update, data=assistantDetail, source=local)
    Broadcast-->>Contact: 端侧详情广播通知
    Contact->>SDK: deleteWeAgent({ partnerAccount })
    SDK->>Server: DELETE /v4-1/we-crew
    Server-->>SDK: deleteResult = success
    SDK->>Cache: 删除目标助理缓存
    SDK->>Broadcast: agentskills.agentUpdated(delete, source=local)
    Broadcast-->>Contact: 端侧删除广播通知
```

IM 通知透传接收处理：

1. IM 模块通知广播注册方法先由外部宿主或 IM 接入层实现，SDK 内部注册方法本阶段先 TODO。
2. 外部接入层收到 IM 模块通知广播后，将服务端返回的原始载荷透传给 SDK 接收处理入口，外层结构为 `{ notify_module, notify_data }`。
3. SDK 接收处理入口不直接处理 UI 广播，也不要求 IM 模块改写服务端数据结构。
4. SDK 先判断 `notify_module` 是否为 `welink-athena`；不是该模块的通知直接忽略，不进入助理缓存处理队列。
5. `notify_data` 是 JSON 字符串；SDK 需要对该字符串做 JSON 解析，解析失败、解析后不是对象、缺少 `action` 或缺少 `weCrew` 时，记录日志并忽略。
6. 成功解析 `notify_data` 后，再根据业务 JSON 中的 `action` 分发：
   - `action = 'update'`：进入服务端主动详情更新处理；
   - `action = 'delete'`：进入服务端主动删除处理；
   - 其他 `action`：记录日志后忽略。
7. 网络从离线恢复在线后的补偿刷新本阶段不实现，相关注册幂等、重连补偿和销毁重注册策略留待 IM 接入层方案明确后再补充。

服务端主动详情更新处理：

1. SDK 从通知载荷中读取 `action`，仅当 `action = 'update'` 时进入详情更新流程。
2. SDK 从 `weCrew` 中解析助理唯一标识，优先使用 `partnerAccount`，若服务端同时提供 `robotId` 也一并保留。
3. SDK 组装 `source = 'serverPush'`、`action = 'update'` 的助理缓存处理事件，并放入助理缓存处理队列。
4. 队列处理该事件时读取本地 `we_agent_details`，检查是否已存在该助理缓存详情。
5. 若存在，则使用 `weCrew` 中的更新字段覆盖 `we_agent_details[partnerAccount]`。
6. 若 `current_we_agent_detail` 命中同一助理，则同步覆盖为最新内容。
7. 若本地 `we_agent_details` 中不存在该助理缓存详情，则不新增缓存。
8. 队列最后调用 `broadcastWeAgentEvent('agentskills.agentUpdated', updatePayload)`，其中 `updatePayload` 至少携带 `type = 'update'`、`data.partnerAccount` 和 `extraData.source = 'server'`。
9. `broadcastWeAgentEvent` 在真正对外广播前请求 `GET /v1/robot-partners/{partnerAccount}` 获取完整助理详情；请求成功且返回有效详情时，用完整助理详情对象作为 `payload.data` 对外广播。
10. 若无法从 `weCrew` 或缓存解析出 `partnerAccount`，或本次 `GET /v1/robot-partners/{partnerAccount}` 请求失败、超时、返回结构异常、未返回有效助理详情，则记录日志并结束本次更新事件处理，不触发 `agentskills.agentUpdated` 更新广播。

服务端主动删除处理：

1. SDK 从通知载荷中读取 `action`，仅当 `action = 'delete'` 时进入删除流程。
2. SDK 从 `weCrew` 中解析删除目标标识，`partnerAccount` 与 `robotId` 至少一个存在。
3. SDK 组装 `source = 'serverPush'`、`action = 'delete'` 的助理缓存处理事件，并放入助理缓存处理队列。
4. 队列处理该事件时读取本地 `we_agent_list_cache`，若存在则从列表缓存中删除对应助理并回写。
5. 队列读取本地 `we_agent_details`，若存在对应助理详情缓存，则移除对应条目并回写。
6. 该场景不读取也不修改 `current_we_agent_detail`，是否为当前助理由广播消费方自行判断。
7. 队列最后调用 `broadcastWeAgentEvent('agentskills.agentUpdated', deletePayload)`，其中 `deletePayload.data` 为通知中的 `weCrew`，`deletePayload.extraData.source = 'server'`。

冷启动补偿刷新：

1. Android 在 `SkillSDK.initialize(...)` 完成网络与缓存配置后异步触发；HarmonyOS 在首次创建 `SkillSDK` 单例并完成组件初始化后异步触发；iOS 在配置完成并刷新 HTTP 配置后异步触发。
2. 冷启动刷新不阻塞 SDK 初始化主流程，请求失败仅记录日志，不修改缓存、不触发广播。
3. 本阶段不增加 `notStarted / running / completed` 等运行状态，也不增加重复执行拦截；每次宿主冷启动进入对应 SDK 初始化入口时直接触发一次补偿刷新。
4. SDK 读取按 `userId` 隔离的 `we_agent_details` 和 `current_we_agent_detail`。
5. 从 `we_agent_details` 的 key 集合和 `current_we_agent_detail.partnerAccount` 提取账号，去空、合并、去重，得到待查询 `partnerAccount` 集合；全流程只使用 `partnerAccount`，不使用 `robotId` 匹配缓存。
6. 待查询集合为空时直接结束，不发起网络请求。
7. 将账号集合按逗号拼接为 `partnerAccounts`。
8. 批量查询复用 `getWeAgentDetails` 当前调用的同一个服务端接口 `GET /v1/robot-partners/{partnerAccount}`；服务端已支持将路径参数传为逗号拼接的 `partnerAccounts`，因此三端只需扩展现有网络方法以接收该字符串，不新增服务端接口或独立 HTTP 方法。
9. 服务端返回助理详情列表后，以 `partnerAccount` 建立映射，并逐个处理本地待查询账号。
10. 服务端返回对应完整详情时，与本地 `we_agent_details[partnerAccount]` 以及命中的 `current_we_agent_detail` 比较：
    - 无差异时不修改缓存、不广播；
    - 有差异时只覆盖本地已存在的详情缓存；命中当前助理时同步覆盖 `current_we_agent_detail`，并广播 `{ type: 'update', data: assistantDetail, extraData: { source: 'server' } }`。
11. 冷启动批量请求已经返回完整助理详情，更新广播直接使用该详情作为 `data`，不再通过 `broadcastWeAgentEvent` 重复发起单助理详情请求。
12. 服务端未返回某个待查询 `partnerAccount` 时，视为该助理已删除：从 `we_agent_details` 和 `we_agent_list_cache` 移除对应条目；若命中 `current_we_agent_detail` 则清除当前详情，并广播 `{ type: 'delete', data: { partnerAccount }, extraData: { source: 'server' } }`。
13. 批量请求失败、超时、返回结构异常时，本次冷启动补偿整体结束，不修改任何缓存、不触发广播。
14. 网络从离线恢复在线后的补偿刷新本阶段仍不实现。

本端主动调用 `updateWeAgent` 成功后的处理：

三端现有实现基线：

| 平台 | 更新缓存方法 | 关键行为 |
|---|---|---|
| Android | `WeAgentStorage.updateCachedWeAgentDetails(...)` | 更新命中的 `current_we_agent_detail` 与 `we_agent_details`，不新增详情缓存 |
| iOS | `WLAgentSkillsWeAgentStore updateCachedWeAgentDetailsWithPartnerAccount:...` | 更新命中的当前详情与详情缓存，不新增详情缓存 |
| HarmonyOS | `WeAgentStore.updateCachedDetails(...)` | 更新命中的当前详情与详情缓存，不新增详情缓存 |

1. `updateWeAgent` 入参仅支持 `partnerAccount` 作为助理标识，且 `partnerAccount` 必填；SDK 先校验 `partnerAccount`、`name`、`icon`、`description` 均为有效字符串。
2. 服务端更新接口成功后，三端组装 `source = 'localApi'`、`action = 'update'` 的助理缓存处理事件，并放入助理缓存处理队列。
3. 队列处理该事件时复用三端现有缓存更新方法：
   - Android：`updateCachedWeAgentDetails(partnerAccount, name, icon, description)`；
   - iOS：`updateCachedWeAgentDetailsWithPartnerAccount:name:icon:description:`；
   - HarmonyOS：`updateCachedDetails(partnerAccount, name, icon, description)`。
4. 若 `current_we_agent_detail` 匹配 `partnerAccount`，则仅更新当前详情中的 `name`、`icon`、`description`。
5. 若 `we_agent_details` 中命中对应缓存详情，则仅更新该缓存详情中的 `name`、`icon`、`description`。
6. 若 `we_agent_details` 中未命中对应缓存详情，则保持现有实现，不新增详情缓存。
7. 现有三端接口返回 `success` 结果，不改变原接口返回语义。
8. 本端主动调用 `updateWeAgent` 成功后必须尝试广播助理更新事件，广播点放在队列完成现有缓存更新之后；广播事件为 `agentskills.agentUpdated`，payload 结构为 `{ type: 'update', data: { partnerAccount, name, icon, description }, extraData: { source: 'local' } }`，其中 `data` 仅作为 `broadcastWeAgentEvent` 补拉完整详情前的标识和兜底上下文，不直接作为最终广播数据。
9. `broadcastWeAgentEvent` 需使用 `partnerAccount` 请求 `GET /v1/robot-partners/{partnerAccount}` 获取完整助理详情，并以完整助理详情对象作为最终广播 `data`；若本次详情请求失败，则不触发更新广播。

本端主动调用 `deleteWeAgent` 成功后的处理：

接口文档与本方案调整后的三端处理要求：

| 平台 | 删除后处理方法 | 关键行为 |
|---|---|---|
| Android | `handleDeleteWeAgentResult(...)` / `handleDeleteWeAgentSuccess(...)` | 非当前助理只更新已存在列表缓存；当前助理不计算下一个助理，也不在 `deleteWeAgent` 内部展开主助理判断，删除成功后直接调用 `getWeAgentUri` 获取跳转 URI； |
| iOS | `handleDeleteWeAgentResultWithContext:...` / `handleDeleteWeAgentSuccessWithPlan:...` | 非当前助理只更新已存在列表缓存；当前助理不计算下一个助理，也不在 `deleteWeAgent` 内部展开主助理判断，删除成功后直接调用 `getWeAgentUri` 获取跳转 URI； |
| HarmonyOS | `handleDeleteWeAgentResult(...)` / `handleDeleteCurrentWeAgentSuccess(...)` | 非当前助理只更新已存在列表缓存；当前助理不计算下一个助理，也不在 `deleteWeAgent` 内部展开主助理判断，删除成功后直接调用 `getWeAgentUri` 获取跳转 URI； |

1. `deleteWeAgent` 入参仅支持 `partnerAccount` 作为助理标识，且 `partnerAccount` 必填；SDK 校验 `partnerAccount` 为有效字符串后，仅向服务端透传 `partnerAccount`。
2. SDK 在调用删除接口前读取 `current_we_agent_detail`，判断删除目标是否命中当前助理：
   - 当前详情存在，且 `partnerAccount` 与删除目标匹配时，视为删除当前助理；
   - 否则视为删除非当前助理。
3. SDK 调用服务端删除接口 `DELETE /v4-1/we-crew`。
4. 服务端删除成功后，原接口返回 `deleteResult: "success"`，SDK 组装 `source = 'localApi'`、`action = 'delete'` 的助理缓存处理事件，并放入助理缓存处理队列；服务端失败时保持现有异常处理，透传或包装服务端错误，不触发本端删除成功广播。
5. 若删除目标不是当前助理：
   - 仅尝试更新本地 `we_agent_list_cache`；
   - 若本地存在助理列表缓存，则从缓存列表中移除当前被删除助理，并将删除后的列表回写；
   - 若本地不存在助理列表缓存，则不主动调用 `getWeAgentList`，也不做缓存处理；
   - 不触发当前助理跳转逻辑，不修改 `current_we_agent_detail`，不组装跳转 URI；
   - 若本地 `we_agent_details` 中存在当前被删除助理对应详情缓存，则删除该条详情缓存并回写。
6. 若删除目标是当前助理：
   - 删除接口请求前只判断删除目标是否命中 `current_we_agent_detail`，不计算当前助理的下一个助理；
   - 服务端删除成功后，仅尝试更新本地 `we_agent_list_cache`；
   - 若本地存在助理列表缓存，则从缓存列表中移除当前被删除助理，并将删除后的列表回写；
   - 若本地不存在助理列表缓存，则不主动调用 `getWeAgentList`，也不做列表缓存处理；
   - 删除 `current_we_agent_detail` 中的当前被删助理，避免 `getWeAgentUri` 继续读取到已删除助理；
   - 若本地 `we_agent_details` 中存在当前被删除助理对应详情缓存，则删除该条详情缓存并回写；
   - 不在 `deleteWeAgent` 内部判断删除后列表是否存在主助理，也不直接组装主助理或激活页 URI；
   - 直接调用 `SkillClientSdkInterfaceV2.md` 中的 `getWeAgentUri` 方法获取删除后的目标 URI；
   - `getWeAgentUri` 内部负责判断是否存在主助理：有主助理时返回主助理相关 URI；无主助理、主助理获取失败或 `weCodeUrl` 为空时，按接口文档约定返回激活页面 URI；
   - SDK 按 `getWeAgentUri` 返回结果执行跳转。
7. 本端主动调用 `deleteWeAgent` 成功后必须广播助理删除事件，广播点放在队列完成上述现有删除成功处理之后；广播事件为 `agentskills.agentUpdated`，payload 结构为 `{ type: 'delete', data: weCrew, extraData: { source: 'local' } }`，其中 `data` 需包含删除目标 `partnerAccount`。

`weAgentCUI` 页面消费规则：

1. 页面初始化后，通过 `HWH5EXT.registerEventListener` JSAPI 注册统一的助理变更监听。
2. `HWH5EXT.registerEventListener` 入参包含：
   - `type`：事件名；
   - `func`：监听事件响应回调。
3. 页面注册助理变更监听：
   ```typescript
   HWH5EXT.registerEventListener({
     type: 'agentskills.agentUpdated',
     func: (payload: {
       type: 'update' | 'delete';
       data: {
         robotId?: string;
         partnerAccount?: string;
         name?: string;
         icon?: string;
         description?: string;
          [key: string]: unknown;
       };
       extraData?: {
         source?: 'server' | 'local';
       };
     }) => {
       // 根据 payload.type 区分更新或删除。
     }
   });
   ```
4. SDK 侧调用 `broadcastWeAgentEvent('agentskills.agentUpdated', payload)` 后，由客户端广播机制触发 `HWH5EXT.registerEventListener` 对应 `type` 的 `func` 回调，并将对应广播 payload 原样透传给页面。
5. 当 `payload.type = 'update'` 时，`func` 仅处理当前聊天助理的更新事件；此时 `payload.data` 为完整助理详情对象。
6. 若 `payload.data.partnerAccount` 与当前页面助理一致，则使用完整助理详情更新页面中的名称、简介、头像、业务标签等信息。
7. 若更新事件不是当前页面助理，则忽略。
8. 当 `payload.type = 'delete'` 时，`func` 仅处理当前聊天助理的删除事件；此时 `payload.data` 为删除目标标识对象。
9. 若 `payload.data.partnerAccount` 与当前页面助理一致，则弹窗提示用户“助理已删除”。
10. 弹窗底部按钮固定为“切换助理”，弹窗不可取消。
11. 点击“切换助理”后跳转到切换助理页面。
12. 删除非当前助理时，页面不做 UI 变化。
13. 页面可通过 `payload.extraData.source` 区分广播来源，`server` 表示服务端通知触发，`local` 表示本端主动 API 成功触发。

`weAgentCUI` 页面消费流程图：

```mermaid
flowchart TD
    A["weAgentCUI 页面初始化"] --> B["读取当前聊天助理 partnerAccount / robotId"]
    B --> C["调用 HWH5EXT.registerEventListener 注册 agentskills.agentUpdated"]

    C --> E["等待 SDK broadcastWeAgentEvent(agentskills.agentUpdated, payload)"]

    E --> G["触发 agentskills.agentUpdated 的 func 回调"]
    G --> H{"payload.type 是否为 update"}
    H -- "是" --> I{"payload.data 是否匹配当前助理"}
    I -- "否" --> J["忽略更新事件"]
    I -- "是" --> K["刷新页面助理名称 / 简介 / 头像"]
    K --> R["结束"]
    J --> R

    H -- "否" --> L{"payload.type 是否为 delete"}
    L -- "否" --> M["忽略未知 type"]
    L -- "是" --> N{"payload.data 是否匹配当前助理"}
    N -- "否" --> O["忽略删除事件"]
    N -- "是" --> P["展示“助理已删除”弹窗"]
    P --> Q["弹窗不可取消，按钮固定为“切换助理”；点击后跳转切换助理页面"]
    Q --> R
    M --> R
    O --> R
```

### 4.3 兼容与边界

1. 服务端 IM 通知外层 `notify_module` 用于标识通知来源模块；SDK 仅处理 `notify_module = welink-athena` 的通知。
2. 服务端 IM 通知外层 `notify_data` 是 JSON 字符串；解析后的业务 JSON 中 `notifyWecodeId` 用于标识需要通知的 wecode 范围，SDK 缓存处理仍以 `weCrew.partnerAccount` 和 `weCrew.robotId` 为目标标识。
3. 更新通知中若 `we_agent_details` 不存在目标助理缓存，SDK 不新增缓存；但只要能解析出 `partnerAccount` 并成功获取完整助理详情，仍可触发更新广播。
4. 更新广播前若无法确定 `partnerAccount`，或 `GET /v1/robot-partners/{partnerAccount}` 请求失败、超时、返回结构异常、未返回有效助理详情，则不触发更新广播。
5. 删除通知中若本地缓存不存在目标助理，SDK 仍触发删除广播。
6. 服务端主动删除通知不修改 `current_we_agent_detail`，避免 SDK 在非用户主动删除场景中擅自切换当前助理。
7. 冷启动批量补偿刷新纳入本次三端 SDK 代码验收范围；网络从离线恢复在线后的补偿刷新仍不实现。
8. 冷启动批量结果未返回某个待查询 `partnerAccount` 时，视为该助理已删除，并清理对应详情、列表及命中的当前详情缓存。
9. `partnerAccount` 缺失但存在 `robotId` 时，可用 `robotId` 辅助从列表缓存或详情缓存中反查目标；若仍无法确定 `partnerAccount`，删除广播至少携带 `robotId`，更新广播不触发。
10. IM 模块通知广播注册失败、重复注册、重连和销毁重注册策略本阶段由外部接入层 TODO，不放入 SDK 内部实现范围。
11. SDK 接收处理入口应保持幂等友好：同一删除通知重复到达时缓存删除不报错；同一更新通知重复到达时按最新补拉详情结果广播。
12. IM 模块通知广播只负责透传服务端返回数据；若透传载荷缺少 `notify_module`、`notify_data`，`notify_module` 不是 `welink-athena`，或 `notify_data` 解析后缺少 `action` / `weCrew`，SDK 记录日志并忽略该通知。
13. 本阶段不做服务端回流广播去重，不做广播前最终态 diff；若本端主动操作成功后服务端又同步广播同一助理更新或删除，服务端广播仍会入队并按服务端广播规则处理。
14. 因为服务端未返回 `version` 和 `eventTime`，队列不做版本或时间戳比较，仅通过串行处理避免并发写缓存。
15. 删除后迟到的更新广播进入队列后，若本地 `we_agent_details` 已不存在对应助理缓存，则不新增缓存；若仍能成功补拉完整助理详情，则可触发更新广播，是否消费由页面按当前状态判断。
16. 历史版本兼容：对于 6 月前的历史版本，助理详情页需屏蔽编辑按钮，避免旧版本进入不支持新同步通知链路的编辑流程。
17. 专属助手详情页不显示编辑按钮，避免专属助手进入编辑流程。
18. 冷启动补偿本阶段不增加运行状态或重复执行保护；宿主应在真实冷启动初始化入口调用，若宿主重复执行初始化入口，SDK 允许再次发起补偿请求。

### 4.4 相关接口联动

1. `getWeAgentDetails`：语义不变，继续用于指定助理详情查询与缓存写入。
2. `getAssistantDetails`：语义不变，继续优先返回缓存并异步刷新。
3. `updateWeAgent`：入参仅支持必填 `partnerAccount` 定位助理，保留三端现有“只更新命中的当前详情与详情缓存，不新增详情缓存”的逻辑，成功后将 `localApi update` 事件放入助理缓存处理队列；队列处理完成后必须尝试触发 `agentskills.agentUpdated` 更新广播，payload.type 为 `update`，`extraData.source = 'local'`，最终广播 `data` 为补拉成功后的完整助理详情对象。
4. `deleteWeAgent`：入参仅支持必填 `partnerAccount` 定位助理；非当前助理只更新已存在列表缓存；当前助理删除成功后，删除列表、`current_we_agent_detail` 与详情缓存中的目标助理，然后直接调用 `getWeAgentUri` 获取跳转 URI，由 `getWeAgentUri` 内部判断是否有主助理，有主助理则返回主助理 URI，否则返回激活页面 URI；成功后将 `localApi delete` 事件放入助理缓存处理队列，队列处理完成后必须触发 `agentskills.agentUpdated` 删除广播，payload.type 为 `delete`，`extraData.source = 'local'`。该接口同时作为提供给通讯录的助理删除入口，通讯录调用成功后通过返回结果和删除广播收敛本地列表。
5. `openAssistantEditPage`：提供给通讯录或详情入口打开助理编辑页，入参以 `SkillClientSdkInterfaceV2.md` 为准，仅使用必填 `partnerAccount` 定位助理；该接口不再包含更新回调，不发起服务端请求，也不负责向通讯录回传更新后数据。
6. `notifyAssistantDetailUpdated`：按最新接口文档已删除，不再作为通讯录获取更新后数据的通道；通讯录必须订阅 `agentskills.agentUpdated` 作为端侧详情广播通知，并从 `{ type: 'update', data: assistantDetail, extraData }` 中获取更新后的完整助理详情。
7. `getWeAgentDetails` 对应的 `GET /v1/robot-partners/{partnerAccount}` 服务端接口已支持批量查询；冷启动时将多个账号按逗号拼接为 `partnerAccounts` 并作为同一路径参数传入，不新增服务端接口。
8. IM 通知接入入口：外部接入层完成 IM 模块通知广播注册后，将原始 payload 透传给 SDK；SDK 接收处理入口先校验外层 `notify_module = welink-athena`，再解析 `notify_data` 字符串中的 `action` 和 `weCrew`，组装 `serverPush update/delete` 事件并进入缓存处理与广播流程。
9. `HWH5EXT.registerEventListener`：`weAgentCUI` 页面和通讯录通过该 JSAPI 注册 `agentskills.agentUpdated`，SDK 通过 `broadcastWeAgentEvent` 触发对应回调并透传对应广播 payload。
10. 通讯录：订阅端侧详情广播通知和删除广播通知；收到更新广播时刷新匹配助理条目，收到删除广播时移除匹配助理条目并处理当前详情展示状态。
11. 助理详情页：专属助手详情页固定不展示编辑按钮；6 月前历史版本详情页也需屏蔽编辑按钮。

### 4.5 文档需要同步修改的内容

1. `SkillClientSdkInterfaceV2.md`：补充 IM 广播透传服务端返回数据、服务端 IM 通知外层 `notify_module + notify_data` 结构、`notify_data` 解析后的 `action + weCrew + notifyWecodeId` 业务结构、更新广播补拉完整详情、`extraData.source` 和广播事件约定；IM 注册方法标记为外部 TODO。
2. Android / iOS / HarmonyOS SDK 接口说明：补充服务端通知、本端更新、本端删除和冷启动补偿触发广播的时机；网络从离线恢复在线补偿刷新本阶段不纳入实现。
3. `ai-chat-viewer` 相关需求或设计文档：补充 `weAgentCUI` 页面通过 `HWH5EXT.registerEventListener` 消费 `agentskills.agentUpdated` 的处理规则。
4. 助理详情页相关文档：补充专属助手详情页不显示编辑按钮，以及 6 月前历史版本屏蔽编辑按钮的规则。
5. 通讯录接入文档：补充 `openAssistantEditPage`、`deleteWeAgent` 的调用规则，以及端侧详情广播通知、删除广播通知的订阅与消费规则。

## 5. 性能

1. 服务端主动更新通知在对外广播前会额外发起一次 `GET /v1/robot-partners/{partnerAccount}` 请求，用于获取完整助理详情作为最终广播数据。
2. 服务端主动删除通知只处理本地缓存，不额外发起删除接口或详情接口请求。
3. 冷启动新增一次批量详情补偿请求，仅在 `we_agent_details` 或 `current_we_agent_detail` 中存在有效 `partnerAccount` 时触发。
4. 批量查询复用 `getWeAgentDetails` 对应的现有服务端接口，一次请求查询全部待补偿账号，避免逐个发起详情请求。
5. 页面收到更新广播后直接使用广播中的完整助理详情刷新 UI，不需要再次调用 `getWeAgentDetails`，避免页面侧重复网络请求。
6. SDK 本阶段不新增初始化时 IM 模块通知广播注册；注册由外部接入层 TODO，SDK 只处理外部透传进来的 payload。

## 6. 功耗

1. 不新增轮询机制。
2. 不新增独立长连接，复用 SDK 已接入的长连接或推送通道。
3. 不新增后台常驻任务。
4. 冷启动补偿只在 SDK 冷启动初始化时触发一次批量请求；网络从离线恢复在线补偿刷新本阶段不实现。
5. 页面侧只在收到广播后做轻量状态更新，不引入额外动画或频繁渲染。
6. IM 通知注册由外部接入层 TODO；SDK 本阶段不额外维持新的后台连接。

## 7. 埋码

1. `we_agent_server_notify_received`
   - 说明：记录服务端主动通知接收情况，建议包含 `notify_module`、`notifyDataParseSuccess`、`action`、`partnerAccount`、`robotId`、`notifyWecodeId`、IM 模块通知广播标识。
2. `we_agent_im_notify_payload_handled`
   - 说明：记录 SDK 接收外部透传 IM payload 后的处理情况，建议包含解析结果、忽略原因、触发的 action 和广播结果。
3. `we_agent_cache_sync_result`
   - 说明：记录缓存同步结果，建议包含触发来源、更新数量、删除数量、失败原因。
4. `we_agent_broadcast_sent`
   - 说明：记录 SDK 对外广播发送情况，建议包含 `eventName`、`partnerAccount`、`robotId`、`extraData.source`、触发来源。
5. `we_agent_broadcast_detail_fetch_failed`
   - 说明：记录更新广播前补拉完整助理详情失败情况，建议包含 `partnerAccount`、触发来源、失败原因、是否已终止广播。
6. `we_agent_cui_delete_dialog_shown`
   - 说明：记录 `weAgentCUI` 因当前助理被删除而展示不可取消弹窗的情况。

## 8. 影响范围

### 8.1 直接影响

1. Android SDK、iOS SDK、HarmonyOS SDK 的助理详情更新、删除、服务端通知接收和冷启动补偿处理逻辑。
2. SDK 内部客户端广播封装与调用点。
3. `ai-chat-viewer` 的 `weAgentCUI` 页面通过 `HWH5EXT.registerEventListener` 注册事件监听后的 UI 刷新、删除弹窗逻辑。
4. 服务端下发助理更新和删除通知的数据结构。
5. 外部 IM 接入层与 SDK 接收处理入口之间的 payload 透传约定。
6. 助理详情页历史版本兼容展示逻辑：6 月前历史版本需屏蔽编辑按钮。
7. 助理详情页专属助手展示逻辑：专属助手详情页需隐藏编辑按钮。
8. 通讯录的助理编辑入口、删除入口、列表刷新和详情关闭逻辑。

### 8.2 间接影响

1. 助理列表页或切换助理页可能读取到被同步更新后的列表缓存。
2. 多端同时编辑或删除同一助理时，宿主页面对当前助理状态的感知更及时。
3. 冷启动后本地缓存可通过批量详情查询与服务端状态收敛；离线恢复在线后的缓存补偿能力本阶段不变化。
4. 通讯录在旧版本宿主未订阅广播时仍可完成接口调用，但列表与详情的实时同步能力依赖广播接入。

### 8.3 不影响

1. 不改变 `getWeAgentDetails`、`getAssistantDetails` 的既有对外入参和返回语义；`updateWeAgent`、`deleteWeAgent` 本次明确收敛为仅支持必填 `partnerAccount` 定位助理，返回语义保持不变。
2. 不恢复 `notifyAssistantDetailUpdated` 更新回调链路，通讯录继续通过 `agentskills.agentUpdated` 获取更新后数据。
3. 不新增持久化缓存 key。
4. 不改变服务端主动删除通知场景的处理边界：仍只处理本地缓存和广播，不复用本端 `deleteWeAgent` 的当前助理跳转逻辑。

## 9. 测试范围

### 9.1 功能测试

1. 服务端 IM 通知外层 `notify_module = welink-athena`，且 `notify_data` 解析后 `action = update`，本地存在目标助理详情缓存且 `GET /v1/robot-partners/{partnerAccount}` 成功时，校验 `we_agent_details`、`current_we_agent_detail` 和 `agentskills.agentUpdated` 更新广播，且广播 `data` 为完整助理详情对象、`extraData.source = 'server'`。
2. 服务端 IM 通知外层 `notify_module = welink-athena`，且 `notify_data` 解析后 `action = update`，本地不存在目标助理详情缓存但完整详情补拉成功时，校验不新增缓存但仍触发更新广播；若完整详情补拉失败，则校验不触发更新广播。
3. 服务端 IM 通知外层 `notify_module = welink-athena`，且 `notify_data` 解析后 `action = delete`，本地存在目标助理时，校验列表缓存和详情缓存被删除，并触发删除广播。
4. 服务端 IM 通知外层 `notify_module = welink-athena`，且 `notify_data` 解析后 `action = delete`，本地不存在目标助理时，校验不报错且仍触发删除广播。
5. 外部接入层调用 SDK 接收处理入口并透传 `{ notify_module: 'welink-athena', notify_data: '{...}' }` 服务端模拟通知后，校验能进入对应更新或删除流程。
6. IM 模块透传通知的 `notify_module` 不是 `welink-athena` 时，校验 SDK 忽略该通知，不进入缓存处理队列，不触发客户端广播。
7. IM 模块透传通知的 `notify_data` 为空、非 JSON 字符串、解析后缺少 `action` 或缺少 `weCrew` 时，校验 SDK 记录日志并忽略该通知。
8. 同一服务端删除通知重复透传给 SDK 时，校验缓存删除幂等，不报错，删除广播 payload 保持一致。
9. 冷启动时 `we_agent_details` 或 `current_we_agent_detail` 存在有效 `partnerAccount`，校验 SDK 合并去重后按逗号拼接 `partnerAccounts`，并复用 `getWeAgentDetails` 对应服务端接口发起一次批量查询。
10. 冷启动批量接口返回详情与本地缓存存在差异时，校验只覆盖已有 `we_agent_details` 条目；若命中 `current_we_agent_detail`，同步更新当前详情，并触发 `extraData.source = 'server'` 的更新广播。
11. 冷启动批量接口未返回某个待查询 `partnerAccount` 时，校验对应详情缓存和列表缓存被删除；若命中当前详情则同步清除，并触发删除广播。
12. 冷启动批量请求失败、超时或返回结构异常时，校验不修改任何缓存、不触发广播；网络从离线恢复在线场景不触发补偿请求。
13. 本端 `updateWeAgent({ partnerAccount, name, icon, description })` 成功后，校验仅更新命中的当前详情或详情缓存、不新增详情缓存；完整详情补拉成功时触发 `agentskills.agentUpdated` 更新广播，payload.type 为 `update`，`extraData.source = 'local'`，补拉失败时不触发更新广播；缺少 `partnerAccount` 或 `partnerAccount` 为空时校验参数错误。
14. 本端 `deleteWeAgent({ partnerAccount })` 删除非当前助理成功后，校验仅在本地已有列表缓存时更新列表缓存；若 `we_agent_details` 有对应助手详情缓存，则删除对应详情缓存；并触发 `agentskills.agentUpdated` 删除广播，payload.type 为 `delete`，`extraData.source = 'local'`；缺少 `partnerAccount` 或 `partnerAccount` 为空时校验参数错误。
15. 本端 `deleteWeAgent({ partnerAccount })` 删除当前助理成功后，校验列表缓存移除目标助理，`current_we_agent_detail` 清除被删当前助理，`we_agent_details` 中被删助手详情缓存被删除；随后 SDK 调用 `getWeAgentUri` 获取跳转 URI，由 `getWeAgentUri` 内部判断有主助理时返回主助理 URI、无主助理时返回激活页面 URI；最后触发 `agentskills.agentUpdated` 删除广播，payload.type 为 `delete`，`extraData.source = 'local'`。
16. 本端 `updateWeAgent` 成功后，服务端同步广播同一助理更新，校验两个事件按入队顺序串行处理，不发生并发写缓存。
17. 本端 `deleteWeAgent` 成功后，服务端同步广播同一助理删除，校验两个事件按入队顺序串行处理，第二次删除缓存已不存在时跳过对应缓存处理且不报错。
18. 本端 `deleteWeAgent` 成功后，若迟到的服务端 `update` 广播进入队列，且 `we_agent_details` 已不存在对应助理缓存，校验不新增缓存、不恢复已删除助理。
19. 同时触发本端主动操作和服务端广播时，校验缓存变更处理顺序一致，不发生并发写缓存。
20. `weAgentCUI` 初始化时通过 `HWH5EXT.registerEventListener({ type: 'agentskills.agentUpdated', func })` 注册统一监听，并校验更新广播可触发该 `func`。
21. `weAgentCUI` 初始化时通过 `HWH5EXT.registerEventListener({ type: 'agentskills.agentUpdated', func })` 注册统一监听，并校验删除广播可触发该 `func`。
22. 校验 `agentskills.agentUpdated` 的更新回调 payload 为 `{ type: 'update', data: assistantDetail, extraData: { source } }`，删除回调 payload 为 `{ type: 'delete', data: weCrew, extraData: { source } }`。
23. `weAgentCUI` 收到当前助理更新事件后，校验名称、简介、头像刷新。
24. `weAgentCUI` 收到非当前助理更新或删除事件后，校验页面不变化。
25. `weAgentCUI` 收到当前助理删除事件后，校验展示不可取消弹窗，且“切换助理”可跳转到切换助理页面。
26. 通讯录调用 `openAssistantEditPage({ partnerAccount })` 时，校验 SDK 仅按必填 `partnerAccount` 打开助理编辑页，且接口不再要求或注册更新回调。
27. 通讯录订阅 `agentskills.agentUpdated` 后，收到 `{ type: 'update', data: assistantDetail, extraData }` 时校验可从端侧详情广播通知中获取完整助理详情，并按 `partnerAccount` 优先、`robotId` 兜底刷新对应通讯录条目。
28. 编辑页完成助理详情更新后，校验通讯录只通过端侧详情广播通知刷新数据，不依赖 `openAssistantEditPage` 回调。
29. 通讯录调用 `deleteWeAgent` 删除助理成功后，校验 SDK 触发 `{ type: 'delete', data: weCrew, extraData }` 删除广播，通讯录移除对应条目；若当前展示该助理详情，则关闭详情或展示已删除状态。
30. 通讯录调用 `deleteWeAgent` 失败时，校验不更新 SDK 缓存、不触发删除广播，通讯录保留原条目并展示失败提示。
31. 通讯录重复收到同一助理的端侧详情广播通知时，校验以同一助理标识做幂等刷新，不产生重复条目。

### 9.2 兼容测试

1. Android、iOS、HarmonyOS 三端通知解析、缓存更新和广播事件名保持一致。
2. `notify_data` 解析后的 `weCrew` 只包含 `partnerAccount`、只包含 `robotId`、二者都包含时的处理行为。
3. `notifyWecodeId` 为空数组、缺失、包含多个 wecode id 时，SDK 不因该字段异常影响缓存处理主流程。
4. 更新广播补拉单个详情及冷启动批量详情请求失败、超时、返回空列表、返回部分详情、返回结构异常时的降级行为。
5. 旧版本宿主未订阅广播时，SDK 缓存处理不受影响。
6. IM 模块通知广播注册失败、重复注册、销毁后重新初始化、切换账号后重新注册或过滤通知的行为由外部接入层后续补充，本阶段只验证 SDK 接收处理入口。
7. 6 月前历史版本进入助理详情页时，校验编辑按钮被屏蔽；6 月及之后版本按既有规则展示编辑入口。
8. 专属助手进入详情页时，校验不显示编辑按钮。
9. 通讯录打开编辑页和删除助理均只传 `partnerAccount`；`updateWeAgent`、`deleteWeAgent` 传入缺失或空字符串 `partnerAccount` 时，三端均返回参数错误，不再支持仅传 `robotId` 或同时传 `robotId` 的调用形态。

### 9.3 文档一致性检查

1. 服务端通知示例统一为 IM 外层 `{ notify_module, notify_data }`，其中 `notify_data` 为 JSON 字符串，解析后的业务 JSON 为 `action + weCrew + notifyWecodeId`。
2. 更新与删除广播事件名统一为 `agentskills.agentUpdated`。
3. 更新广播 payload 统一为 `{ type: 'update', data: assistantDetail, extraData: { source } }`，其中 `data` 为完整助理详情对象。
4. 删除广播 payload 统一为 `{ type: 'delete', data: weCrew, extraData: { source } }`。
5. 三端 SDK 文档中的缓存 key、触发时机、边界处理规则保持一致。
6. 三端 SDK 文档中的 IM payload 接收入口、透传载荷解析和失败降级规则保持一致；注册时机与幂等策略标记为外部 TODO。
7. `weAgentCUI` 页面文档中的 `HWH5EXT.registerEventListener` 入参 `type`、`func` 与 SDK 广播保持一致：`type` 统一为 `agentskills.agentUpdated`。
8. 助理详情页文档需补充 6 月前历史版本屏蔽编辑按钮的兼容策略。
9. 助理详情页文档需补充专属助手详情页不显示编辑按钮的展示规则。
10. 通讯录接入文档中的 `openAssistantEditPage`、`deleteWeAgent`、端侧详情广播通知和删除广播通知与 `SkillClientSdkInterfaceV2.md` 保持一致。

## 10. 最终建议

推荐落地“外部 IM 接入层透传服务端返回数据 + SDK 解析服务端主动通知 + 冷启动批量补偿 + SDK 缓存处理 + 统一广播封装”主链路。冷启动批量查询复用 `getWeAgentDetails` 对应的现有服务端接口，不新增接口；本阶段不增加冷启动补偿的重复执行状态控制，也暂不实现网络从离线恢复在线后的补偿刷新。这样既能解决多端实时更新或删除同步，也能在冷启动时收敛本地缓存，同时保持三端协议和公开接口语义一致。
