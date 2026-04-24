# 2026-04-24 Streaming Message Cache Backup

## 背景

在 2026-04-24 之前，Android、Harmony、iOS 三端 SDK 都在处理 WebSocket `onmessage` 回调时维护本地“流式消息缓存”。

该缓存用于承接 WebSocket 增量消息，并被以下接口复用：

- `getSessionMessage`
- `getSessionMessageHistory`
- `regenerateAnswer`
- `sendMessageToIM`
- `sendMessage`
- `closeSkill` / `shutdown` / `destroyInstance`

本次代码调整会删除当前版本中的流式缓存实现。为避免后续需要回退时丢失上下文，先将旧方案记录如下。

## 旧方案概览

### Android

相关文件：

- `android/skill-sdk/src/main/java/com/opencode/skill/SkillSDK.java`
- `android/skill-sdk/src/main/java/com/opencode/skill/network/StreamingMessageCache.java`

旧链路：

1. `SkillSDK` 注册 `WebSocketManager.InternalListener`
2. WebSocket 收到 `StreamMessage` 后调用 `streamingMessageCache.ingestStreamMessage(message)`
3. 同时触发会话状态流转 `emitSessionStatusByEvent(message)`
4. `getSessionMessage` 在 `isFirst=true` 时，会把服务端返回消息与本地缓存做 merge
5. `getSessionMessageHistory` 会把服务端历史写入本地缓存
6. `regenerateAnswer` 先从本地缓存读取最后一条用户消息，缓存无命中时再请求服务端并回填缓存
7. `sendMessageToIM` 先从本地缓存读取已完成消息内容，缓存无命中时再请求服务端并回填缓存
8. `sendMessage` 成功后会调用 `streamingMessageCache.recordUserMessage(result)` 写入本地缓存
9. `closeSkill` / `shutdown` 时清空缓存

### Harmony

相关文件：

- `harmony/src/main/ets/sdk/SkillSDK.ets`
- `harmony/src/main/ets/sdk/managers/MessageCacheManager.ets`

旧链路：

1. `SkillSDK` 初始化时创建 `MessageCacheManager`
2. `wsManager.setMessageHandler` 收到 `StreamMessage` 后，先调用 `messageCacheManager.onStreamMessage(message)`
3. 同时调用 `sessionStateManager.onStreamMessage(message)`
4. `getSessionMessage` 会把服务端消息写入缓存，并在 `isFirst=true` 时把本地最新消息插入首屏结果
5. `getSessionMessageHistory` 会把服务端历史写入缓存
6. `regenerateAnswer` 先从缓存取最后一条用户消息，缓存无命中时再请求服务端并回填缓存
7. `sendMessageToIM` 先从缓存取已完成消息内容，缓存无命中时再请求服务端并回填缓存
8. `sendMessage` 成功后会调用 `messageCacheManager.cacheSentUserMessage(result)`
9. `closeSkill` / `destroyInstance` 时清空缓存

### iOS

相关文件：

- `ios/WLAgentSkillsSDK/Classes/Managers/WLAgentSkillsSDK.m`
- `ios/WLAgentSkillsSDK/Classes/Managers/WLAgentSkillsStreamingCache.h`
- `ios/WLAgentSkillsSDK/Classes/Managers/WLAgentSkillsStreamingCache.m`

旧链路：

1. `WLAgentSkillsSDK` 作为 `WLAgentSkillsWebSocketManagerDelegate`
2. `webSocketManagerDidReceiveMessage:` 收到 `WLAgentSkillsStreamMessage` 后调用 `[[WLAgentSkillsStreamingCache sharedCache] updateWithStreamMessage:message]`
3. 同时继续做会话状态流转
4. `getSessionMessage` 在 `isFirst=true` 时会把服务端结果与本地最新消息 merge
5. `getSessionMessageHistory` 会把服务端历史写入缓存
6. `regenerateAnswer` 先从缓存取最后一条用户消息，缓存无命中时再请求服务端并回填缓存
7. `sendMessageToIM` 先从缓存取已完成消息内容，缓存无命中时再请求服务端并回填缓存
8. `sendMessage` 成功后会调用 `cacheSendMessageResult:`
9. `closeSkill` 时清空缓存

## 删除后的目标行为

删除流式缓存后，三端统一调整为：

- WebSocket 消息只负责回调分发与状态流转，不再写本地流式缓存
- `getSessionMessage` / `getSessionMessageHistory` 只返回服务端结果
- `regenerateAnswer` 直接基于服务端消息列表查找最后一条用户消息
- `sendMessageToIM` 直接基于服务端消息列表查找可发送内容
- `sendMessage` 不再写入本地消息缓存
- `closeSkill` / `shutdown` / `destroyInstance` 不再做流式缓存清理

