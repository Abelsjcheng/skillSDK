# Skill-Server 历史消息接口说明

> 日期：2026-03-26
> 状态：Ready
> 适用服务：`skill-server`

## 1. 背景

历史消息查询目前分为两类场景：

1. 传统分页场景
用于后台管理页、兼容旧前端逻辑，依赖 `page/size/total`。

2. IM 聊天场景
用于聊天页首屏加载和上拉翻历史，更关注“最近一屏”和“是否还有更早消息”，不希望每次都依赖 `COUNT(*)`。

因此服务端同时提供两个接口：

1. 旧接口：保留分页模型，兼容已有调用方
2. 新接口：新增游标模型，给聊天页使用

## 2. 接口列表

### 2.1 旧接口：分页查询

`GET /api/skill/sessions/{sessionId}/messages`

用途：
兼容旧逻辑，适合需要 `page/total` 语义的页面。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | `int` | 否 | `0` | 页码，从 0 开始 |
| `size` | `int` | 否 | `50` | 每页大小 |

说明：

1. 返回结构保持原有 `PageResult` 不变。
2. 当前分页语义已调整为“`page=0` 返回最近一页”，更符合消息场景。
3. 返回内容内部仍按消息时间正序排列，便于前端直接渲染。

响应示例：

```json
{
  "code": 0,
  "data": {
    "content": [
      {
        "id": "msg_1001_99",
        "welinkSessionId": "1001",
        "seq": 99,
        "messageSeq": 99,
        "role": "user",
        "content": "你好",
        "contentType": "plain",
        "parts": []
      }
    ],
    "total": 128,
    "totalPages": 3,
    "page": 0,
    "size": 50
  }
}
```

### 2.2 新接口：游标查询

`GET /api/skill/sessions/{sessionId}/messages/history`

用途：
用于聊天页首屏加载和上拉加载更早消息。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `beforeSeq` | `Integer` | 否 | 无 | 查询该序号之前的更早消息 |
| `size` | `int` | 否 | `50` | 每次拉取条数 |

调用方式：

1. 首屏加载：不传 `beforeSeq`
2. 加载更早消息：传上一次返回的 `nextBeforeSeq`

响应字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | `array` | 当前批次消息列表 |
| `size` | `int` | 本次查询的 page size |
| `hasMore` | `boolean` | 是否还有更早消息 |
| `nextBeforeSeq` | `Integer` | 下次继续向前翻页时使用的游标 |

响应示例：

```json
{
  "code": 0,
  "data": {
    "content": [
      {
        "id": "msg_1001_99",
        "welinkSessionId": "1001",
        "seq": 99,
        "messageSeq": 99,
        "role": "user",
        "content": "你好",
        "contentType": "plain",
        "parts": []
      },
      {
        "id": "msg_1001_100",
        "welinkSessionId": "1001",
        "seq": 100,
        "messageSeq": 100,
        "role": "assistant",
        "content": "你好，请问有什么可以帮你？",
        "contentType": "markdown",
        "parts": []
      }
    ],
    "size": 50,
    "hasMore": true,
    "nextBeforeSeq": 99
  }
}
```

## 3. 前端接入建议

### 3.1 后台页或旧页面

继续使用：

`GET /api/skill/sessions/{sessionId}/messages?page=0&size=50`

### 3.2 聊天页

首屏加载：

`GET /api/skill/sessions/{sessionId}/messages/history?size=50`

上拉加载：

`GET /api/skill/sessions/{sessionId}/messages/history?size=50&beforeSeq=99`

建议前端逻辑：

1. 首屏进入页面时调用 `/messages/history`
2. 将返回的 `content` 追加到历史列表头部
3. 若 `hasMore=false`，停止继续请求
4. 若 `hasMore=true`，下次请求带上 `nextBeforeSeq`

## 4. 性能说明

新接口针对聊天页场景做了两点优化：

1. 不依赖 `COUNT(*)`
避免每次打开聊天页都做总数统计。

2. 批量查询消息分片
避免按消息逐条查询 `parts` 带来的 N+1 问题。

因此聊天页应优先使用 `/messages/history`，旧分页接口主要保留给兼容场景。

## 5. 兼容性约定

1. `/messages` 为兼容接口，短期内保留。
2. `/messages/history` 为推荐接口，后续聊天页默认应迁移到该接口。
3. 两个接口返回的单条消息结构保持一致，差异只在分页元数据。
