# Skill SDK for Android

基于 Java 21 和 OkHttp 的 Android Skill SDK，提供与 OpenCode Skill 服务端的完整交互能力。

## 功能特性

- **单例模式**：全局唯一实例，统一管理连接和状态
- **13 个公开接口**：完整覆盖技能执行、会话管理、消息收发等功能
- **WebSocket 流式推送**：实时接收 AI 响应流
- **流式消息缓存**：支持正在生成的内容与历史消息合并
- **线程安全**：所有异步操作均支持回调机制
- **JDK 21**：使用最新 Java 特性

## 环境要求

- Android SDK 24+ (Android 7.0)
- JDK 21
- Gradle 8.x

## 集成方式

### 1. 本地模块集成

在项目根目录的 `settings.gradle` 中添加：

```groovy
include ':skill-sdk'
project(':skill-sdk').projectDir = new File('path/to/skill-sdk')
```

在应用模块的 `build.gradle` 中添加依赖：

```groovy
dependencies {
    implementation project(':skill-sdk')
}
```

### 2. 依赖项

SDK 自动依赖以下库：

```groovy
implementation 'com.squareup.okhttp3:okhttp:4.12.0'
implementation 'com.google.code.gson:gson:2.10.1'
implementation 'androidx.annotation:annotation:1.7.1'
```

## 快速开始

### 1. 初始化 SDK

在 Application 的 `onCreate()` 中初始化：

```java
import com.opencode.skill.SkillSDK;
import com.opencode.skill.SkillSDKConfig;

public class MyApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        
        SkillSDKConfig config = new SkillSDKConfig.Builder()
                .baseUrl("http://your-server:8082")
                .connectTimeout(30000)
                .readTimeout(60000)
                .enableReconnect(true)
                .reconnectInterval(5000)
                .build();
        
        SkillSDK.getInstance().initialize(config);
    }
}
```

### 2. 执行技能

```java
import com.opencode.skill.SkillSDK;
import com.opencode.skill.model.ExecuteSkillParams;
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.callback.SkillCallback;

ExecuteSkillParams params = new ExecuteSkillParams.Builder()
        .imChatId("chat-789")
        .skillDefinitionId(1)
        .userId("user-1001")
        .skillContent("请帮我重构登录模块")
        .agentId(99L)          // 可选
        .title("重构登录模块")  // 可选
        .build();

SkillSDK.getInstance().executeSkill(params, new SkillCallback<SkillSession>() {
    @Override
    public void onSuccess(SkillSession session) {
        String sessionId = String.valueOf(session.getId());
        Log.d("SkillSDK", "会话创建成功: " + sessionId);
    }

    @Override
    public void onError(Throwable error) {
        Log.e("SkillSDK", "执行技能失败: " + error.getMessage());
    }
});
```

### 3. 注册消息监听器

```java
import com.opencode.skill.callback.SessionListener;
import com.opencode.skill.model.StreamMessage;
import com.opencode.skill.model.SessionError;

SessionListener listener = new SessionListener() {
    @Override
    public void onMessage(StreamMessage message) {
        switch (message.getType()) {
            case "delta":
                Log.d("SkillSDK", "AI响应片段: " + message.getContentAsString());
                break;
            case "done":
                Log.d("SkillSDK", "AI处理完成");
                break;
            case "error":
                Log.e("SkillSDK", "处理错误: " + message.getContentAsString());
                break;
            case "agent_offline":
                Log.w("SkillSDK", "Agent离线");
                break;
        }
    }

    @Override
    public void onError(SessionError error) {
        Log.e("SkillSDK", "连接错误: " + error.getMessage());
    }

    @Override
    public void onClose(String reason) {
        Log.d("SkillSDK", "连接关闭: " + reason);
    }
};

SkillSDK.getInstance().registerSessionListener(sessionId, listener);
```

### 4. 发送消息

```java
SkillSDK.getInstance().sendMessage(sessionId, "请继续分析", new SkillCallback<SendMessageResult>() {
    @Override
    public void onSuccess(SendMessageResult result) {
        Log.d("SkillSDK", "消息发送成功，消息ID: " + result.getMessageId());
    }

    @Override
    public void onError(Throwable error) {
        Log.e("SkillSDK", "发送消息失败: " + error.getMessage());
    }
});
```

