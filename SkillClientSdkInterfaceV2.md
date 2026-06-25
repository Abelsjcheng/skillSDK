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
| `getAssistantDetails` | `GET /v1/robot-partners/{partnerAccount}` | 优先返回缓存助理详情，并异步刷新缓存 |
| `getWeAgentInfo` | 无（SDK 本地扩展能力） | 读取并返回当前助理完整详情，助理标签中英文名称按规则兜底 |
| `updateWeAgent` | `PUT /v4-1/we-crew` | 更新个人助理信息 |
| `deleteWeAgent` | `DELETE /v4-1/we-crew` | 删除个人助理 |
| `setIsShowWeAgent` | 无（SDK 本地扩展能力） | 设置是否展示助理 tab 的持久化缓存并同步基座展示态 |
| `getIsShowWeAgent` | 无（SDK 本地扩展能力） | 获取是否展示助理 tab 的持久化缓存值 |
| `openWeAgent` | 无（SDK 本地扩展能力；未传 `partnerAccount` 时复用 `getWeAgentUri`） | 打开助理 |
| `openAssistantEditPage` | 无（SDK 本地扩展能力） | 打开助理编辑页面 |
| `queryQrcodeInfo` | `GET /v4-1/we-crew/im-register/qrcode/{qrcode}` | 查询二维码信息 |
| `updateQrcodeInfo` | `PUT /v4-1/we-crew/im-register/qrcode` | 更新二维码信息 |
| `queryAssistantGraySingle` | `GET /v4-1/robot-partners/im-chat/gray-single?welinkId={partnerAccount}` | 查询助理单人灰度标记 |
| `getMyAgentDetail` | `GET /v4-1/we-crew/my-agent` | 获取主助理详情 |
| `getWeAgentUri` | 无（SDK 本地扩展能力） | 获取当前助理相关页面 URI |

> 说明：新增接口遵循 Skill SDK 文档约定，SDK 对外不透出服务端通用状态包装字段（`code`），并按接口语义返回业务字段（如 `message`、`content`）。

---

## 服务端通用响应包装

助理相关的服务端接口统一遵循以下通用响应包装：

```typescript
type ServerResponse<T> = {
  code: string
  message: string
  data: T
}
```

字段说明如下：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `code` | `string` | 通用状态码，`200` 表示成功，其他表示失败 |
| `message` | `string` | 通用响应消息 |
| `data` | `any` | 业务数据，具体类型由各接口定义 |

除特别说明的 SDK 本地扩展接口外，本文档中的助理相关服务端接口均默认遵循上述响应包装；SDK 对外不透出该包装，而是按各接口语义返回业务字段。

---

## 持久化存储约定

1. SDK 需要通过 SP 持久化存储“当前助理详情”（`WeAgentDetails`）。
2. 持久化数据必须按用户隔离：SP 文件名或路径中必须包含 `userId`。
3. 当前阶段 `userId` 先使用 mock 值：`mock_user_id`。
4. SP 文件路径示例：`/data/data/{packageName}/shared_prefs/skill_sdk_we_agent_{userId}.xml`。
5. 建议存储 key：
   - `current_we_agent_detail`：当前助理详情（`WeAgentDetails`）
   - `we_agent_list_cache`：个人助理列表缓存（`WeAgentList`）
   - `we_agent_details`：助理详情缓存对象，key 为 `partnerAccount`，value 为对应助理详情对象（`WeAgentDetails`）
   - `isShowWeAgent`：是否展示助理 tab，布尔值；该值通过基座 `saveSettings` / `getSettings` 维护
   - `assistant_gray_single_cache`：助理单人灰度缓存对象，key 为 `partnerAccount`，value 为对应灰度布尔值
6. SP 持久化文档路径：待填写。

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
| `weCrewType` | `number` | 否 | 分身类型：`1` 内部分身，`0` 自定义分身 |
| `bizRobotId` | `string` | 否 | 内部助手业务机器人 ID（`weCrewType=1` 时建议传入） |
| `qrcode` | `string` | 否 | 二维码编码 |

### 入参示例

```json
{
  "name": "分身小白",
  "icon": "/mcloud/xxx",
  "description": "数字分身小白能做...",
  "weCrewType": 1,
  "bizRobotId": "员工助手",
  "qrcode": "qr_001"
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
2. SDK 透传入参 `name`、`icon`、`description`、`weCrewType`、`bizRobotId`、`qrcode`
3. SDK 解析返回 `data.robotId`、`data.partnerAccount`
4. SDK 统一返回 `CreateResult`

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

`GET /v4-1/we-crew/list` 服务端返回的每个 `data[]` 列表项新增：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `tagName` | `string` | 助理标签中文名称 |
| `tagNameEn` | `string` | 助理标签英文名称 |

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
      "bizRobotTag": "main-agent",
      "tagName": "助手",
      "tagNameEn": "Agent",
      "robotId": "78985451212"
    }
  ]
}
```

### 实现方法

1. SDK 调用服务端 REST API：`GET /v4-1/we-crew/list`，透传查询参数 `pageSize`、`pageNumber`。
2. SDK 解析返回 `data[]` 并组装为 `WeAgentList`，其中服务端字段 `data[].bizRobotTag`、`data[].tagName`、`data[].tagNameEn` 需同步透传到 SDK 出参对应字段。
   - `tagName`：助理标签中文名称。
   - `tagNameEn`：助理标签英文名称。
3. SDK 可按 `userId`（当前 mock 值：`mock_user_id`）维度更新本地 `we_agent_list_cache` 缓存，供后续读取优化。
4. SDK 返回 `Promise<WeAgentList>`。

