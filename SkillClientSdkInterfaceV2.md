# Skill Client SDK 2.0 新增接口文档

## 文档范围

本文档仅描述相对于 `SkillClientSdkInterfaceV1.md` 的 **新增接口**。

- V1 既有接口（如 `createSession`、`sendMessage`、`getSessionMessage` 等）保持不变
- 本文档新增接口设计参考：`DigitalTwinSdkInterfaceV1.md`

---

## 新增接口总览

| SDK 接口 | 服务端接口 | 说明 |
|---|---|---|
| `createDigitalTwin` | `POST /v4-1/we-crew/im-register` | 创建数字分身 |
| `getAgentType` | `GET /v4-1/we-crew/inner-assistant/list` | 查询可用助理类型 |
| `getWeAgentList` | `GET /v4-1/we-crew/list` | 查询个人助理列表 |
| `getWeAgentDetails` | `GET /v1/robot-partners/{partnerAccount}` | 获取并按需持久化助理详情 |
| `updateWeAgent` | `PUT /v4-1/we-crew` | 更新个人助理信息 |
| `deleteWeAgent` | `DELETE /v4-1/we-crew` | 删除个人助理 |
| `openAssistantEditPage` | 无（SDK 本地扩展能力） | 打开助理编辑页面 |
| `notifyAssistantDetailUpdated` | 无（SDK 本地扩展能力） | 通知助理详情已更新 |
| `getWeAgentUri` | 无（SDK 本地扩展能力） | 获取当前助理相关页面 URI |

> 说明：新增接口遵循 Skill SDK 文档约定，SDK 对外不透出服务端通用状态包装字段（`code`/`error`），并按接口语义返回业务字段（如 `message`、`content`）。

---

## 持久化存储约定

1. SDK 需要通过 SP 持久化存储“当前助理详情”（`WeAgentDetails`）。
2. 持久化数据必须按用户隔离：SP 文件名或路径中必须包含 `userId`。
3. 当前阶段 `userId` 先使用 mock 值：`mock_user_id`。
4. SP 文件路径示例：`/data/data/{packageName}/shared_prefs/skill_sdk_we_agent_{userId}.xml`。
5. 建议存储 key：
   - `current_we_agent_detail`：当前助理详情（`WeAgentDetails`）
   - `we_agent_list_cache`：个人助理列表缓存（`WeAgentList`）
6. SP 持久化文档路径：待填写。

---

## 1. 创建分身接口

### 调用方

Skill 小程序调用

### 接口说明

根据分身名称、头像、简介等信息创建一个新的数字分身。

### 接口名