### 5. 获取消息历史

```java
SkillSDK.getInstance().getSessionMessage(sessionId, 0, 50, new SkillCallback<PageResult<ChatMessage>>() {
    @Override
    public void onSuccess(PageResult<ChatMessage> result) {
        for (ChatMessage message : result.getContent()) {
            Log.d("SkillSDK", "[" + message.getRole() + "] " + message.getContent());
        }
    }

    @Override
    public void onError(Throwable error) {
        Log.e("SkillSDK", "获取消息失败: " + error.getMessage());
    }
});
```

### 6. 关闭会话

```java
SkillSDK.getInstance().closeSkill(sessionId, new SkillCallback<CloseSkillResult>() {
    @Override
    public void onSuccess(CloseSkillResult result) {
        Log.d("SkillSDK", "会话已关闭");
    }

    @Override
    public void onError(Throwable error) {
        Log.e("SkillSDK", "关闭会话失败: " + error.getMessage());
    }
});
```

## API 接口列表

| # | 接口名 | 说明 | 同步版本 |
|---|--------|------|----------|
| 1 | `executeSkill()` | 执行技能，创建会话并发送首条消息 | `executeSkillSync()` |
| 2 | `closeSkill()` | 关闭会话 | `closeSkillSync()` |
| 3 | `stopSkill()` | 停止会话（保持连接） | - |
| 4 | `onSessionStatusChange()` | 注册会话状态变更回调 | - |
| 5 | `onSkillWecodeStatusChange()` | 注册小程序状态变更回调 | - |
| 6 | `regenerateAnswer()` | 重新生成回答 | - |
| 7 | `sendMessageToIM()` | 发送消息到 IM | - |
| 8 | `getSessionMessage()` | 获取会话消息历史 | `getSessionMessageSync()` |
| 9 | `registerSessionListener()` | 注册会话消息监听器 | - |
| 10 | `unregisterSessionListener()` | 移除会话消息监听器 | - |
| 11 | `sendMessage()` | 发送消息 | `sendMessageSync()` |
| 12 | `replyPermission()` | 回复权限确认 | - |
| 13 | `controlSkillWeCode()` | 控制小程序状态 | - |

## 数据模型

### SkillSession

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | long | 会话ID |
| `userId` | long | 用户ID |
| `skillDefinitionId` | long | 技能定义ID |
| `agentId` | Long | Agent ID |
| `title` | String | 会话标题 |
| `status` | String | 会话状态 |
| `createdAt` | String | 创建时间 |

### ChatMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | long | 消息ID |
| `sessionId` | long | 会话ID |
| `seq` | int | 消息序号 |
| `role` | String | 角色（USER/ASSISTANT/SYSTEM/TOOL） |
| `content` | String | 消息内容 |
| `contentType` | String | 内容类型（MARKDOWN/CODE/PLAIN） |
| `createdAt` | String | 创建时间 |

### StreamMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| `sessionId` | String | 会话ID |
| `type` | String | 消息类型（delta/done/error/agent_offline/agent_online） |
| `seq` | long | 序列号 |
| `content` | Object | 消息内容 |

## 状态枚举

### SessionStatus

| 值 | 说明 |
|----|------|
| `EXECUTING` | 执行中 |
| `STOPPED` | 已停止 |
| `COMPLETED` | 已完成 |

### SkillWecodeStatus

| 值 | 说明 |
|----|------|
| `CLOSED` | 已关闭 |
| `MINIMIZED` | 已最小化 |

### SkillWeCodeAction

| 值 | 说明 |
|----|------|
| `CLOSE` | 关闭 |
| `MINIMIZE` | 最小化 |

## 完整示例