---

## 4. 获取助理详情接口

### 调用方

Skill 小程序调用

### 接口说明

根据 `partnerAccount` 获取指定助理的详细信息。

调用成功后，SDK 可按需将助理详情写入 SP 持久化存储。

移动端 `partnerAccount` 入参为非必填：

- 传入 `partnerAccount` 时，沿用原有服务端接口 `GET /v1/robot-partners/{partnerAccount}` 获取详情；
- 未传 `partnerAccount` 时，SDK 改为调用服务端接口 `GET /v4-1/we-crew/my-agent` 获取当前主助理详情。

### 接口名

```typescript
getWeAgentDetails(params: QueryWeAgentParams): Promise<WeAgentDetailsArray>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 否（移动端） | 助理账号 ID；移动端未传时，SDK 调用 `GET /v4-1/we-crew/my-agent` 获取当前主助理详情 |

### 入参示例

```json
{
  "partnerAccount": "x00_1"
}
```

### 入参示例（移动端未传 `partnerAccount`）

```json
{}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `weAgentDetailsArray` | `Array<WeAgentDetails>` | 助理详情数组 |

`WeAgentDetails` 对象新增字段：`id`（字符串）、`bizRobotName`（字符串）、`bizRobotNameEn`（字符串）、`ownerWelinkId`（责任人的 id，字符串）、`creatorWorkId`（创建者的工号，字符串）、`bizRobotTag`（大脑机器人 tag，字符串）、`ownerW3Account`（大脑机器人责任人的账号，字符串）、`creatorW3Account`（创建者的账号，字符串）、`tagName`（助理标签中文名称，字符串）、`tagNameEn`（助理标签英文名称，字符串）；移除 `robotId` 字段。

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
      "tagName": "助手",
      "tagNameEn": "Agent",
      "weCodeUrl": "https://xxx"
    }
  ]
}
```

### 实现方法

1. 当传入 `partnerAccount` 时，调用服务端 REST API：`GET /v1/robot-partners/{partnerAccount}`；服务端返回的 `data[]` 详情对象新增 `tagName`（助理标签中文名称）、`tagNameEn`（助理标签英文名称），SDK 原样透传到 `WeAgentDetails`。
2. 当移动端未传 `partnerAccount` 时，调用服务端 REST API：`GET /v4-1/we-crew/my-agent`；该接口无入参，服务端返回通用包装结构 `code`、`message`、`data`，其中 `data` 为对象，包含：`partnerAccount`、`name`、`icon`、`description`、`bizRobotId`、`bizRobotName`、`bizRobotNameEn`、`bizRobotTag`、`tagName`、`tagNameEn`、`robotId`、`weCodeUrl`。
3. SDK 统一将返回结果组装为 `weAgentDetailsArray`：
   - `GET /v1/robot-partners/{partnerAccount}` 场景直接解析服务端返回的 `data[]`；
   - `GET /v4-1/we-crew/my-agent` 场景将 `data` 单对象适配为仅包含一个元素的 `weAgentDetailsArray`，其中：
     - `description` 映射到 `desc`
     - `robotId` 映射到 `id`
     - `partnerAccount`、`name`、`icon`、`bizRobotId`、`bizRobotName`、`bizRobotNameEn`、`bizRobotTag`、`tagName`、`tagNameEn`、`weCodeUrl` 按字段语义写入对应的 `WeAgentDetails`
     - `moduleId`、`appKey`、`appSecret`、`createdBy`、`creatorWorkId`、`creatorW3Account`、`creatorName`、`creatorNameEn`、`ownerWelinkId`、`ownerW3Account`、`ownerName`、`ownerNameEn`、`ownerDeptName`、`ownerDeptNameEn` 等服务端未返回字段，SDK 使用空字符串兜底
4. SDK 将对应详情写入 `current_we_agent_detail`（按 `userId` 隔离，`userId` 当前使用 mock 值：`mock_user_id`），用于 `getWeAgentUri`。
5. SDK 返回 `Promise<weAgentDetailsArray>`。

---

## 4.1 获取助理缓存详情接口

### 调用方

Skill 小程序调用

### 接口说明

根据 `partnerAccount` 获取指定助理的详情缓存。

- 若本地已存在对应 `partnerAccount` 的助理详情缓存，则 SDK 先直接返回缓存内容；
- 在返回缓存后，SDK 需异步调用服务端接口 `GET /v1/robot-partners/{partnerAccount}` 拉取最新详情，并更新本地缓存；
- 若本地不存在对应缓存，则 SDK 调用服务端接口获取详情，返回结果并写入本地缓存。

缓存存储方式与 `getWeAgentDetails` 一致，需按 `userId` 隔离；当前 `userId` 使用 mock 值：`mock_user_id`。

### 接口名

```typescript
getAssistantDetails(params: QueryWeAgentParams): Promise<WeAgentDetailsArray>
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

