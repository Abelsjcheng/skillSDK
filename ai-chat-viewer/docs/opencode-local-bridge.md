# ai-chat-viewer 对接本地 OpenCode

## 目标

让 `ai-chat-viewer` 继续作为 CUI 展示层，通过 `window.HWH5EXT` 适配器接入本地 OpenCode。

当前仓库里已经有两条接入路径：

1. 轻量 `OpenCode Bridge`，单机即可启动，推荐本地联调使用。
2. 完整 `opencode-CUI skill-server`，更贴近正式架构，但默认依赖 MySQL、Redis、ai-gateway。

## 当前实现

浏览器侧已补齐本地 `opencode` 适配入口：

- `src/opencode/createOpencodeHwh5ext.ts`
- `src/opencode/installOpencodeBridge.ts`
- `src/index.tsx`

当 URL 中包含以下任一参数时，会自动启用本地 `opencode` 适配器：

- `adapter=opencode`
- `opencodeBridge=1`

## 推荐联调方式

### 方案 A：使用轻量 OpenCode Bridge

这是当前最容易跑通的方式，不依赖 MySQL、Redis、ai-gateway。

启动命令：

```bash
cd F:\AIProject\skillSDK\skill-mock-server
npm run start:opencode
```

默认配置：

- REST: `http://localhost:8082`
- WebSocket: `ws://localhost:8082/ws/skill/stream`
- OpenCode 工作目录：`F:\AIProject\skillSDK`
- OpenCode 配置目录：`F:\AIProject\skillSDK\.opencode-config`

可选环境变量：

- `PORT`
- `OPENCODE_BRIDGE_WORKDIR`
- `OPENCODE_BRIDGE_CONFIG_HOME`
- `OPENCODE_BRIDGE_BIN`

Bridge 当前已支持：

- 新建会话
- 发送消息
- 连续对话
- 拉取历史消息
- WebSocket 推送 `session.status` / `step.start` / `text.delta` / `text.done` / `step.done`
- 停止生成

### 方案 B：使用完整 opencode-CUI skill-server

这条链路也兼容，但默认依赖：

- MySQL
- Redis
- ai-gateway

所以更适合集成环境，不适合作为你当前机器上的最小本地调试方案。

## ai-chat-viewer 启动方式

在 `ai-chat-viewer` 目录执行：

```bash
cd F:\AIProject\skillSDK\ai-chat-viewer
npm run dev
```

Webpack dev server 已代理：

- `/api` -> `http://localhost:8082`
- `/ws` -> `ws://localhost:8082`

## 打开对话页

默认使用本地代理时：

```text
http://localhost:3000/#/weAgentCUI?assistantAccount=opencode_local&adapter=opencode
```

如果要显式指定后端地址：

```text
http://localhost:3000/?adapter=opencode&opencodeBaseUrl=http://localhost:8082#/weAgentCUI?assistantAccount=opencode_local
```

## 可选参数

- `opencodeBaseUrl`: REST 基地址，例如 `http://localhost:8082`
- `opencodeWsBaseUrl`: WebSocket 基地址，例如 `ws://localhost:8082`
- `opencodeAssistantAccount`: 助手账号，默认 `opencode_local`
- `opencodeAssistantName`: 助手名称，默认 `OpenCode`
- `opencodeAssistantDesc`: 助手简介
- `opencodeAk`: 本地调试用 AK，默认 `opencode-local-ak`
- `opencodeUserId`: 本地用户 ID，默认 `10001`
- `opencodeUserName`: 本地用户名，默认 `本地用户`

## 适配层职责

### 浏览器侧

- 对外提供 `window.HWH5EXT`
- 把 `ai-chat-viewer` 调用的 JSAPI 映射到本地后端
- 通过 WebSocket 订阅 `/ws/skill/stream`
- 为页面补齐本地 `window.HWH5.getUserInfo/getDeviceInfo/showToast`

### 后端侧

- 负责会话创建、历史消息、流式事件推送
- 负责把 `opencode` 原始 JSON 事件翻译为 `StreamMessage`

## 已知限制

- `createDigitalTwin`、`controlSkillWeCode` 目前只提供最小占位实现
- 轻量 bridge 还没有实现 `regenerateAnswer`
- 本机 `opencode` CLI 直接启动时会报：

```text
EEXIST: file already exists, mkdir 'C:\\Users\\ASUS\\.config\\opencode'
```

当前 bridge 通过把 `XDG_CONFIG_HOME` 指到工作区目录规避了这个问题
