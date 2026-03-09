# Skill Mock Server (Node.js)

基于 `01-layer1-miniapp-skill-api.md` 实现的可运行 Mock 服务端，支持：

- 9 个 REST API
- WebSocket 实时流推送（`/ws/skill/stream`）
- 会话、消息、权限、流式生成的内存态模拟

## 1. 启动

```bash
cd F:\AIProject\skillSDK\skill-mock-server
npm install
npm start
```

默认端口：`8088`  
可用环境变量修改端口：

```bash
set PORT=9000 && npm start
```

## 2. 鉴权约定

与文档一致，Mock 通过 Cookie 解析 `userId`：

- 示例：`Cookie: userId=10001`
- 未提供时默认 `userId=10001`

## 3. REST API 列表

基础路径：`/api/skill`

1. `POST /sessions` 创建会话
2. `POST /sessions/{welinkSessionId}/messages` 发送消息
3. `POST /sessions/{welinkSessionId}/permissions/{permId}` 回复权限请求
4. `POST /sessions/{welinkSessionId}/abort` 中止会话执行
5. `DELETE /sessions/{welinkSessionId}` 关闭会话
6. `GET /sessions/{welinkSessionId}/messages` 查询历史消息
7. `GET /sessions` 查询会话列表
8. `GET /sessions/{welinkSessionId}` 查询单个会话
9. `POST /sessions/{welinkSessionId}/send-to-im` 发送内容到 IM

除 `send-to-im` 外，REST 响应格式为：

```json
{
  "code": 0,
  "errormsg": "",
  "data": {}
}
```

## 4. WebSocket

- 地址：`ws://localhost:8088/ws/skill/stream`
- Cookie 鉴权：`userId`
- 推送范围：当前用户所有 `ACTIVE` 会话

支持事件类型：

- `text.delta`, `text.done`
- `thinking.delta`, `thinking.done`
- `tool.update`
- `question`
- `permission.ask`, `permission.reply`
- `file`
- `step.start`, `step.done`
- `session.status`, `session.title`, `session.error`
- `agent.online`, `agent.offline`
- `snapshot`, `streaming`

## 5. 快速联调示例

### 5.1 创建会话

```bash
curl -X POST "http://localhost:8088/api/skill/sessions" ^
  -H "Content-Type: application/json" ^
  -H "Cookie: userId=10001" ^
  -d "{\"ak\":\"ak_demo\",\"title\":\"Mock Session\",\"imGroupId\":\"chat-001\"}"
```

### 5.2 发送消息（触发流式返回）

```bash
curl -X POST "http://localhost:8088/api/skill/sessions/1/messages" ^
  -H "Content-Type: application/json" ^
  -H "Cookie: userId=10001" ^
  -d "{\"content\":\"请帮我生成一个方案\"}"
```

### 5.3 权限场景消息（触发 permission.ask）

```bash
curl -X POST "http://localhost:8088/api/skill/sessions/1/messages" ^
  -H "Content-Type: application/json" ^
  -H "Cookie: userId=10001" ^
  -d "{\"content\":\"请执行一个需要权限的bash命令\"}"
```

收到 `permission.ask` 后调用：

```bash
curl -X POST "http://localhost:8088/api/skill/sessions/1/permissions/perm_xxx" ^
  -H "Content-Type: application/json" ^
  -H "Cookie: userId=10001" ^
  -d "{\"response\":\"once\"}"
```

### 5.4 发送到 IM

```bash
curl -X POST "http://localhost:8088/api/skill/sessions/1/send-to-im" ^
  -H "Content-Type: application/json" ^
  -H "Cookie: userId=10001" ^
  -d "{\"content\":\"最终确认内容\"}"
```

## 6. 触发不同场景（按消息关键词）

- 包含 `权限` / `permission` / `bash`：触发权限请求
- 包含 `选择` / `question`：触发 question 事件
- 包含 `文件` / `file` / `图片`：触发 file 事件

## 7. 说明

- 数据为内存态，重启服务后清空。
- 适用于前端 SDK/小程序联调，不用于生产环境。