`WeAgentDetails` 对象字段定义与 `getWeAgentDetails` 返回保持一致。

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
      "tagName": "助手",
      "tagNameEn": "Agent",
      "weCodeUrl": "https://xxx"
    }
  ]
}
```

### 实现方法

1. SDK 在按 `userId` 隔离的本地缓存中读取固定缓存 key `we_agent_details`（`userId` 当前使用 mock 值：`mock_user_id`），并从中按 `partnerAccount` 读取对应助理详情对象缓存。
2. 若读取到对应 `partnerAccount` 的助理详情对象缓存，则 SDK 将该对象组装为 `weAgentDetailsArray` 返回。
3. 在返回缓存后，SDK 异步调用服务端 REST API：`GET /v1/robot-partners/{partnerAccount}`。
4. SDK 解析服务端返回 `data[]`；详情对象中的 `tagName`、`tagNameEn` 需与其他 `WeAgentDetails` 字段一并返回和缓存。若返回结果非空，则取首个助理详情对象写回按 `userId` 隔离的缓存对象中对应的 `partnerAccount` 字段，并覆盖更新缓存 key `we_agent_details`。
5. 若未读取到缓存，则 SDK 同步调用服务端 REST API：`GET /v1/robot-partners/{partnerAccount}`。
6. SDK 解析服务端返回 `data[]`；详情对象中的 `tagName`、`tagNameEn` 需与其他 `WeAgentDetails` 字段一并返回和缓存。若返回结果非空，则取首个助理详情对象写入按 `userId` 隔离的缓存对象中对应的 `partnerAccount` 字段，并更新缓存 key `we_agent_details`；同时 SDK 仍按接口约定将完整结果组装为 `weAgentDetailsArray` 返回给调用方。
7. 若服务端返回的助理详情为空，则 SDK 不设置新缓存，也不删除旧缓存。
8. 当缓存命中后的异步刷新失败时，不影响当前已返回的缓存结果；SDK 可记录日志用于排查。

---

## 4.2 获取当前助理详情接口

### 调用方

助理 Tab 宿主或需要读取当前助理信息的模块调用。

### 接口说明

读取按 `userId` 隔离的 `current_we_agent_detail` 缓存，并返回当前助理的完整 `WeAgentDetails` 对象。

接口不发起服务端请求，也不修改本地缓存。返回时保留缓存中的全部助理详情字段，仅对 `tagName`、`tagNameEn` 执行固定兜底：

- `tagName` 为空、缺失或缓存读取异常时，返回 `"助手"`；
- `tagNameEn` 为空、缺失或缓存读取异常时，返回 `"Agent"`。

### 接口名

```typescript
getWeAgentInfo(): WeAgentDetails
```

### 入参

无。

### 出参

返回完整 `WeAgentDetails` 对象。名称、头像、账号、机器人信息、WeCode 地址等字段保持当前详情缓存中的原值。

| 参数名 | 类型 | 说明 |
|---|---|---|
| `WeAgentDetails` 全部字段 | 与 `WeAgentDetails` 定义一致 | 从 `current_we_agent_detail` 读取并返回 |
| `tagName` | `string` | 助理标签中文名称；为空、缺失或读取异常时返回 `"助手"` |
| `tagNameEn` | `string` | 助理标签英文名称；为空、缺失或读取异常时返回 `"Agent"` |

### 出参示例

```json
{
  "name": "员工助手",
  "icon": "http://www.test.com/xxx",
  "desc": "我是xxx",
  "moduleId": "M1000",
  "appKey": "",
  "appSecret": "",
  "partnerAccount": "x00_1",
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
  "bizRobotTag": "myAgent",
  "bizRobotId": "",
  "tagName": "助手",
  "tagNameEn": "Agent",
  "weCodeUrl": "https://xxx"
}
```

### 实现方法

1. SDK 读取按 `userId` 隔离的 `current_we_agent_detail` 缓存。
2. 缓存存在时，SDK 返回缓存中的整个 `WeAgentDetails` 对象，不裁剪或改写其他详情字段。
3. `tagName` 为空或缺失时，仅在接口返回对象中将其兜底为 `"助手"`。
4. `tagNameEn` 为空或缺失时，仅在接口返回对象中将其兜底为 `"Agent"`。
5. 缓存不存在或读取异常时，SDK 按三端既有模型默认值构造字段完整的空 `WeAgentDetails`，并设置 `tagName = "助手"`、`tagNameEn = "Agent"` 后返回。
6. 兜底值只作用于本次接口返回，不回写 `current_we_agent_detail`。
7. 接口不判断客户端语言环境；调用方设置助理 Tab 标题时，中文环境使用 `tagName`，英文环境使用 `tagNameEn`。

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
| `partnerAccount` | `string` | 是 | 助理账号 ID；`updateWeAgent` 仅支持通过 `partnerAccount` 定位助理 |
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
2. SDK 校验 `partnerAccount`、`name`、`icon`、`description` 均为非空有效字符串，并仅向服务端透传 `partnerAccount`、`name`、`icon`、`description`；`robotId` 不再作为该接口入参。
3. SDK 根据服务端返回对象中的 `code` 判断结果；其中 `code` 为 `number` 类型：
   - 当 `code` 为 `200` 时，返回 `updateResult: "success"`；
   - 当 `code` 不为 `200` 时，SDK 抛出异常，并透传服务端返回的 `code` 与 `message`。
4. 当服务端接口请求成功，且 `code = 200` 后，SDK 需按 `userId`（当前 mock 值：`mock_user_id`）更新本地缓存：
   - 更新 `current_we_agent_detail`：若当前缓存中的助理 `partnerAccount` 与本次更新目标一致，则将其名称、头像、简介同步更新为最新值；
   - 更新 `we_agent_details`：按 `partnerAccount` 定位对应助理在缓存对象中的条目，并将其名称、头像、简介同步更新为最新值。
5. 若本地未命中对应助理缓存，则 SDK 不新增缓存，仅更新已存在且匹配的缓存项。
6. 本端主动调用 `updateWeAgent` 成功后，SDK 需触发 `agentskills.agentUpdated` 更新广播；广播前通过 `GET /v1/robot-partners/{partnerAccount}` 补拉完整助理详情，并以完整详情对象作为广播 `data`。若补拉详情失败，则不触发更新广播。

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
| `partnerAccount` | `string` | 是 | 助理账号 ID；`deleteWeAgent` 仅支持通过 `partnerAccount` 定位助理 |

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

1. SDK 校验 `partnerAccount` 为非空有效字符串，并仅向服务端透传 `partnerAccount`；`robotId` 不再作为该接口入参。
2. SDK 在调用删除服务端接口前，需先按 `userId`（当前 mock 值：`mock_user_id`）读取本地 `current_we_agent_detail`，并判断当前被删除助理是否命中“当前助理缓存”：
   - 若当前缓存存在，且其 `partnerAccount` 与本次删除目标匹配，则视为“删除当前助理”；
   - 否则视为“删除非当前助理”。
3. 调用服务端 REST API：`DELETE /v4-1/we-crew`。
4. SDK 根据服务端返回对象中的 `code` 判断结果；其中 `code` 为 `number` 类型：
   - 当 `code` 为 `200` 时，返回 `deleteResult: "success"`；
   - 当 `code` 不为 `200` 时，SDK 抛出异常，并透传服务端返回的 `code` 与 `message`。
5. 当服务端接口请求成功，且 `code = 200` 后，若判定为“删除非当前助理”，则 SDK 仅尝试更新本地 `we_agent_list_cache`：
   - 若本地存在助理列表缓存，则按 `partnerAccount` 从缓存列表中移除当前被删除助理，并将删除后的列表回写到本地 `we_agent_list_cache`；
   - 若本地不存在助理列表缓存，则不做任何缓存处理；
   - 若本地 `we_agent_details` 中存在该 `partnerAccount` 对应的助理详情缓存，则删除该条详情缓存并回写；
   - 该场景下不触发当前助理切换逻辑，不修改 `current_we_agent_detail`，也不组装跳转 URI。
6. 当服务端接口请求成功，且 `code = 200` 后，若判定为“删除当前助理”，则 SDK 执行当前助理删除后的跳转逻辑：
   - 仅尝试按 `partnerAccount` 更新本地 `we_agent_list_cache`；若本地不存在助理列表缓存，则不主动调用 `getWeAgentList`，也不做列表缓存处理；
   - 删除 `current_we_agent_detail` 中的当前被删助理；
   - 若本地 `we_agent_details` 中存在该 `partnerAccount` 对应的助理详情缓存，则删除该条详情缓存并回写；
   - 不在 `deleteWeAgent` 内部计算当前助理的下一个助理，不直接判断删除后列表是否存在主助理，也不直接组装主助理或激活页 URI；
   - 直接调用 `getWeAgentUri` 获取删除后的目标 URI，由 `getWeAgentUri` 内部判断是否存在主助理：有主助理时返回主助理相关 URI；无主助理、主助理获取失败或 `weCodeUrl` 为空时，按该接口约定返回激活页面 URI；
   - SDK 按 `getWeAgentUri` 返回结果执行跳转。
7. 本端主动调用 `deleteWeAgent` 成功后，SDK 需触发 `agentskills.agentUpdated` 删除广播，payload 为 `{ type: 'delete', data: { partnerAccount }, extraData: { source: 'local' } }`。

---

## 7. 设置是否展示助理接口

### 调用方

设置页面、助理 tab 页面调用

### 接口说明

设置 `isShowWeAgent` 持久化配置，并同步触发基座助理 tab 的打开或关闭。

该接口为 SDK 本地扩展接口，无对应服务端接口。

### 接口名

```typescript
setIsShowWeAgent(params: SetIsShowWeAgentParams): Promise<SetIsShowWeAgentResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `isShowWeAgent` | `boolean` | 是 | 是否展示助理 tab |

