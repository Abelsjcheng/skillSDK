# iOS Skill SDK 使用说明

## 工程位置
- SDK 工程：`ios/WLAgentSkillsSDK`
- 对外头文件：`ios/WLAgentSkillsSDK/Include/WLAgentSkillsSDKPublic.h`
- 语言：Objective-C
- 网络框架：AFNetworking

## 快速接入

### 1. Podfile（同仓库本地引用）
```ruby
platform :ios, '12.0'
use_frameworks!

target 'YourApp' do
  pod 'WLAgentSkillsSDK', :path => 'ios/WLAgentSkillsSDK'
end
```

```bash
pod install
```

### 2. 初始化
```objective-c
#import <WLAgentSkillsSDK/WLAgentSkillsSDKPublic.h>

[WLAgentSkillsSDK configureWithBaseURL:@"http://127.0.0.1:8082"];
WLAgentSkillsSDK *sdk = [WLAgentSkillsSDK sharedInstance];
```

## 最小调用链路示例

```objective-c
WLAgentSkillsSDK *sdk = [WLAgentSkillsSDK sharedInstance];

WLAgentSkillsCreateSessionParams *createParams = [[WLAgentSkillsCreateSessionParams alloc] init];
createParams.ak = @"ak_xxxxxxxx";
createParams.title = @"iOS 示例会话";
createParams.imGroupId = @"group_abc123";

[sdk createSession:createParams
          success:^(WLAgentSkillsSkillSession * _Nonnull session) {
  NSNumber *sessionId = session.welinkSessionId;

  WLAgentSkillsSessionMessageCallback onMessage = ^(WLAgentSkillsStreamMessage * _Nonnull message) {
    // 处理 text.delta / tool.update / permission.ask 等流式事件
  };

  WLAgentSkillsRegisterSessionListenerParams *listenerParams = [[WLAgentSkillsRegisterSessionListenerParams alloc] init];
  listenerParams.welinkSessionId = sessionId;
  listenerParams.onMessage = onMessage;
  [sdk registerSessionListener:listenerParams];

  WLAgentSkillsSendMessageParams *sendParams = [[WLAgentSkillsSendMessageParams alloc] init];
  sendParams.welinkSessionId = sessionId;
  sendParams.content = @"请帮我创建一个 React 项目";

  [sdk sendMessage:sendParams
           success:^(WLAgentSkillsSendMessageResult * _Nonnull result) {
             // SendMessageResult 字段与服务端/SDK文档一致：id, welinkSessionId, userId...
             NSLog(@"sendMessage id=%@", result.id);
           }
           failure:^(NSError * _Nonnull error) {
           }];
}
          failure:^(NSError * _Nonnull error) {
          }];
```

## 13 个接口与使用方法

### 1) `createSession:success:failure:`
创建或复用会话，并建立 WebSocket 连接。

```objective-c
[sdk createSession:params success:^(WLAgentSkillsSkillSession *session) {} failure:^(NSError *error) {}];
```

### 2) `closeSkillWithSuccess:failure:`
仅关闭本地 WebSocket 与本地缓存，不删除服务端会话。

```objective-c
[sdk closeSkillWithSuccess:^(WLAgentSkillsCloseSkillResult *result) {} failure:^(NSError *error) {}];
```

### 3) `stopSkill:success:failure:`
中止当前轮执行。

```objective-c
WLAgentSkillsStopSkillParams *p = [WLAgentSkillsStopSkillParams new];
p.welinkSessionId = sessionId;
[sdk stopSkill:p success:^(WLAgentSkillsStopSkillResult *result) {} failure:^(NSError *error) {}];
```

### 4) `onSessionStatusChange:`
监听 `executing/stopped/completed`。

```objective-c
WLAgentSkillsOnSessionStatusChangeParams *p = [WLAgentSkillsOnSessionStatusChangeParams new];
p.welinkSessionId = sessionId;
p.callback = ^(WLAgentSkillsSessionStatusResult *result) {};
[sdk onSessionStatusChange:p];
```

### 5) `onSkillWecodeStatusChange:`
监听小程序状态 `closed/minimized`。

```objective-c
WLAgentSkillsOnSkillWecodeStatusChangeParams *p = [WLAgentSkillsOnSkillWecodeStatusChangeParams new];
p.callback = ^(WLAgentSkillsSkillWecodeStatusResult *result) {};
[sdk onSkillWecodeStatusChange:p];
```

### 6) `regenerateAnswer:success:failure:`
按最后一条用户消息重新生成。

