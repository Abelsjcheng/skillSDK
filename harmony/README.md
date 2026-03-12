# Harmony Skill SDK 使用说明

## 工程位置
- SDK 目录：`harmony/`
- 入口导出：`harmony/src/main/ets/index.ets`
- 核心实现：`harmony/src/main/ets/sdk/SkillSDK.ets`

## 快速接入

### 1. 导入 SDK
根据你的工程集成方式导入：

```ts
import {
  SkillSDK,
  SkillSDKConfig,
  SkillWeCodeAction,
  SessionStatus,
  CreateSessionParams,
  SendMessageParams,
  RegisterSessionListenerParams,
  ReplyPermissionParams
} from 'skill-sdk';
```

### 2. 初始化单例
```ts
const config: SkillSDKConfig = {
  baseUrl: 'http://127.0.0.1:8082',
  enableLog: true,
  timeout: 30000
};

const sdk = SkillSDK.getInstance(config);
```

## 最小调用链路示例

```ts
const sdk = SkillSDK.getInstance({
  baseUrl: 'http://127.0.0.1:8082',
  enableLog: true
});

const session = await sdk.createSession({
  ak: 'ak_xxxxxxxx',
  title: 'Harmony 示例会话',
  imGroupId: 'group_abc123'
});

const sessionId = session.welinkSessionId;

const onMessage = (message) => {
  // 处理 text.delta / tool.update / permission.ask 等事件
};

sdk.registerSessionListener({
  welinkSessionId: sessionId,
  onMessage,
  onError: (err) => {},
  onClose: (reason) => {}
});

sdk.onSessionStatusChange({
  welinkSessionId: sessionId,
  callback: (result) => {
    // result.status: executing/stopped/completed
  }
});

await sdk.sendMessage({
  welinkSessionId: sessionId,
  content: '请帮我创建一个 React 项目'
});
```

## 13 个接口与使用方法

### 1) `createSession(params)`
创建或复用会话，自动确保 WebSocket 已连接。

```ts
await sdk.createSession({ ak, title, imGroupId });
```

### 2) `closeSkill()`
仅关闭本地 WebSocket 和本地状态缓存，不删除服务端会话。

```ts
await sdk.closeSkill();
```

### 3) `stopSkill(params)`
中止当前轮执行。

```ts
await sdk.stopSkill({ welinkSessionId });
```

### 4) `onSessionStatusChange(params)`
监听会话状态三态。

```ts
sdk.onSessionStatusChange({
  welinkSessionId,
  callback: (result) => {}
});
```

### 5) `onSkillWecodeStatusChange(params)`
监听小程序状态 `closed/minimized`。

```ts
sdk.onSkillWecodeStatusChange({
  callback: (result) => {}
});
```

### 6) `regenerateAnswer(params)`
按最后一条用户消息重新生成。

```ts
await sdk.regenerateAnswer({ welinkSessionId });
```

### 7) `sendMessageToIM(params)`
发送最终消息到 IM。

```ts
await sdk.sendMessageToIM({ welinkSessionId, messageId });
```

### 8) `getSessionMessage(params)`
获取会话消息列表（历史 + 本地流式合并）。

```ts
const page = await sdk.getSessionMessage({ welinkSessionId, page: 0, size: 50 });
```

### 9) `registerSessionListener(params)`
注册流式监听器。同一个 `welinkSessionId` 只允许注册一次，重复注册会抛出 `4011`。

```ts
sdk.registerSessionListener({
  welinkSessionId,
  onMessage,
  onError,
  onClose
});
```

### 10) `unregisterSessionListener(params)`
按 `welinkSessionId` 移除该会话下当前注册的全部监听回调。

```ts
sdk.unregisterSessionListener({
  welinkSessionId
});
```

### 11) `sendMessage(params)`
发送用户消息。

```ts
await sdk.sendMessage({ welinkSessionId, content, toolCallId });
```

### 12) `replyPermission(params)`
权限确认：`once/always/reject`。

```ts
const params: ReplyPermissionParams = {
  welinkSessionId,
  permId,
  response: 'once'
};
await sdk.replyPermission(params);
```

### 13) `controlSkillWeCode(params)`
控制小程序状态。

```ts
await sdk.controlSkillWeCode({ action: SkillWeCodeAction.CLOSE });
await sdk.controlSkillWeCode({ action: SkillWeCodeAction.MINIMIZE });
```

## 错误处理

SDK 抛出 `SkillSdkException`：

```ts
try {
  await sdk.sendMessage({ welinkSessionId, content: 'hello' });
} catch (e) {
  const err = e as { errorCode?: number; errorMessage?: string };
  const code = err.errorCode;
  const message = err.errorMessage;
}
```

## 推荐调用顺序

1. `SkillSDK.getInstance(config)`
2. `createSession`
3. `registerSessionListener` + `onSessionStatusChange`
4. `sendMessage`
5. （按需）`replyPermission` / `getSessionMessage` / `regenerateAnswer`
6. （按需）`sendMessageToIM` / `stopSkill`
7. 页面销毁时 `unregisterSessionListener`
8. 退出时 `closeSkill` 或 `SkillSDK.destroyInstance()`
