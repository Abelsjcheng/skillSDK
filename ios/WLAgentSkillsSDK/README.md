# WLAgentSkillsSDK iOS 接入说明

## 1. SDK 说明
`WLAgentSkillsSDK` 是 Skill 客户端 iOS SDK，使用 Objective-C 实现，网络层基于 `AFNetworking`，并通过 WebSocket 接收流式事件。

SDK 为单例，对外暴露 13 个接口：

1. `createSession`
2. `closeSkill`
3. `stopSkill`
4. `onSessionStatusChange`
5. `onSkillWecodeStatusChange`
6. `regenerateAnswer`
7. `sendMessageToIM`
8. `getSessionMessage`
9. `registerSessionListener`
10. `unregisterSessionListener`
11. `sendMessage`
12. `replyPermission`
13. `controlSkillWeCode`

## 2. 依赖安装

### 2.1 Podfile 示例
```ruby
platform :ios, '12.0'
use_frameworks!

target 'YourApp' do
  pod 'WLAgentSkillsSDK', :path => 'ios/WLAgentSkillsSDK'
end
```

### 2.2 安装
```bash
pod install
```

## 3. 最小可运行接入示例（Objective-C）

下面示例可直接放到 `ViewController.m`（或业务控制器）中运行。

```objective-c
#import "ViewController.h"
#import <WLAgentSkillsSDK/WLAgentSkillsSDKPublic.h>

@interface ViewController ()

@property (nonatomic, strong, nullable) NSNumber *currentSessionId;
@property (nonatomic, copy) WLAgentSkillsSessionMessageCallback onMessageBlock;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionErrorCallback onErrorBlock;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionCloseCallback onCloseBlock;

@end

@implementation ViewController

- (void)viewDidLoad {
  [super viewDidLoad];

  // 1) 初始化 SDK
  [WLAgentSkillsSDK configureWithBaseURL:@"http://127.0.0.1:8082"];

  // 2) 可选：监听小程序状态
  WLAgentSkillsOnSkillWecodeStatusChangeParams *wecodeParams = [[WLAgentSkillsOnSkillWecodeStatusChangeParams alloc] init];
  wecodeParams.callback = ^(WLAgentSkillsSkillWecodeStatusResult * _Nonnull result) {
    NSLog(@"[SkillWecodeStatus] status=%ld", (long)result.status);
  };
  [[WLAgentSkillsSDK sharedInstance] onSkillWecodeStatusChange:wecodeParams];

  // 3) 启动最小流程
  [self startSkillFlow];
}

- (void)startSkillFlow {
  WLAgentSkillsCreateSessionParams *params = [[WLAgentSkillsCreateSessionParams alloc] init];
  params.ak = @"ak_xxxxxxxx";
  params.title = @"iOS最小接入示例";
  params.imGroupId = @"group_abc123";

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsSDK sharedInstance] createSession:params
                                           success:^(WLAgentSkillsSkillSession * _Nonnull session) {
    __strong typeof(weakSelf) self = weakSelf;
    if (!self) { return; }

    self.currentSessionId = session.welinkSessionId;
    NSLog(@"createSession success, welinkSessionId=%@", session.welinkSessionId);

    [self registerSessionCallbacks];
    [self sendFirstMessage];
  }
                                           failure:^(NSError * _Nonnull error) {
    [weakSelf logSDKError:error prefix:@"createSession failed"];
  }];
}

- (void)registerSessionCallbacks {
  if (self.currentSessionId == nil) { return; }

  // A. 会话状态监听
  WLAgentSkillsOnSessionStatusChangeParams *statusParams = [[WLAgentSkillsOnSessionStatusChangeParams alloc] init];
  statusParams.welinkSessionId = self.currentSessionId;
  statusParams.callback = ^(WLAgentSkillsSessionStatusResult * _Nonnull result) {
    NSLog(@"[SessionStatus] %ld", (long)result.status);
  };
  [[WLAgentSkillsSDK sharedInstance] onSessionStatusChange:statusParams];

  // B. 流式消息监听（注意：为后续 unregister，必须持有同一 block 实例）
  self.onMessageBlock = ^(WLAgentSkillsStreamMessage * _Nonnull message) {
    NSLog(@"[Stream] type=%@ session=%@ msgId=%@ content=%@", message.type, message.welinkSessionId, message.messageId, message.content);

    // 示例：如果出现权限请求，自动单次同意（生产环境请接 UI 让用户确认）
    if ([message.type isEqualToString:@"permission.ask"] && message.permissionId.length > 0) {
      WLAgentSkillsReplyPermissionParams *permissionParams = [[WLAgentSkillsReplyPermissionParams alloc] init];
      permissionParams.welinkSessionId = @([message.welinkSessionId longLongValue]);
      permissionParams.permId = message.permissionId;
      permissionParams.response = @"once";
      [[WLAgentSkillsSDK sharedInstance] replyPermission:permissionParams
                                                 success:^(WLAgentSkillsReplyPermissionResult * _Nonnull result) {
        NSLog(@"replyPermission success: %@", result.response);
      }
                                                 failure:^(NSError * _Nonnull error) {
        NSLog(@"replyPermission failed: %@", error.localizedDescription);
      }];
    }
  };

  self.onErrorBlock = ^(WLAgentSkillsSessionError * _Nonnull error) {
    NSLog(@"[StreamError] code=%@ message=%@", error.code, error.message);
  };

  self.onCloseBlock = ^(NSString * _Nonnull reason) {
    NSLog(@"[StreamClose] reason=%@", reason);
  };

  WLAgentSkillsRegisterSessionListenerParams *listenerParams = [[WLAgentSkillsRegisterSessionListenerParams alloc] init];
  listenerParams.welinkSessionId = self.currentSessionId;
  listenerParams.onMessage = self.onMessageBlock;
  listenerParams.onError = self.onErrorBlock;
  listenerParams.onClose = self.onCloseBlock;
  [[WLAgentSkillsSDK sharedInstance] registerSessionListener:listenerParams];
}

- (void)sendFirstMessage {
  if (self.currentSessionId == nil) { return; }

  WLAgentSkillsSendMessageParams *messageParams = [[WLAgentSkillsSendMessageParams alloc] init];
  messageParams.welinkSessionId = self.currentSessionId;
  messageParams.content = @"请帮我创建一个 React 项目";

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsSDK sharedInstance] sendMessage:messageParams
                                         success:^(WLAgentSkillsSendMessageResult * _Nonnull result) {
    NSLog(@"sendMessage success, id=%@ seq=%@", result.messageId, result.messageSeq);

    // 示例：拉取会话消息（历史+本地流式合并）
    [weakSelf fetchSessionMessages];
  }
                                         failure:^(NSError * _Nonnull error) {
    [weakSelf logSDKError:error prefix:@"sendMessage failed"];
  }];
}

- (void)fetchSessionMessages {
  if (self.currentSessionId == nil) { return; }

  WLAgentSkillsGetSessionMessageParams *params = [[WLAgentSkillsGetSessionMessageParams alloc] init];
  params.welinkSessionId = self.currentSessionId;
  params.page = @0;
  params.size = @50;

  [[WLAgentSkillsSDK sharedInstance] getSessionMessage:params
                                               success:^(WLAgentSkillsPageResult * _Nonnull result) {
    NSLog(@"getSessionMessage total=%@ page=%@ size=%@", result.total, result.page, result.size);
  }
                                               failure:^(NSError * _Nonnull error) {
    NSLog(@"getSessionMessage failed: %@", error.localizedDescription);
  }];
}

- (void)sendLastResultToIM {
  if (self.currentSessionId == nil) { return; }

  WLAgentSkillsSendMessageToIMParams *params = [[WLAgentSkillsSendMessageToIMParams alloc] init];
  params.welinkSessionId = self.currentSessionId;
  // params.messageId 可选，不传则发送当前会话最后一条已完成消息

  [[WLAgentSkillsSDK sharedInstance] sendMessageToIM:params
                                             success:^(WLAgentSkillsSendMessageToIMResult * _Nonnull result) {
    NSLog(@"sendMessageToIM status=%@ chatId=%@", result.status, result.chatId);
  }
                                             failure:^(NSError * _Nonnull error) {
    NSLog(@"sendMessageToIM failed: %@", error.localizedDescription);
  }];
}

- (void)stopCurrentSkill {
  if (self.currentSessionId == nil) { return; }

  WLAgentSkillsStopSkillParams *params = [[WLAgentSkillsStopSkillParams alloc] init];
  params.welinkSessionId = self.currentSessionId;

  [[WLAgentSkillsSDK sharedInstance] stopSkill:params
                                        success:^(WLAgentSkillsStopSkillResult * _Nonnull result) {
    NSLog(@"stopSkill status=%@", result.status);
  }
                                        failure:^(NSError * _Nonnull error) {
    NSLog(@"stopSkill failed: %@", error.localizedDescription);
  }];
}

- (void)closeLocalSkillConnection {
  // 仅关闭本地 WebSocket，不会删除服务端会话
  [[WLAgentSkillsSDK sharedInstance] closeSkillWithSuccess:^(WLAgentSkillsCloseSkillResult * _Nonnull result) {
    NSLog(@"closeSkill status=%@", result.status);
  } failure:^(NSError * _Nonnull error) {
    NSLog(@"closeSkill failed: %@", error.localizedDescription);
  }];
}

- (void)dealloc {
  if (self.currentSessionId != nil && self.onMessageBlock != nil) {
    WLAgentSkillsUnregisterSessionListenerParams *params = [[WLAgentSkillsUnregisterSessionListenerParams alloc] init];
    params.welinkSessionId = self.currentSessionId;
    params.onMessage = self.onMessageBlock;
    params.onError = self.onErrorBlock;
    params.onClose = self.onCloseBlock;
    [[WLAgentSkillsSDK sharedInstance] unregisterSessionListener:params];
  }
}

- (void)logSDKError:(NSError *)error prefix:(NSString *)prefix {
  NSNumber *errorCode = error.userInfo[WLAgentSkillsErrorCodeKey];
  NSString *errorMessage = error.userInfo[WLAgentSkillsErrorMessageKey] ?: error.localizedDescription;
  NSLog(@"%@: code=%@ message=%@", prefix, errorCode, errorMessage);
}

@end
```

## 4. 常见注意事项

1. 服务端使用 Cookie 认证，请确保 App 请求链路里带有有效登录态 Cookie。
2. `closeSkill` 只关闭本地 WebSocket，不会调用服务端会话删除接口。
3. `registerSessionListener` 与 `unregisterSessionListener` 需要传入同一个 block 实例，建议像示例一样将 block 保存为属性。
4. `sendMessageToIM` 依赖 SDK 缓存中的最终完成消息内容；若缓存未命中，会自动先拉历史消息再尝试发送。

## 5. 最小联调顺序建议

1. `createSession`
2. `registerSessionListener` + `onSessionStatusChange`
3. `sendMessage`
4. （如有）`replyPermission`
5. `getSessionMessage`
6. （按需）`sendMessageToIM` / `regenerateAnswer` / `stopSkill`
7. `closeSkill`

---
如需我继续补充 Swift 包装层示例或 Demo 页面（按钮驱动 13 接口逐个调用），可以在这个 README 基础上继续扩展。
