# Skill SDK for iOS

iOS 平台的 Skill SDK，使用 Objective-C 开发，提供与 Skill 服务端的 WebSocket 和 HTTP API 交互能力。

## 功能特性

- ✅ 技能会话管理（创建、关闭、停止）
- ✅ 实时 AI 响应流式接收
- ✅ 多轮对话支持
- ✅ 权限确认处理
- ✅ 小程序控制
- ✅ 消息历史查询

## 系统要求

- iOS 12.0+
- Xcode 14.0+
- Objective-C

## 安装

### CocoaPods

在您的 `Podfile` 中添加：

```ruby
pod 'SkillSDK', '~> 1.0.0'
```

然后运行：

```bash
pod install
```

### 手动安装

将 `ios/Classes` 目录下的所有文件拖入您的 Xcode 项目中。

## 快速开始

### 1. 初始化 SDK

```objective-c
#import <SkillSDK/SkillSDK.h>

// 配置 SDK
SkillSDKConfig *config = [[SkillSDKConfig alloc] initWithBaseUrl:@"http://your-server.com:8080"
                                           skillDefinitionId:1];
config.webSocketHost = @"your-server.com:8082";

// 初始化 SDK
[[SkillSDK sharedSDK] initWithConfig:config];
```

### 2. 执行技能

```objective-c
[[SkillSDK sharedSDK] executeSkillWithImChatId:@"chat-123"
                                          userId:@"user-456"
                                    skillContent:@"请帮我重构登录模块"
                                         agentId:@99
                                           title:@"重构登录模块"
                               completionHandler:^(SkillExecuteSkillResult *result, NSError *error) {
    if (error) {
        NSLog(@"Error: %@", error);
        return;
    }
    
    NSString *sessionId = result.sessionId;
    NSLog(@"Session created: %@", sessionId);
    
    // 监听会话状态
    [[SkillSDK sharedSDK] onSessionStatusWithSessionId:sessionId callback:^(SkillSessionStatus status) {
        switch (status) {
            case SkillSessionStatusExecuting:
                NSLog(@"Executing...");
                break;
            case SkillSessionStatusCompleted:
                NSLog(@"Completed!");
                break;
            case SkillSessionStatusStopped:
                NSLog(@"Stopped!");
                break;
        }
    }];
}];
```

### 3. 发送消息

```objective-c
[[SkillSDK sharedSDK] sendMessageWithSessionId:sessionId
                                       content:@"请继续"
                                     onMessage:^(SkillStreamMessage *message) {
    if (message.type == SkillStreamMessageTypeDelta) {
        NSLog(@"Received delta: %@", message.content);
    } else if (message.type == SkillStreamMessageTypeDone) {
        NSLog(@"Done! Tokens: %ld/%ld", (long)message.usage.inputTokens, (long)message.usage.outputTokens);
    }
} completionHandler:^(SkillSendMessageResult *result, NSError *error) {
    if (error) {
        NSLog(@"Error: %@", error);
    }
}];
```

### 4. 获取历史消息

```objective-c
[[SkillSDK sharedSDK] getSessionMessageWithSessionId:sessionId
                                                page:0
                                                size:50
                                   completionHandler:^(SkillPageResult<SkillChatMessage *> *result, NSError *error) {
    if (error) {
        NSLog(@"Error: %@", error);
        return;
    }
    
    for (SkillChatMessage *msg in result.content) {
        NSString *role = msg.role == SkillMessageRoleUser ? @"User" : @"AI";
        NSLog(@"%@: %@", role, msg.content);
    }
}];
```

### 5. 关闭会话

```objective-c
[[SkillSDK sharedSDK] closeSkillWithSessionId:sessionId
                            completionHandler:^(SkillCloseSkillResult *result, NSError *error) {
    if (result.success) {
        NSLog(@"Session closed");
    }
}];
```

## API 参考

### 主要接口

| 方法 | 说明 |
|------|------|
| `initWithConfig:` | 初始化 SDK |
| `executeSkillWithImChatId:userId:skillContent:agentId:title:completionHandler:` | 执行技能，创建会话 |
| `closeSkillWithSessionId:completionHandler:` | 关闭会话 |
| `stopSkillWithSessionId:completionHandler:` | 停止当前响应（保持会话） |
| `sendMessageWithSessionId:content:onMessage:completionHandler:` | 发送消息 |
| `getSessionMessageWithSessionId:page:size:completionHandler:` | 获取历史消息 |
| `regenerateAnswerWithSessionId:completionHandler:` | 重新生成回答 |
| `sendMessageToIMWithSessionId:content:completionHandler:` | 发送消息到 IM |
| `replyPermissionWithSessionId:permissionId:approved:completionHandler:` | 回复权限确认 |
| `controlSkillWeCodeWithAction:completionHandler:` | 控制小程序 |
| `onSessionStatusWithSessionId:callback:` | 监听会话状态 |
| `onSkillWecodeStatusWithCallback:` | 监听小程序状态 |

### 数据类型

#### SkillSessionStatus（会话状态）

- `SkillSessionStatusExecuting` - 执行中
- `SkillSessionStatusStopped` - 已停止
- `SkillSessionStatusCompleted` - 已完成

#### SkillStreamMessageType（流式消息类型）

- `SkillStreamMessageTypeDelta` - 增量内容
- `SkillStreamMessageTypeDone` - 完成
- `SkillStreamMessageTypeError` - 错误
- `SkillStreamMessageTypeAgentOffline` - Agent 离线
- `SkillStreamMessageTypeAgentOnline` - Agent 上线

#### SkillMessageRole（消息角色）

- `SkillMessageRoleUser` - 用户
- `SkillMessageRoleAssistant` - AI
- `SkillMessageRoleSystem` - 系统
- `SkillMessageRoleTool` - 工具

## 错误处理

SDK 通过 NSError 返回错误信息，常见错误码：

- `400` - Bad Request（请求参数错误）
- `404` - Not Found（会话不存在）
- `409` - Conflict（会话已关闭）
- `500` - Internal Server Error（服务器错误）

## 示例项目

查看 `ios/Example` 目录获取完整示例。

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或联系开发团队。
