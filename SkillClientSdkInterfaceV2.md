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
| `getWeAgentDetails` | `GET /v1/robot-partners/{partnerAccount}` | 获取并持久化助理详情 |
| `getWeAgentUri` | 无（SDK 本地能力） | 获取当前助理相关页面 URI |

> 说明：新增接口遵循 Skill SDK 文档约定，SDK 对外返回业务对象，不透出服务端外层包装字段（`code`/`message`/`error`）。

---

## 持久化存储约定

1. SDK 需要通过 SP 持久化存储“当前助理详情”（`WeAgentDetails`）。
2. 持久化数据必须按用户隔离：SP 文件名或路径中必须包含 `userId`。
3. 当前阶段 `userId` 先使用 mock 值：`mock_user_id`。
4. SP 文件路径示例：`/data/data/{packageName}/shared_prefs/skill_sdk_we_agent_{userId}.xml`。
5. 建议存储 key：
   - `current_we_agent_detail`：当前助理详情（`WeAgentDetails`）
   - `we_agent_list_cache`：个人助理列表缓存（`WeAgent[]`）
6. SP 持久化文档路径：待填写。

---

## 1. 创建分身接口

### 调用方

Skill 小程序调用

### 接口说明

根据分身名称、头像、简介等信息创建一个新的数字分身。

### 接口名