```typescript
createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 分身名称 |
| `icon` | `string` | 是 | 分身头像地址 |
| `description` | `string` | 是 | 分身简介 |
| `weCrewType` | `number` | 是 | 分身类型：`1` 内部分身，`0` 自定义分身 |
| `bizRobotId` | `string` | 否 | 内部助手业务机器人 ID（`weCrewType=1` 时建议传入） |

### 入参示例

```json
{
  "name": "分身小白",
  "icon": "/mcloud/xxx",
  "description": "数字分身小白能做...",
  "weCrewType": 1,
  "bizRobotId": "员工助手"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `robotId` | `string` | 分身机器人 ID |
| `partnerAccount` | `string` | 分身的 partnerAccount |
| `message` | `string` | 消息，接口正常是 `success` |

### 出参示例

```json
{
  "robotId": "860306",
  "partnerAccount": "x00123456",
  "message": "success"
}
```

### 实现方法

1. 调用服务端 REST API：`POST /v4-1/we-crew/im-register`
2. SDK 解析返回 `data.robotId`、`data.partnerAccount`
3. SDK 统一返回 `CreateResult`

### 错误码（参考）

| HttpCode | code | error |
|---|---|---|
| `429` | `587013` | 请求太频繁 |
| `500` | `587014` | 创建数字分身失败 |
| `500` | `587015` | 创建数字分身达到上限 |
| `400` | `587016` | 没有数字分身权限 |

---

## 2. 获取助理类型接口

### 调用方

Skill 小程序调用

### 接口说明

获取分身创建时支持的内置助理类型列表。

### 接口名

```typescript
getAgentType(): Promise<AgentTypeList>
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `content` | `Array<AgentType>` | 支持的 agent 类型列表 |

### 出参示例

```json
{
  "content": [
    {
      "name": "员工助手",
      "icon": "http://www.test.com/xxx",
      "bizRobotId": "8041241"
    },
    {
      "name": "小微助手",
      "icon": "http://www.test.com/aaa",
      "bizRobotId": "8041242"
    }
  ]
}
```

### 实现方法

1. 调用服务端 REST API：`GET /v4-1/we-crew/inner-assistant/list`
2. SDK 解析返回 `data[]`
3. SDK 返回 `AgentTypeList`

---

## 3. 查询个人助理列表接口

### 调用方

Skill 小程序调用

### 接口说明

分页查询当前用户创建的个人助理列表。

### 接口名

```typescript
getWeAgentList(params: PageParams): Promise<WeAgentList>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pageSize` | `number` | 是 | 分页大小，最小 `1`，最大 `100` |
| `pageNumber` | `number` | 是 | 页码，最小 `1`，最大 `1000` |

### 入参示例

```json
{
  "pageSize": 10,
  "pageNumber": 1
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `content` | `Array<WeAgent>` | 用户创建的 WeAgent 列表 |

### 出参示例

```json
{
  "content": [
    {
      "name": "员工助手",
      "icon": "http://www.test.com/xxx",
      "description": "我是xxx",
      "partnerAccount": "x00_1",
      "bizRobotName": "员工助手",
      "bizRobotNameEn": "yuangongzhushou",
      "robotId": "78985451212"
    }
  ]
}
```

### 实现方法

1. SDK 调用服务端 REST API：`GET /v4-1/we-crew/list`，透传查询参数 `pageSize`、`pageNumber`。
2. SDK 解析返回 `data[]` 并组装为 `WeAgentList`。
3. SDK 可按 `userId`（当前 mock 值：`mock_user_id`）维度更新本地 `we_agent_list_cache` 缓存，供后续读取优化。
4. SDK 返回 `Promise<WeAgentList>`。

---

## 4. 获取助理详情接口

### 调用方

Skill 小程序调用

### 接口说明

根据 `partnerAccount` 获取指定助理的详细信息。

调用成功后，SDK 可按需将助理详情写入 SP 持久化存储。

### 接口名

```typescript
getWeAgentDetails(params: QueryWeAgentParams): Promise<WeAgentDetailsArray>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 助理账号 ID |

### 入参示例

```json
{
  "partnerAccount": "x00_1"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `weAgentDetailsArray` | `Array<WeAgentDetails>` | 助理详情数组 |

`WeAgentDetails` 对象新增字段：`id`（字符串）、`bizRobotName`（字符串）、`bizRobotNameEn`（字符串）、`ownerWelinkId`（责任人的 id，字符串）、`creatorWorkId`（创建者的工号，字符串）、`bizRobotTag`（大脑机器人 tag，字符串）、`ownerW3Account`（大脑机器人责任人的账号，字符串）、`creatorW3Account`（创建者的账号，字符串）；移除 `robotId` 字段。

### 出参示例

```json
{
  "weAgentDetailsArray": [
    {
      "name": "员工助手",
      "icon": "http://www.test.com/xxx",
      "desc": "我是xxx",
      "moduleId": "M1000",
      "partnerAccount": "x00_1",
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
      "id": "78985451212",
      "bizRobotName": "员工助手",
      "bizRobotNameEn": "employee_assistant",
      "bizRobotTag": "",
      "bizRobotId": "",
      "weCodeUrl": "https://xxx"
    }
  ]
}
```

### 实现方法

1. 调用服务端 REST API：`GET /v1/robot-partners/{partnerAccount}`。
2. SDK 解析返回 `data[]` 并组装为 `weAgentDetailsArray`。
3. SDK 将对应详情写入 `current_we_agent_detail`（按 `userId` 隔离，`userId` 当前使用 mock 值：`mock_user_id`），用于 `getWeAgentUri`。
4. SDK 返回 `Promise<weAgentDetailsArray>`。

---

## 5. 更新个人助理接口

### 调用方

Skill 小程序调用

### 接口说明

更新当前用户已创建的个人助理信息。

### 接口名

```typescript
updateWeAgent(params: UpdateWeAgentParams): Promise<UpdateWeAgentResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 助理账号 ID |
| `robotId` | `string` | 否 | 助理机器人 ID，`partnerAccount` 与 `robotId` 二选一，优先使用 `partnerAccount` |
| `name` | `string` | 是 | 助理名称 |
| `icon` | `string` | 是 | 助理头像地址 |
| `description` | `string` | 是 | 助理简介 |

### 入参示例

```json
{
  "partnerAccount": "dig_001",
  "name": "更新名称",
  "icon": "/mocloud/xxx",
  "description": "更新简介"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `updateResult` | `string` | 助理信息更新结果，成功时为 `success` |

### 出参示例

```json
{
  "updateResult": "success"
}
```

### 实现方法

1. 调用服务端 REST API：`PUT /v4-1/we-crew`。
2. SDK 按原样透传 `partnerAccount`、`robotId`、`name`、`icon`、`description`。
3. SDK 从服务端响应中提取 `message`，并映射返回为 `updateResult`。

---

## 6. 删除个人助理接口

### 调用方

Skill 小程序调用

### 接口说明

删除当前用户已创建的个人助理。

### 接口名

```typescript
deleteWeAgent(params: DeleteWeAgentParams): Promise<DeleteWeAgentResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 助理账号 ID |
| `robotId` | `string` | 否 | 助理机器人 ID，`partnerAccount` 与 `robotId` 二选一，优先使用 `partnerAccount` |

### 入参示例

```json
{
  "partnerAccount": "dig_001"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `deleteResult` | `string` | 助理删除结果，成功时为 `success` |

### 出参示例

```json
{
  "deleteResult": "success"
}
```

### 实现方法

1. 调用服务端 REST API：`DELETE /v4-1/we-crew`。
2. SDK 透传删除标识参数：
   - `partnerAccount`：优先使用；
   - `robotId`：当调用方未传 `partnerAccount` 时可作为补充删除标识。
3. SDK 从服务端响应中提取 `message`，并映射返回为 `deleteResult`。

---

## 7. 打开助理编辑页面接口

### 调用方

Skill 小程序调用

### 接口说明

打开助理编辑页面，并注册详情更新回调。
该接口为 SDK 本地扩展接口，无对应服务端接口。

### 接口名

```typescript
openAssistantEditPage(params: OpenAssistantEditPageParams): Promise<OpenAssistantEditPageResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 助理账号 ID |
| `robotId` | `string` | 是 | 助理机器人 ID |
| `onUpdated` | `function` | 是 | 监听详情更新回调，回调出参为 `AssistantDetailUpdatedPayload` |

### 入参示例

```typescript
{
  partnerAccount: 'x00_1',
  robotId: '78985451212',
  onUpdated: (payload) => {
    console.log(payload.name, payload.icon, payload.description)
  }
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `status` | `string` | 固定返回 `success` |

### 出参示例

```json
{
  "status": "success"
}
```

### 实现方法

1. SDK 接收 `partnerAccount`、`robotId` 与 `onUpdated` 回调，并在本地注册该回调。
2. SDK 将 `partnerAccount` 和 `robotId` 作为 query 项拼接到 `h5://S008623/index.html?partnerAccount={partnerAccount}&robotId={robotId}#editAssistant`。
3. 拼接完成后的 uri 地址当前先记为 `todo`，待后续页面地址方案确认后补齐。
4. SDK 拉起助理编辑页面。
5. SDK 返回 `OpenAssistantEditPageResult`，其中 `status` 固定为 `success`。

---

## 8. 通知助理详情更新接口

### 调用方

助理编辑页面调用

### 接口说明

通知 SDK 当前助理详情已更新，并触发 `openAssistantEditPage` 注册的 `onUpdated` 回调。
该接口为 SDK 本地扩展接口，无对应服务端接口。

### 接口名

```typescript
notifyAssistantDetailUpdated(params: NotifyAssistantDetailUpdatedParams): Promise<NotifyAssistantDetailUpdatedResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 助理名称 |
| `icon` | `string` | 是 | 助理头像地址 |
| `description` | `string` | 是 | 助理简介 |
| `partnerAccount` | `string` | 是 | 助理账号 ID |
| `robotId` | `string` | 是 | 助理机器人 ID |

### 入参示例

```json
{
  "name": "更新名称",
  "icon": "/mocloud/xxx",
  "description": "更新简介",
  "partnerAccount": "x00_1",
  "robotId": "78985451212"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `status` | `string` | 固定返回 `success` |

### 出参示例

```json
{
  "status": "success"
}
```

### 实现方法

1. SDK 接收 `name`、`icon`、`description`、`partnerAccount`、`robotId`。
2. SDK 根据 `partnerAccount` 与 `robotId` 定位 `openAssistantEditPage` 已注册的回调监听。
3. SDK 触发对应的 `onUpdated` 回调，并将以下对象作为回调参数传出：
   - `name`
   - `icon`
   - `description`
4. SDK 返回 `NotifyAssistantDetailUpdatedResult`，其中 `status` 固定为 `success`。

---

## 9. 获取当前 WeAgentUri 接口

### 调用方

Skill 小程序调用

### 接口说明

读取持久化的当前助理详情，组装并返回当前助理相关页面 URI。
该接口为 SDK 本地扩展接口，`DigitalTwinSdkInterfaceV1.md` 无对应服务端接口。

### 接口名

```typescript
getWeAgentUri(): WeAgentUriResult
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `weAgentUri` | `string` | 当前助理 CUI 地址：若可读取到持久化助理详情，且解析 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 不一致，则按 `weCodeUrl` 追加 query `wecodePlace=weAgent` 与 `robotId={id}`（`id` 来自助理详情）；若可读取到持久化助理详情，且解析 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 一致，则按 `weCodeUrl` 追加 query `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`；若读取不到持久化助理详情，则返回 `h5://S008623/index.html` 并追加 query `wecodePlace=weAgent` 与 hash `activateAssistant` |
| `assistantDetailUri` | `string` | 助理详情地址：`h5://S008623/index.html` 并追加 `partnerAccount` query 与 hash `assistantDetail`；若读取不到持久化助理详情则返回空字符串 |
| `switchAssistantUri` | `string` | 切换助理地址：`h5://S008623/index.html` 并追加 `partnerAccount` query 与 hash `switchAssistant`；若读取不到持久化助理详情则返回空字符串 |

### 出参示例

```json
{
  "weAgentUri": "h5://S008623/index.html?wecodePlace=weAgent#activateAssistant",
  "assistantDetailUri": "h5://S008623/index.html?partnerAccount=x00_1#assistantDetail",
  "switchAssistantUri": "h5://S008623/index.html?partnerAccount=x00_1#switchAssistant"
}
```

### 实现方法

1. 从 SP 持久化存储中读取当前助理详情（按 `userId` 隔离，`userId` 当前使用 mock 值：`mock_user_id`）。
2. 若读取不到持久化助理详情，`weAgentUri` 固定返回：`h5://S008623/index.html?wecodePlace=weAgent#activateAssistant`，`assistantDetailUri` 与 `switchAssistantUri` 返回空字符串。
3. 若读取到持久化助理详情，读取其中的 `weCodeUrl`、`partnerAccount`、`id`，解析 `weCodeUrl` 的 host，并按以下规则组装 `weAgentUri`：
   - 若 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 不一致：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent` 与 `robotId={id}`；
   - 若 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 一致：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`。
4. 组装 `assistantDetailUri`：`h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `assistantDetail`。
5. 组装 `switchAssistantUri`：`h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `switchAssistant`。
6. 返回 `WeAgentUriResult`。

---

## 数据类型定义

### CreateDigitalTwinParams

```typescript
type CreateDigitalTwinParams = {
  name: string
  icon: string
  description: string
  weCrewType: number
  bizRobotId?: string
}
```

### CreateResult

```typescript
type CreateResult = {
  robotId: string
  partnerAccount: string
  message: string
}
```

### AgentType

```typescript
type AgentType = {
  name: string
  icon: string
  bizRobotId: string
}
```

### AgentTypeList

```typescript
type AgentTypeList = {
  content: AgentType[]
}
```

### PageParams

```typescript
type PageParams = {
  pageSize: number
  pageNumber: number
}
```

### QueryWeAgentParams

```typescript
type QueryWeAgentParams = {
  partnerAccount: string
}
```

### UpdateWeAgentParams

```typescript
type UpdateWeAgentParams = {
  partnerAccount: string
  robotId?: string
  name: string
  icon: string
  description: string
}
```

### UpdateWeAgentResult

```typescript
type UpdateWeAgentResult = {
  updateResult: string
}
```

### DeleteWeAgentParams

```typescript
type DeleteWeAgentParams = {
  partnerAccount: string
  robotId?: string
}
```

### DeleteWeAgentResult

```typescript
type DeleteWeAgentResult = {
  deleteResult: string
}
```

### AssistantDetailUpdatedPayload

```typescript
type AssistantDetailUpdatedPayload = {
  name: string
  icon: string
  description: string
}
```

### OpenAssistantEditPageParams

```typescript
type OpenAssistantEditPageParams = {
  partnerAccount: string
  robotId: string
  onUpdated: (payload: AssistantDetailUpdatedPayload) => void
}
```

### OpenAssistantEditPageResult

```typescript
type OpenAssistantEditPageResult = {
  status: string
}
```

### NotifyAssistantDetailUpdatedParams

```typescript
type NotifyAssistantDetailUpdatedParams = {
  name: string
  icon: string
  description: string
  partnerAccount: string
  robotId: string
}
```

### NotifyAssistantDetailUpdatedResult

```typescript
type NotifyAssistantDetailUpdatedResult = {
  status: string
}
```

### WeAgent

```typescript
type WeAgent = {
  name: string
  icon: string
  description: string
  partnerAccount: string
  bizRobotName: string
  bizRobotNameEn: string
  robotId: string
}
```

### WeAgentList

```typescript
type WeAgentList = {
  content: WeAgent[]
}
```

### WeAgentDetails

```typescript
type WeAgentDetails = {
  name: string
  icon: string
  desc: string
  moduleId: string
  appKey: string
  appSecret: string
  partnerAccount: string
  createdBy: string
  creatorWorkId: string
  creatorW3Account: string
  creatorName: string
  creatorNameEn: string
  ownerWelinkId: string
  ownerW3Account: string
  ownerName: string
  ownerNameEn: string
  ownerDeptName: string
  ownerDeptNameEn: string
  id: string
  bizRobotName: string
  bizRobotNameEn: string
  bizRobotTag: string
  bizRobotId: string
  weCodeUrl: string
}
```

### WeAgentDetailsArray

```typescript
type WeAgentDetailsArray = {
  weAgentDetailsArray: WeAgentDetails[]
}
```

### WeAgentUriResult

```typescript
type WeAgentUriResult = {
  weAgentUri: string
  assistantDetailUri: string
  switchAssistantUri: string
}
```