```objective-c
WLAgentSkillsRegenerateAnswerParams *p = [WLAgentSkillsRegenerateAnswerParams new];
p.welinkSessionId = sessionId;
[sdk regenerateAnswer:p success:^(WLAgentSkillsSendMessageResult *result) {} failure:^(NSError *error) {}];
```

### 7) `sendMessageToIM:success:failure:`
发送最终消息到 IM。

```objective-c
WLAgentSkillsSendMessageToIMParams *p = [WLAgentSkillsSendMessageToIMParams new];
p.welinkSessionId = sessionId;
p.messageId = nil; // 可选
[sdk sendMessageToIM:p success:^(WLAgentSkillsSendMessageToIMResult *result) {} failure:^(NSError *error) {}];
```

### 8) `getSessionMessage:success:failure:`
获取消息列表（历史 + 本地流式合并）。

```objective-c
WLAgentSkillsGetSessionMessageParams *p = [WLAgentSkillsGetSessionMessageParams new];
p.welinkSessionId = sessionId;
p.page = @0;
p.size = @50;
[sdk getSessionMessage:p success:^(WLAgentSkillsPageResult *result) {
  WLAgentSkillsSessionMessage *first = result.content.firstObject;
  NSLog(@"session message id=%@", first.id);
} failure:^(NSError *error) {}];
```

### 9) `registerSessionListener:`
注册会话监听器。同一个 `welinkSessionId` 只允许注册一次，重复注册会返回 `4011`（通过 `onError` 回调）。

```objective-c
WLAgentSkillsRegisterSessionListenerParams *p = [WLAgentSkillsRegisterSessionListenerParams new];
p.welinkSessionId = sessionId;
p.onMessage = onMessage;
p.onError = ^(WLAgentSkillsSessionError *error) {};
p.onClose = ^(NSString *reason) {};
[sdk registerSessionListener:p];
```

### 10) `unregisterSessionListener:`
按 `welinkSessionId` 移除该会话下当前注册的全部监听回调。

```objective-c
WLAgentSkillsUnregisterSessionListenerParams *p = [WLAgentSkillsUnregisterSessionListenerParams new];
p.welinkSessionId = sessionId;
[sdk unregisterSessionListener:p];
```

### 11) `sendMessage:success:failure:`
发送用户消息。

```objective-c
WLAgentSkillsSendMessageParams *p = [WLAgentSkillsSendMessageParams new];
p.welinkSessionId = sessionId;
p.content = @"继续";
p.toolCallId = nil;
[sdk sendMessage:p success:^(WLAgentSkillsSendMessageResult *result) {
  NSLog(@"message id=%@", result.id);
} failure:^(NSError *error) {}];
```

### 12) `replyPermission:success:failure:`
权限确认，`response` 支持 `once/always/reject`。

```objective-c
WLAgentSkillsReplyPermissionParams *p = [WLAgentSkillsReplyPermissionParams new];
p.welinkSessionId = sessionId;
p.permId = permId;
p.response = @"once";
[sdk replyPermission:p success:^(WLAgentSkillsReplyPermissionResult *result) {} failure:^(NSError *error) {}];
```

### 13) `controlSkillWeCode:success:failure:`
控制小程序关闭或最小化。

```objective-c
WLAgentSkillsControlSkillWeCodeParams *p = [WLAgentSkillsControlSkillWeCodeParams new];
p.action = WLAgentSkillsWecodeActionClose;
[sdk controlSkillWeCode:p success:^(WLAgentSkillsControlSkillWeCodeResult *result) {} failure:^(NSError *error) {}];
```

## 错误处理

`NSError` 的 `userInfo` 中可读取：
- `WLAgentSkillsErrorCodeKey`
- `WLAgentSkillsErrorMessageKey`

```objective-c
NSNumber *code = error.userInfo[WLAgentSkillsErrorCodeKey];
NSString *msg = error.userInfo[WLAgentSkillsErrorMessageKey] ?: error.localizedDescription;
```

## 推荐调用顺序

1. `configureWithBaseURL` + `sharedInstance`
2. `createSession`
3. `registerSessionListener` + `onSessionStatusChange`
4. `sendMessage`
5. （按需）`replyPermission` / `getSessionMessage` / `regenerateAnswer`
6. （按需）`sendMessageToIM` / `stopSkill`
7. 页面销毁时 `unregisterSessionListener`
8. 退出时 `closeSkillWithSuccess`