### 入参示例

```json
{
  "isShowWeAgent": true
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

1. SDK 接收入参 `isShowWeAgent`，并校验其为 `boolean` 类型。
2. `todo`：调用基座提供的 `saveSettings` 方法，保存 `isShowWeAgent` 对应配置值。
3. `todo`：调用基座广播接口，广播 `{ isShowWeAgent: true }`。
4. 当 `isShowWeAgent = true` 时：
    - `todo`：调用外部导入使用的基座方法打开助理 tab；
5. 当 `isShowWeAgent = false` 时：
    - `todo`：调用外部导入使用的基座方法关闭助理 tab；
6. SDK 返回 `SetIsShowWeAgentResult`，其中 `status` 固定为 `success`。

### 错误码（参考）

| 错误码 | 错误消息 | 说明 |
|---|---|---|
| `1000` | 无效的参数 | `isShowWeAgent` 缺失或类型错误 |
| `5000` | 内部错误 | `saveSettings` 调用失败、基座广播失败，或打开/关闭助理 tab 失败 |

---

## 8. 获取是否展示助理接口

### 调用方

设置页面调用

### 接口说明

获取基座配置中的 `isShowWeAgent` 值。

该接口为 SDK 本地扩展接口，无对应服务端接口。

### 接口名

```typescript
getIsShowWeAgent(): Promise<GetIsShowWeAgentResult>
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `isShowWeAgent` | `boolean` | 是否展示助理 tab；若基座未返回有效值则默认返回 `false` |

### 出参示例

```json
{
  "isShowWeAgent": false
}
```

### 实现方法

1. `todo`：SDK 调用基座提供的 `getSettings` 方法获取 `isShowWeAgent` 对应配置值。
2. 若读取到有效布尔值，则直接返回该值。
3. 若基座未返回有效值，则默认返回 `false`，并返回：
   ```json
   {
     "isShowWeAgent": false
   }
   ```