```typescript
createDigitalTwin(params: CreateDigitalTwinParams): Promise<CreateDigitalTwinResult>
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
| `status` | `string` | 固定返回 `success` |

### 出参示例

```json
{
  "robotId": "860306",
  "partnerAccount": "x00123456",
  "status": "success"
}
```

### 实现方法

1. 调用服务端 REST API：`POST /v4-1/we-crew/im-register`
2. SDK 解析返回 `data.robotId`、`data.partnerAccount`
3. SDK 统一返回 `CreateDigitalTwinResult`

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
getAgentType(): Promise<AgentType[]>
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `name` | `string` | 助理名称 |
| `icon` | `string` | 助理图标 |
| `bizRobotId` | `string` | 助理对应业务机器人 ID |

### 出参示例

```json
[
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
```

### 实现方法

1. 调用服务端 REST API：`GET /v4-1/we-crew/inner-assistant/list`
2. SDK 解析返回 `data[]`
3. SDK 返回 `AgentType[]`

---

## 3. 查询个人助理列表接口

### 调用方

Skill 小程序调用

### 接口说明

分页查询当前用户创建的个人助理列表。

该接口为**同步接口**：调用时同步返回本地缓存中的个人助理列表，同时异步触发服务端刷新缓存。

### 接口名

```typescript
getWeAgentList(params: PageParams): WeAgent[]
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
| `name` | `string` | 助理名称 |
| `icon` | `string` | 助理图标 |
| `description` | `string` | 助理简介 |
| `partnerAccount` | `string` | 助理账号 ID |
| `bizRobotName` | `string` | 助理对应业务机器人名称（中文） |
| `bizRobotNameEn` | `string` | 助理对应业务机器人名称（英文） |

### 出参示例

```json
[
  {
    "name": "员工助手",
    "icon": "http://www.test.com/xxx",
    "description": "我是xxx",
    "partnerAccount": "x00_1",
    "bizRobotName": "员工助手",
    "bizRobotNameEn": "yuangongzhushou"
  }
]
```

### 实现方法

1. SDK 从本地 **SP 持久化缓存**中读取个人助理列表，并**同步返回**缓存结果（无缓存时返回空数组）。
2. 本地缓存读取不按分页参数读取（不区分 `pageSize`、`pageNumber` 的缓存分片）；如需分页展示，可在内存中对缓存结果做分页切片。
3. SDK 在后台异步调用服务端 REST API：`GET /v4-1/we-crew/list`，透传分页查询参数：`pageSize`、`pageNumber`。
4. 服务端返回后，SDK 解析 `data[]` 并更新 SP 持久化缓存。
5. 本次接口调用不等待网络请求完成；刷新后的缓存供后续 `getWeAgentList` 调用读取。
6. 读取和写入缓存时需按 `userId` 做隔离（`userId` 当前使用 mock 值：`mock_user_id`）。

---

## 4. 获取助理详情接口

### 调用方

Skill 小程序调用

### 接口说明

根据 `partnerAccount` 获取指定助理的详细信息。

调用成功后，SDK 需将助理详情写入 SP 持久化存储（当前助理详情）。

### 接口名

```typescript
getWeAgentDetails(params: QueryWeAgentParams): Promise<WeAgentDetails>
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
| `name` | `string` | 助理名称 |
| `icon` | `string` | 助理图标 |
| `desc` | `string` | 助理简介 |
| `moduleId` | `string` | 助理对应模块 ID |
| `appKey` | `string` | 助理 AK |
| `appSecret` | `string` | 助理 SK |
| `partnerAccount` | `string` | 助理账号 ID |
| `createdBy` | `string` | 创建者 weLinkId |
| `creatorName` | `string` | 创建者名称 |
| `creatorNameEn` | `string` | 创建者英文名称 |
| `ownerWelinkId` | `string` | 责任人 weLinkId |
| `ownerName` | `string` | 责任人名称 |
| `ownerNameEn` | `string` | 责任人英文名称 |
| `ownerDeptName` | `string` | 责任部门中文名 |
| `ownerDeptNameEn` | `string` | 责任部门英文名 |
| `bizRobotId` | `string` | 助理对应业务机器人 ID |
| `weCodeUrl` | `string` | 助理 We 码地址 |

### 出参示例

```json
{
  "name": "员工助手",
  "icon": "http://www.test.com/xxx",
  "desc": "我是xxx",
  "moduleId": "M1000",
  "partnerAccount": "x00_1",
  "appKey": "",
  "appSecret": "",
  "createdBy": "",
  "creatorName": "",
  "creatorNameEn": "",
  "ownerWelinkId": "",
  "ownerName": "",
  "ownerNameEn": "",
  "ownerDeptName": "",
  "ownerDeptNameEn": "",
  "bizRobotId": "",
  "weCodeUrl": "https://xxx"
}
```

### 实现方法

1. 调用服务端 REST API：`GET /v1/robot-partners/{partnerAccount}`
2. SDK 解析返回 `data`
3. 将助理详情写入 SP 持久化存储的 `current_we_agent_detail`（按 `userId` 隔离，`userId` 当前使用 mock 值：`mock_user_id`）
4. SDK 返回 `WeAgentDetails`

---

## 5. 获取当前 WeAgentUri 接口

### 调用方

Skill 小程序调用

### 接口说明

读取持久化的当前助理详情，组装并返回当前助理相关页面 URI。

### 接口名

```typescript
getWeAgentUri(): WeAgentUriResult
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `weAgentUri` | `string` | 当前助理 CUI 地址（由 `weCodeUrl` 添加 `wecodePlace=weAgent` query 生成） |
| `assistantDetailUri` | `string` | 助理详情地址（`h5://123456/html/index.html` 并追加 `partnerAccount` query） |
| `switchAssistantUri` | `string` | 切换助理地址（`h5://123456/html/index.html` 并追加 `partnerAccount` query） |

### 出参示例

```json
{
  "weAgentUri": "h5://123456/html/index.html?wecodePlace=weAgent",
  "assistantDetailUri": "h5://123456/html/index.html?partnerAccount=x00_1",
  "switchAssistantUri": "h5://123456/html/index.html?partnerAccount=x00_1"
}
```

### 实现方法

1. 从 SP 持久化存储中读取当前助理详情（按 `userId` 隔离，`userId` 当前使用 mock 值：`mock_user_id`）。
2. 读取助理详情中的 `weCodeUrl` 与 `partnerAccount`。
3. 组装 `weAgentUri`：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent`（若原地址已有 query，则使用 `&` 拼接）。
4. 组装 `assistantDetailUri`：`h5://123456/html/index.html` + query 参数 `partnerAccount={partnerAccount}`。
5. 组装 `switchAssistantUri`：`h5://123456/html/index.html` + query 参数 `partnerAccount={partnerAccount}`。
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

### CreateDigitalTwinResult

```typescript
type CreateDigitalTwinResult = {
  robotId: string
  partnerAccount: string
  status: 'success'
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

### WeAgent

```typescript
type WeAgent = {
  name: string
  icon: string
  description: string
  partnerAccount: string
  bizRobotName: string
  bizRobotNameEn: string
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
  creatorName: string
  creatorNameEn: string
  ownerWelinkId: string
  ownerName: string
  ownerNameEn: string
  ownerDeptName: string
  ownerDeptNameEn: string
  bizRobotId: string
  weCodeUrl: string
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
