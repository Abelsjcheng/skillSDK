# Skill SDK for iOS

## 简介

Skill SDK 是一个为 iOS 应用提供的技能执行 SDK，支持技能执行、会话管理、消息发送等核心功能。

## 环境要求

- iOS 11.0+
- Xcode 12.0+
- CocoaPods 1.10+

## 安装

### 使用 CocoaPods

1. 在项目的 Podfile 中添加：

```ruby
platform :ios, '11.0'

target 'YourApp' do
  use_frameworks!
  
  pod 'SkillSDK', :path => './ios/SkillSDK'
  
  # 或者直接使用本地路径
  # pod 'SkillSDK', :path => '../SkillSDK/ios'
end
```

2. 安装依赖：

```bash
cd ios/SkillSDK
pod install
```

3. 在项目中导入：

```objective-c
#import <SkillSDK/SkillSDK.h>
```

## 快速开始

### 1. 初始化 SDK

```objective-c
#import <SkillSDK/SkillSDK.h>

// 在 AppDelegate 中初始化
[[SkillSDK sharedInstance] configureWithBaseURL:@"https://your-server.com" 
                                           wsURL:@"ws://your-server.com:8082"];
```

### 2. 执行技能

```objective-c
[[SkillSDK sharedInstance] executeSkillWithImChatId:@"chat-789"
                                    skillDefinitionId:1
                                             userId:@"user-1001"
                                       skillContent:@"请帮我重构登录模块"
                                            agentId:99
                                              title:@"重构登录模块"
                                         completion:^(SkillSession *session, NSError *error) {
    if (error) {
        NSLog(@"执行技能失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"会话创建成功，会话ID: %ld", (long)session.sessionId);
    NSLog(@"会话状态：%@", [SkillSession stringFromStatus:session.status]);
}];
```

### 3. 注册会话监听器

```objective-c
[[SkillSDK sharedInstance] registerSessionListenerWithSessionId:@"42"
                                                       onMessage:^(StreamMessage *message) {
    switch (message.type) {
        case StreamMessageTypeDelta:
            NSLog(@"AI 响应片段：%@", message.content);
            break;
        case StreamMessageTypeDone:
            NSLog(@"AI 处理完成");
            break;
        case StreamMessageTypeError:
            NSLog(@"处理错误：%@", message.content);
            break;
        case StreamMessageTypeAgentOffline:
            NSLog(@"Agent 离线");
            break;
        case StreamMessageTypeAgentOnline:
            NSLog(@"Agent 上线");
            break;
    }
} onError:^(NSError *error) {
    NSLog(@"连接错误：%@", error.localizedDescription);
} onClose:^(NSString *reason) {
    NSLog(@"连接关闭：%@", reason);
}];
```

### 4. 发送消息

```objective-c
[[SkillSDK sharedInstance] sendMessageWithSessionId:@"42"
                                            content:@"请继续分析"
                                         completion:^(SkillMessage *message, NSError *error) {
    if (error) {
        NSLog(@"发送消息失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"消息发送成功，消息ID: %ld", (long)message.messageId);
}];
```

### 5. 获取会话消息列表

```objective-c
[[SkillSDK sharedInstance] getSessionMessageWithSessionId:@"42"
                                                     page:0
                                                     size:50
                                               completion:^(NSDictionary *result, NSError *error) {
    if (error) {
        NSLog(@"获取消息失败：%@", error.localizedDescription);
        return;
    }
    
    NSArray *content = result[@"content"];
    NSLog(@"总消息数：%@", result[@"totalElements"]);
    
    for (NSDictionary *msgDict in content) {
        SkillMessage *msg = [[SkillMessage alloc] initWithDictionary:msgDict];
        NSLog(@"[%@] %@", [SkillMessage stringFromRole:msg.role], msg.content);
    }
}];
```

### 6. 关闭会话

```objective-c
[[SkillSDK sharedInstance] closeSkillWithSessionId:@"42"
                                        completion:^(NSDictionary *result, NSError *error) {
    if (error) {
        NSLog(@"关闭会话失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"会话已关闭，状态：%@", result[@"status"]);
}];
```

### 7. 重新生成回答

```objective-c
[[SkillSDK sharedInstance] regenerateAnswerWithSessionId:@"42"
                                                 content:@"请重新分析这个问题"
                                              completion:^(SkillMessage *message, NSError *error) {
    if (error) {
        NSLog(@"重新生成失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"重新生成已启动，消息ID: %ld", (long)message.messageId);
}];
```

### 8. 发送消息到 IM