```java
import com.opencode.skill.SkillSDK;
import com.opencode.skill.SkillSDKConfig;
import com.opencode.skill.model.*;
import com.opencode.skill.callback.*;
import com.opencode.skill.constant.*;

public class SkillDemo {
    
    private SkillSDK sdk;
    private String currentSessionId;
    private SessionListener messageListener;
    
    public void init() {
        SkillSDKConfig config = new SkillSDKConfig.Builder()
                .baseUrl("http://192.168.1.100:8082")
                .build();
        
        sdk = SkillSDK.getInstance();
        sdk.initialize(config);
    }
    
    public void startSkill() {
        ExecuteSkillParams params = new ExecuteSkillParams.Builder()
                .imChatId("chat-001")
                .skillDefinitionId(1)
                .userId("user-001")
                .skillContent("帮我写一个登录页面")
                .build();
        
        sdk.executeSkill(params, new SkillCallback<SkillSession>() {
            @Override
            public void onSuccess(SkillSession session) {
                currentSessionId = String.valueOf(session.getId());
                setupListeners();
            }

            @Override
            public void onError(Throwable error) {
                Log.e("SkillDemo", "Failed: " + error.getMessage());
            }
        });
    }
    
    private void setupListeners() {
        // 消息监听器
        messageListener = new SessionListener() {
            @Override
            public void onMessage(StreamMessage message) {
                if ("delta".equals(message.getType())) {
                    updateUI(message.getContentAsString());
                } else if ("done".equals(message.getType())) {
                    hideLoading();
                }
            }

            @Override
            public void onError(SessionError error) {
                showError(error.getMessage());
            }

            @Override
            public void onClose(String reason) {
                Log.d("SkillDemo", "Closed: " + reason);
            }
        };
        
        sdk.registerSessionListener(currentSessionId, messageListener);
        
        // 状态监听器
        sdk.onSessionStatusChange(currentSessionId, new SessionStatusCallback() {
            @Override
            public void onStatusChange(String sessionId, String status) {
                Log.d("SkillDemo", "Status: " + status);
            }

            @Override
            public void onError(String sessionId, SessionError error) {
                Log.e("SkillDemo", "Error: " + error.getMessage());
            }
        });
    }
    
    public void sendMessage(String content) {
        sdk.sendMessage(currentSessionId, content, new SkillCallback<SendMessageResult>() {
            @Override
            public void onSuccess(SendMessageResult result) {
                Log.d("SkillDemo", "Sent: " + result.getMessageId());
            }

            @Override
            public void onError(Throwable error) {
                Log.e("SkillDemo", "Send failed: " + error.getMessage());
            }
        });
    }
    
    public void close() {
        if (currentSessionId != null && messageListener != null) {
            sdk.unregisterSessionListener(currentSessionId, messageListener);
            sdk.closeSkill(currentSessionId, new SkillCallback<CloseSkillResult>() {
                @Override
                public void onSuccess(CloseSkillResult result) {
                    Log.d("SkillDemo", "Session closed");
                }

                @Override
                public void onError(Throwable error) {
                    Log.e("SkillDemo", "Close failed: " + error.getMessage());
                }
            });
        }
    }
    
    public void destroy() {
        sdk.shutdown();
    }
}
```

## 错误处理

SDK 通过 `SkillCallback.onError()` 回调所有错误，包括：

- **网络错误**：连接超时、网络不可用等
- **API 错误**：服务端返回的错误（404、409 等）
- **解析错误**：JSON 解析失败

错误对象 `SessionError` 包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | String | 错误码 |
| `message` | String | 错误描述 |
| `timestamp` | long | 时间戳 |

## ProGuard 配置

SDK 已包含 ProGuard 规则，无需额外配置。如需自定义，参考 `consumer-rules.pro`。

## 注意事项

1. **权限**：确保 AndroidManifest.xml 中声明了网络权限
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   ```

2. **主线程回调**：所有回调默认在后台线程执行，UI 操作需切换到主线程

3. **生命周期**：建议在 Application 中初始化，在 Activity/Fragment 中管理监听器

4. **内存泄漏**：及时调用 `unregisterSessionListener()` 移除不再需要的监听器

## 版本历史

### v1.0.0 (2026-03-07)
- 初始版本
- 实现 13 个公开接口
- 支持 WebSocket 流式推送
- 支持流式消息缓存

## 许可证

Copyright © 2026 OpenCode