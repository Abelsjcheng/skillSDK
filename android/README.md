# Android Skill SDK 使用说明

## 工程位置
- SDK 模块：`android/skill-sdk`
- 包名：`com.opencode.skill`
- 最低版本：Android 7.0 (minSdk 24)
- 主要依赖：OkHttp、Gson

## 快速接入

### 1. 引入模块
在宿主工程 `settings.gradle` 中包含模块（若同仓库开发）：

```gradle
include ':skill-sdk'
project(':skill-sdk').projectDir = file('android/skill-sdk')
```

在 App `build.gradle`：

```gradle
dependencies {
  implementation project(':skill-sdk')
}
```

### 2. 初始化 SDK
```java
import com.opencode.skill.SkillSDK;
import com.opencode.skill.SkillSDKConfig;

SkillSDK sdk = SkillSDK.getInstance();
SkillSDKConfig config = new SkillSDKConfig.Builder()
    .baseUrl("http://127.0.0.1:8082")
    .enableReconnect(true)
    .build();
sdk.initialize(config);
```

## 最小调用链路示例

```java
SkillSDK sdk = SkillSDK.getInstance();

sdk.createSession(
    new CreateSessionParams("ak_xxxxxxxx", "Android示例会话", "group_abc123"),
    new SkillCallback<SkillSession>() {
      @Override
      public void onSuccess(SkillSession session) {
        long sessionId = session.getWelinkSessionId();

        SessionMessageCallback onMessage = message -> {
          // 处理 text.delta / tool.update / permission.ask 等流式事件
        };

        sdk.registerSessionListener(
            new RegisterSessionListenerParams(sessionId, onMessage, null, null)
        );

        sdk.sendMessage(
            new SendMessageParams(sessionId, "请帮我创建一个 React 项目", null),
            new SkillCallback<SendMessageResult>() {
              @Override
              public void onSuccess(SendMessageResult result) {
              }

              @Override
              public void onError(Throwable error) {
              }
            }
        );
      }

      @Override
      public void onError(Throwable error) {
      }
    }
);
```

## 13 个接口与使用方法

### 1) `createSession`
创建或复用会话，并确保 WebSocket 建连。

```java
sdk.createSession(new CreateSessionParams(ak, title, imGroupId), callback);
```

### 2) `closeSkill`
仅关闭本地 WebSocket 与监听器缓存，不删除服务端会话。

```java
sdk.closeSkill(new SkillCallback<CloseSkillResult>() { ... });
```

### 3) `stopSkill`
中止当前轮执行，会话可继续发送新消息。

```java
sdk.stopSkill(new StopSkillParams(welinkSessionId), new SkillCallback<StopSkillResult>() { ... });
```

### 4) `onSessionStatusChange`
监听 `executing/stopped/completed` 三态。

```java
sdk.onSessionStatusChange(
    new OnSessionStatusChangeParams(welinkSessionId, result -> {
      // result.getStatus()
    })
);
```

### 5) `onSkillWecodeStatusChange`
监听小程序状态 `closed/minimized`。

```java
sdk.onSkillWecodeStatusChange(
    new OnSkillWecodeStatusChangeParams(result -> {
      // result.getStatus()
    })
);
```

### 6) `regenerateAnswer`
按最后一条用户消息重新生成。

```java
sdk.regenerateAnswer(new RegenerateAnswerParams(welinkSessionId), new SkillCallback<SendMessageResult>() { ... });
```

### 7) `sendMessageToIM`
将最终消息内容发送到 IM。

```java
sdk.sendMessageToIM(
    new SendMessageToIMParams(welinkSessionId, null),
    new SkillCallback<SendMessageToIMResult>() { ... }
);
```

### 8) `getSessionMessage`
获取会话消息列表（服务端历史 + 本地流式缓存合并）。

```java
sdk.getSessionMessage(
    new GetSessionMessageParams(welinkSessionId, 0, 50),
    new SkillCallback<PageResult<SessionMessage>>() { ... }
);
```

### 9) `registerSessionListener`
注册流式消息监听器。同一个 `welinkSessionId` 只允许注册一次，重复注册会抛出 `4011`。

```java
SessionMessageCallback onMessage = message -> {};
SessionErrorCallback onError = error -> {};
SessionCloseCallback onClose = reason -> {};

sdk.registerSessionListener(
    new RegisterSessionListenerParams(welinkSessionId, onMessage, onError, onClose)
);
```

### 10) `unregisterSessionListener`
按 `welinkSessionId` 移除该会话下当前注册的全部监听回调。

```java
sdk.unregisterSessionListener(
    new UnregisterSessionListenerParams(welinkSessionId)
);
```

### 11) `sendMessage`
发送用户消息，触发新一轮 AI。

```java
sdk.sendMessage(
    new SendMessageParams(welinkSessionId, "请继续", null),
    new SkillCallback<SendMessageResult>() { ... }
);
```

### 12) `replyPermission`
回复权限请求：`once/always/reject`。

```java
sdk.replyPermission(
    new ReplyPermissionParams(welinkSessionId, permId, "once"),
    new SkillCallback<ReplyPermissionResult>() { ... }
);
```

### 13) `controlSkillWeCode`
控制小程序关闭或最小化。

```java
sdk.controlSkillWeCode(
    new ControlSkillWeCodeParams(SkillWeCodeAction.CLOSE),
    new SkillCallback<ControlSkillWeCodeResult>() { ... }
);
```

## 错误处理

SDK 错误通常是 `SkillSdkException`：

```java
@Override
public void onError(Throwable error) {
  if (error instanceof SkillSdkException) {
    SkillSdkException e = (SkillSdkException) error;
    int code = e.getErrorCode();
    String message = e.getErrorMessage();
  }
}
```

## 推荐调用顺序

1. `initialize`
2. `createSession`
3. `registerSessionListener` + `onSessionStatusChange`
4. `sendMessage`
5. （按需）`replyPermission` / `getSessionMessage` / `regenerateAnswer`
6. （按需）`sendMessageToIM` / `stopSkill`
7. 页面销毁时 `unregisterSessionListener`
8. 退出场景调用 `closeSkill`