### 错误码（参考）

| 错误码 | 错误消息 | 说明 |
|---|---|---|
| `5000` | 内部错误 | `getSettings` 调用失败，或基座返回结果异常 |

---

## 9. 打开助理接口

### 调用方

IM 模块调用

### 接口说明

根据 `partnerAccount` 或当前主助理详情，组装并打开助理所需的 URI 信息。

该接口为 SDK 本地扩展接口，`partnerAccount` 为非必填：

- 当传入 `partnerAccount` 时，按指定助理打开，并沿用历史 URI 组装逻辑；
- 当未传 `partnerAccount` 时，SDK 直接调用 `getWeAgentUri` 获取 `weAgentUri`、`assistantDetailUri`、`switchAssistantUri`。

### 接口名

```typescript
openWeAgent(params: OpenWeAgentParams): Promise<OpenWeAgentResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 否 | 助理账号 ID；传入时按指定助理打开，不传时默认打开当前主助理 |

### 入参示例

```json
{
  "partnerAccount": "x00_1"
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

1. SDK 接收入参 `partnerAccount`；当传入时，校验其为非空字符串。
2. `todo`：SDK 调用基座提供的 `saveSettings` 方法，保存 `isShowWeAgent = true`。
3. `todo`：调用基座广播接口，广播 `{ isShowWeAgent: true }`。
4. 当传入 `partnerAccount` 时，SDK 调用 `getAssistantDetails(params: QueryWeAgentParams)` 获取指定助理详情。
5. 当未传 `partnerAccount` 时，SDK 直接调用 `getWeAgentUri`，复用其内部对 `current_we_agent_detail` 以及 URI 组装规则的完整处理逻辑。
6. SDK 需将目标助理详情统一归一化为本地缓存结构后写入 `current_we_agent_detail`：
   - 指定助理场景复用 `getAssistantDetails` 返回的详情对象；
   - 主助理场景由 `getWeAgentUri` 内部负责处理和更新。
7. 若目标助理详情不存在，或 `weCodeUrl` 为空字符串，则 SDK 抛出 `7000` 异常。
8. SDK 在内存中直接组装 `weAgentUri`、`assistantDetailUri`、`switchAssistantUri`，并与 `getWeAgentUri` 保持一致：
   - 当传入 `partnerAccount` 时，沿用历史组装逻辑不变：
     - 若 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 不一致：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent` 与 `robotId={id}`；
     - 若 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 一致：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`；
     - `assistantDetailUri` 组装为：`h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `assistantDetail`；
     - `switchAssistantUri` 组装为：`h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `switchAssistant`。
   - 当未传 `partnerAccount` 时，直接复用 `getWeAgentUri` 的返回结果，不在 `openWeAgent` 内重复实现主助理 URI 组装逻辑。
9. `todo`：调用基座方法打开助理 tab，并使用 `weAgentUri`、`assistantDetailUri`、`switchAssistantUri` 调用 `openWeAgentCUI` 方法打开助理 CUI。
10. SDK 返回 `OpenWeAgentResult`，其中 `status` 固定为 `success`。

### 错误码（参考）

| 错误码 | 错误消息 | 说明 |
|---|---|---|
| `1000` | 无效的参数 | `partnerAccount` 传入但格式错误 |
| `5000` | 内部错误 | `saveSettings` 调用失败、基座广播失败、打开助理 tab 失败，或 `openWeAgentCUI` 调用失败 |
| `7000` | 服务端错误 | `getAssistantDetails` 调用失败、服务端未返回有效助理详情、助理详情中的 `weCodeUrl` 为空，或返回结构异常 |

---

## 10. 打开助理编辑页面接口

### 调用方

Skill 小程序调用

### 接口说明

打开助理编辑页面。
该接口为 SDK 本地扩展接口，无对应服务端接口。
助理详情更新后的数据不通过该接口回传；调用方如通讯录需要通过注册 `agentskills.agentUpdated` 端侧详情广播通知获取更新后的助理数据。

### 接口名

```typescript
openAssistantEditPage(params: OpenAssistantEditPageParams): Promise<OpenAssistantEditPageResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 助理账号 ID |

### 入参示例

```typescript
{
  partnerAccount: 'x00_1'
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

1. SDK 接收并校验 `partnerAccount`，该参数必填且不能为空字符串。
2. SDK 仅使用入参标识定位待编辑助理，不注册更新回调，也不负责向调用方回传更新后的助理详情数据。
3. SDK 将 `partnerAccount` 拼接到 `h5://S008623/index.html#editAssistant`，追加 query `partnerAccount={partnerAccount}`。
4. 拼接完成后的 uri 地址当前先记为 `todo`，待后续页面地址方案确认后补齐。
5. SDK 拉起助理编辑页面。
6. SDK 返回 `OpenAssistantEditPageResult`，其中 `status` 固定为 `success`。
7. 编辑页完成助理详情更新后，更新后数据通过 `agentskills.agentUpdated` 端侧详情广播通知同步给调用方；通讯录等调用方需自行注册并消费该广播。

### 错误码（参考）

| 错误码 | 错误消息 | 说明 |
|---|---|---|
| `1000` | 无效的参数 | `partnerAccount` 缺失、为空字符串或格式错误 |
| `5000` | 内部错误 | 编辑页 URI 拼接失败、页面地址方案未配置，或基座拉起助理编辑页面失败 |

---

## 11. 查询二维码信息接口

### 调用方

Skill 小程序调用

### 接口说明

根据二维码唯一标识查询二维码相关信息。

### 接口名

```typescript
queryQrcodeInfo(params: QueryQrcodeInfoParams): Promise<QrcodeInfo>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `qrcode` | `string` | 是 | 二维码唯一标识 |

### 入参示例

```json
{
  "qrcode": "qr_001"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `qrcode` | `string` | 二维码唯一标识 |
| `weUrl` | `string` | We 侧地址 |
| `pcUrl` | `string` | PC 侧地址 |
| `expireTime` | `string` | 过期时间戳 |
| `status` | `number` | 二维码状态 |
| `mac` | `string` | 设备 MAC 地址 |
| `channel` | `string` | 二维码渠道标识 |
| `expired` | `boolean` | 过期状态 |

### 出参示例

```json
{
  "qrcode": "qr_001",
  "weUrl": "welink://xxx",
  "pcUrl": "https://xxx",
  "expireTime": "1713686400000",
  "status": 1,
  "mac": "AA-BB-CC-DD-EE-FF",
  "channel": "welink",
  "expired": false
}
```

### 实现方法

1. SDK 调用服务端 REST API：`GET /v4-1/we-crew/im-register/qrcode/{qrcode}`。
2. 服务端响应结构为：
   - `code: string`
   - `message: string`
   - `data: object`
3. SDK 对外不透出服务端包装字段，直接透传 `data` 中的以下字段作为接口返回：
   - `qrcode`
   - `weUrl`
   - `pcUrl`
   - `expireTime`
   - `status`
   - `mac`
   - `channel`
   - `expired`

---

## 12. 更新二维码信息接口

### 调用方

Skill 小程序调用

### 接口说明

根据二维码唯一标识更新二维码信息。

### 接口名

```typescript
updateQrcodeInfo(params: UpdateQrcodeInfoParams): Promise<UpdateQrcodeInfoResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `qrcode` | `string` | 是 | 二维码唯一标识 |
| `robotId` | `string` | 否 | 分身机器人 ID |
| `status` | `number` | 是 | 二维码状态 |

### 入参示例

```json
{
  "qrcode": "qr_001",
  "robotId": "860306",
  "status": 2
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `status` | `string` | 当服务端返回 `code=200` 时固定返回 `success` |

### 出参示例

```json
{
  "status": "success"
}
```

### 实现方法

1. SDK 调用服务端 REST API：`PUT /v4-1/we-crew/im-register/qrcode`。
2. SDK 透传入参 `qrcode`、`robotId`、`status`。
3. 服务端响应结构为：
   - `code: string`
   - `message: string`
4. SDK 根据服务端 `code` 判断结果：
   - 当 `code` 为 `200` 时，返回 `{ status: "success" }`。

---

## 13. 查询助理单人灰度接口

### 调用方

Skill 小程序调用

### 接口说明

根据 `partnerAccount` 查询当前用户是否命中助理单人灰度，并将 `partnerAccount` 作为 `welinkId` 传给服务端。

该接口需要做本地缓存：

- 若本地已存在该 `partnerAccount` 的缓存结果，则优先返回缓存
- 返回缓存后，SDK 异步调用服务端接口刷新缓存
- 若本地不存在该 `partnerAccount` 的缓存结果，则调用服务端接口获取并写入缓存

### 接口名

```typescript
queryAssistantGraySingle(params: QueryAssistantGraySingleParams): Promise<QueryAssistantGraySingleResult>
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `partnerAccount` | `string` | 是 | 助理账号 ID，调用服务端时作为 `welinkId` 传递 |

### 入参示例

```json
{
  "partnerAccount": "x12345678"
}
```

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `data` | `boolean` | 业务助手是否在灰度名单内 |

### 出参示例

```json
{
  "data": true
}
```

### 实现方法

1. SDK 在按 `userId` 隔离的本地缓存中读取固定缓存 key `assistant_gray_single_cache`（`userId` 当前使用 mock 值：`mock_user_id`），并从中按 `partnerAccount` 读取对应缓存值。
2. 若读取到对应 `partnerAccount` 的缓存值，则 SDK 立即返回 `{ data: cachedValue }`。
3. 在返回缓存后，SDK 异步调用服务端 REST API：`GET /v4-1/robot-partners/im-chat/gray-single?welinkId={partnerAccount}`。
4. 服务端响应结构为：
   - `data: boolean`
   - `message: string`
   - `code: string`
5. 当异步刷新请求返回 `code = 200` 时，SDK 使用最新 `data` 覆盖更新按 `userId` 隔离的缓存对象中对应的 `partnerAccount` 字段，并回写缓存 key `assistant_gray_single_cache`。
6. 若未读取到缓存，则 SDK 同步调用服务端 REST API：`GET /v4-1/robot-partners/im-chat/gray-single?welinkId={partnerAccount}`。
7. 当同步请求返回 `code = 200` 时，SDK 将服务端返回的 `data` 写入按 `userId` 隔离的缓存对象中对应的 `partnerAccount` 字段，并返回 `{ data }`。
8. 当服务端返回非 `200` 时，SDK 抛出异常，并透传服务端 `code` 与 `message`。
9. 当缓存命中后的异步刷新失败时，不影响当前已返回的缓存结果；SDK 不删除旧缓存，可记录日志用于排查。

---

## 14. 获取主助理详情接口

### 调用方

IM 模块调用

### 接口说明

调用服务端接口 `GET /v4-1/we-crew/my-agent` 获取当前主助理详情。

该接口无入参，SDK 对外直接透传服务端返回的 `data` 对象，不透出通用包装字段 `code`、`message`。

### 接口名

```typescript
getMyAgentDetail(): Promise<MyAgentDetail>
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `partnerAccount` | `string` | 主助理账号 |
| `name` | `string` | 主助理名称 |
| `icon` | `string` | 主助理头像 |
| `description` | `string` | 主助理简介 |
| `bizRobotId` | `string` | 助理类型 ID |
| `bizRobotName` | `string` | 助理类型名称 |
| `bizRobotNameEn` | `string` | 助理类型英文名称 |
| `bizRobotTag` | `string` | 助理标签 |
| `tagName` | `string` | 助理标签中文名称 |
| `tagNameEn` | `string` | 助理标签英文名称 |
| `robotId` | `string` | 主助理 ID |
| `weCodeUrl` | `string` | 主助理 WeCode 地址 |

### 出参示例

```json
{
  "partnerAccount": "x00_1",
  "name": "员工助手",
  "icon": "https://example.com/icon.png",
  "description": "我是xxx",
  "bizRobotId": "123456",
  "bizRobotName": "员工助手",
  "bizRobotNameEn": "staffAssistant",
  "bizRobotTag": "myAgent",
  "tagName": "助手",
  "tagNameEn": "Agent",
  "robotId": "78985451212",
  "weCodeUrl": "h5://S008623/index.html"
}
```

### 实现方法

1. SDK 调用服务端 REST API：`GET /v4-1/we-crew/my-agent`。
2. 该接口无入参。
3. 服务端返回通用包装结构：
   - `code`：状态码，正常为 `200`
   - `message`：响应消息
   - `data`：主助理详情对象，包含 `partnerAccount`、`name`、`icon`、`description`、`bizRobotId`、`bizRobotName`、`bizRobotNameEn`、`bizRobotTag`、`tagName`、`tagNameEn`、`robotId`、`weCodeUrl`
   - `tagName`：助理标签中文名称
   - `tagNameEn`：助理标签英文名称
4. SDK 对外直接返回 `data` 对象，不新增字段，不改写字段名。
5. SDK 返回 `Promise<MyAgentDetail>`。

### 错误码

| 错误码 | 错误消息 | 说明 |
|---|---|---|
| `7000` | 服务端错误 | `/v4-1/we-crew/my-agent` 调用失败、返回结构异常，或服务端返回非成功状态码 |

---

## 15. 获取当前 WeAgentUri 接口

### 调用方

Skill 小程序调用

### 接口说明

读取持久化的当前助理详情，组装并返回当前助理相关页面 URI。
当可读取到持久化助理详情且其 `weCodeUrl` 为空时，SDK 需直接走固定激活页兜底；当可读取到持久化助理详情且其 `bizRobotTag = myAgent` 时，使用新的 URI 组装规则；当可读取到持久化助理详情但不满足该条件时，沿用历史 URI 组装逻辑不变；当读取不到持久化助理详情时，SDK 不再请求服务端接口，而是直接返回主助理固定页面地址。

### 接口名

```typescript
getWeAgentUri(): WeAgentUriResult
```

### 入参

无

### 出参

| 参数名 | 类型 | 说明 |
|---|---|---|
| `weAgentUri` | `string` | 当前助理 CUI 地址；当持久化助理详情的 `bizRobotTag = myAgent` 时，使用持久化详情中的 `weCodeUrl` 并追加 query 参数 `wecodePlace=weAgent` 和 `from=weAgent`；当读取不到持久化助理详情时，SDK 请求 `/v4-1/we-crew/my-agent` 获取主助理详情并按同样规则组装；若请求失败或 `weCodeUrl` 为空，则返回激活页地址；其余场景沿用历史组装逻辑 |
| `assistantDetailUri` | `string` | 助理详情地址；当持久化助理详情的 `bizRobotTag = myAgent` 时，组装为 `h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `assistantDetail`；当读取不到持久化助理详情时，SDK 请求 `/v4-1/we-crew/my-agent` 获取主助理详情并按同样规则组装；若请求失败或 `weCodeUrl` 为空，则返回空字符串；其余场景沿用历史组装逻辑 |
| `switchAssistantUri` | `string` | 切换助理地址；当持久化助理详情的 `bizRobotTag = myAgent` 时，组装为 `h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `switchAssistant`；当读取不到持久化助理详情时，SDK 请求 `/v4-1/we-crew/my-agent` 获取主助理详情并按同样规则组装；若请求失败或 `weCodeUrl` 为空，则返回空字符串；其余场景沿用历史组装逻辑 |

### 出参示例（持久化助理详情 `bizRobotTag = myAgent` 场景）

```json
{
  "weAgentUri": "https://xxx?wecodePlace=weAgent&from=weAgent",
  "assistantDetailUri": "h5://S008623/index.html?partnerAccount=x00_1#assistantDetail",
  "switchAssistantUri": "h5://S008623/index.html?partnerAccount=x00_1#switchAssistant"
}
```

### 出参示例（无持久化助理详情，成功请求到主助理详情场景）

```json
{
  "weAgentUri": "https://xxx?wecodePlace=weAgent&from=weAgent",
  "assistantDetailUri": "h5://S008623/index.html?partnerAccount=x00_1#assistantDetail",
  "switchAssistantUri": "h5://S008623/index.html?partnerAccount=x00_1#switchAssistant"
}
```

### 出参示例（已读取到助理详情，但该详情的 `weCodeUrl` 为空的兜底场景）

```json
{
  "weAgentUri": "h5://S008623/index.html?wecodePlace=weAgent#activateAssistant",
  "assistantDetailUri": "",
  "switchAssistantUri": ""
}
```

### 实现方法

1. 从 SP 持久化存储中读取当前助理详情（按 `userId` 隔离，`userId` 当前使用 mock 值：`mock_user_id`）。
2. 若读取到的持久化助理详情中 `weCodeUrl` 为空字符串，则 SDK 直接走兜底逻辑：
   - `weAgentUri` 固定返回 `h5://S008623/index.html?wecodePlace=weAgent#activateAssistant`
   - `assistantDetailUri` 返回空字符串
   - `switchAssistantUri` 返回空字符串
3. 当读取到的持久化助理详情满足 `bizRobotTag = myAgent` 时，使用新的组装规则：
   - `weAgentUri` 组装为：持久化助理详情中的 `weCodeUrl` + query 参数 `wecodePlace=weAgent` 和 `from=weAgent`；
   - `assistantDetailUri` 组装为：`h5://S008623/index.html` + query 参数 `partnerAccount={持久化助理详情.partnerAccount}` + hash `assistantDetail`；
   - `switchAssistantUri` 组装为：`h5://S008623/index.html` + query 参数 `partnerAccount={持久化助理详情.partnerAccount}` + hash `switchAssistant`。
4. 当读取到的持久化助理详情不满足 `bizRobotTag = myAgent` 时，沿用历史组装逻辑返回：
   - 若 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 不一致：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent` 与 `robotId={id}`；
   - 若 `weCodeUrl` 的 host 值与常量 `WE_AGENT_CUI_APPID: S008623` 一致：以 `weCodeUrl` 为基础地址，追加 query 参数 `wecodePlace=weAgent` 与 `assistantAccount={partnerAccount}`；
   - `assistantDetailUri` 组装为：`h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `assistantDetail`；
   - `switchAssistantUri` 组装为：`h5://S008623/index.html` + query 参数 `partnerAccount={partnerAccount}` + hash `switchAssistant`。
5. 若读取不到持久化助理详情，则 SDK 调用服务端 REST API：`GET /v4-1/we-crew/my-agent`。
6. 当 `/v4-1/we-crew/my-agent` 返回成功时：
   - SDK 将服务端返回对象适配为主助理详情，其中 `robotId` 映射到 `id`，`tagName`、`tagNameEn` 原样映射到 `WeAgentDetails`；
   - 若当前本地没有详情，或当前本地详情本身就是主助理，则将该主助理详情写入 `current_we_agent_detail`；
   - 若返回详情中的 `weCodeUrl` 非空，则按第 3 步的主助理规则组装 `weAgentUri`、`assistantDetailUri`、`switchAssistantUri`。
7. 若 `/v4-1/we-crew/my-agent` 请求失败、返回结构异常，或返回详情中的 `weCodeUrl` 为空，则 SDK 直接走兜底逻辑：
   - `weAgentUri` 固定返回 `h5://S008623/index.html?wecodePlace=weAgent#activateAssistant`
   - `assistantDetailUri` 返回空字符串
   - `switchAssistantUri` 返回空字符串
8. 返回 `WeAgentUriResult`。

---

## 数据类型定义

### CreateDigitalTwinParams

```typescript
type CreateDigitalTwinParams = {
  name: string
  icon: string
  description: string
  weCrewType?: number
  bizRobotId?: string
  qrcode?: string
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
}
```

### DeleteWeAgentResult

```typescript
type DeleteWeAgentResult = {
  deleteResult: string
}
```

### SetIsShowWeAgentParams

```typescript
type SetIsShowWeAgentParams = {
  isShowWeAgent: boolean
}
```

### SetIsShowWeAgentResult

```typescript
type SetIsShowWeAgentResult = {
  status: string
}
```

### GetIsShowWeAgentResult

```typescript
type GetIsShowWeAgentResult = {
  isShowWeAgent: boolean
}
```

### OpenWeAgentParams

```typescript
type OpenWeAgentParams = {
  partnerAccount?: string
}
```

### OpenWeAgentResult

```typescript
type OpenWeAgentResult = {
  status: string
}
```

### OpenAssistantEditPageParams

```typescript
type OpenAssistantEditPageParams = {
  partnerAccount: string
}
```

### OpenAssistantEditPageResult

```typescript
type OpenAssistantEditPageResult = {
  status: string
}
```

### QueryQrcodeInfoParams

```typescript
type QueryQrcodeInfoParams = {
  qrcode: string
}
```

### QrcodeInfo

```typescript
type QrcodeInfo = {
  qrcode: string
  weUrl: string
  pcUrl: string
  expireTime: string
  status: number
  expired: boolean
}
```

### UpdateQrcodeInfoParams

```typescript
type UpdateQrcodeInfoParams = {
  qrcode: string
  robotId?: string
  status: number
}
```

### UpdateQrcodeInfoResult

```typescript
type UpdateQrcodeInfoResult = {
  status: string
}
```

### QueryAssistantGraySingleParams

```typescript
type QueryAssistantGraySingleParams = {
  partnerAccount: string
}
```

### QueryAssistantGraySingleResult

```typescript
type QueryAssistantGraySingleResult = {
  data: boolean
}
```

### MyAgentDetail

```typescript
type MyAgentDetail = {
  partnerAccount: string
  name: string
  icon: string
  description: string
  bizRobotId: string
  bizRobotName: string
  bizRobotNameEn: string
  bizRobotTag: string
  tagName: string
  tagNameEn: string
  robotId: string
  weCodeUrl: string
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
  bizRobotTag: string
  tagName: string
  tagNameEn: string
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
  tagName: string
  tagNameEn: string
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