```objective-c
[[SkillSDK sharedInstance] sendMessageToIMWithSessionId:@"42"
                                                content:@"代码重构已完成"
                                             completion:^(NSDictionary *result, NSError *error) {
    if (error) {
        NSLog(@"发送到 IM 失败：%@", error.localizedDescription);
        return;
    }
    
    if ([result[@"success"] boolValue]) {
        NSLog(@"已发送到 IM，聊天ID: %@", result[@"chatId"]);
    }
}];
```

### 9. 回复权限请求

```objective-c
[[SkillSDK sharedInstance] replyPermissionWithSessionId:@"42"
                                           permissionId:@"p-abc123"
                                               approved:YES
                                             completion:^(NSDictionary *result, NSError *error) {
    if (error) {
        NSLog(@"回复权限失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"权限回复成功，已批准：%@", result[@"approved"]);
}];
```

### 10. 控制小程序

```objective-c
// 关闭小程序
[[SkillSDK sharedInstance] controlSkillWeCodeWithAction:SkillWeCodeActionClose
                                             completion:^(NSDictionary *result, NSError *error) {
    if (error) {
        NSLog(@"关闭小程序失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"小程序已关闭");
}];

// 最小化小程序
[[SkillSDK sharedInstance] controlSkillWeCodeWithAction:SkillWeCodeActionMinimize
                                             completion:^(NSDictionary *result, NSError *error) {
    if (error) {
        NSLog(@"最小化小程序失败：%@", error.localizedDescription);
        return;
    }
    
    NSLog(@"小程序已最小化");
}];
```

## 完整使用示例

```objective-c
#import <SkillSDK/SkillSDK.h>

@interface ViewController ()
@property (nonatomic, strong) NSString *sessionId;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    // 初始化 SDK
    [[SkillSDK sharedInstance] configureWithBaseURL:@"https://your-server.com"
                                              wsURL:@"ws://your-server.com:8082"];
}

- (void)startSkillSession {
    // 执行技能
    [[SkillSDK sharedInstance] executeSkillWithImChatId:@"chat-789"
                                        skillDefinitionId:1
                                                 userId:@"user-1001"
                                           skillContent:@"请帮我分析代码"
                                                agentId:99
                                                  title:@"代码分析"
                                             completion:^(SkillSession *session, NSError *error) {
        if (error) {
            NSLog(@"执行技能失败：%@", error.localizedDescription);
            return;
        }
        
        self.sessionId = [NSString stringWithFormat:@"%@", @(session.sessionId)];
        NSLog(@"会话创建成功：%@", self.sessionId);
        
        // 注册监听器
        [self registerListener];
    }];
}

- (void)registerListener {
    [[SkillSDK sharedInstance] registerSessionListenerWithSessionId:self.sessionId
                                                           onMessage:^(StreamMessage *message) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (message.type == StreamMessageTypeDelta) {
                [self appendToChat:message.content];
            } else if (message.type == StreamMessageTypeDone) {
                [self hideLoading];
            }
        });
    } onError:^(NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self showError:error.localizedDescription];
        });
    } onClose:^(NSString *reason) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSLog(@"连接关闭：%@", reason);
        });
    }];
}

- (void)appendToChat:(NSString *)text {
    // 更新 UI
}

- (void)hideLoading {
    // 隐藏加载指示器
}

- (void)showError:(NSString *)message {
    // 显示错误信息
}

- (void)viewWillDisappear:(BOOL)animated {
    [super viewWillDisappear:animated];
    
    // 清理资源
    [[SkillSDK sharedInstance] unregisterSessionListenerWithSessionId:self.sessionId
                                                             onMessage:nil
                                                               onError:nil
                                                               onClose:nil];
}

@end
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 1001 | SDK 未配置，请先调用 configureWithBaseURL |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 1002 | WebSocket 连接失败 |
| 1003 | 会话不存在 |
| 1004 | 会话已关闭 |

## 注意事项

1. **线程安全**：SDK 内部使用串行队列处理请求，回调会在主线程执行
2. **内存管理**：使用 weak 引用避免循环引用
3. **资源清理**：页面消失时记得调用 unregisterSessionListener 移除监听器
4. **网络状态**：SDK 会自动处理网络错误，但建议在无网络时提示用户
5. **WebSocket 重连**：WebSocket 断开后会自动尝试重连

## 构建项目

```bash
cd ios/SkillSDK
pod install
xcodebuild -workspace SkillSDK.xcworkspace -scheme SkillSDK -configuration Debug build
```

## 运行测试

```bash
cd ios/SkillSDK
xcodebuild -workspace SkillSDK.xcworkspace -scheme SkillSDKTests test
```

## 许可证

MIT License

## 联系方式

- GitHub: https://github.com/opencode/skill-sdk
- Email: support@opencode.com
