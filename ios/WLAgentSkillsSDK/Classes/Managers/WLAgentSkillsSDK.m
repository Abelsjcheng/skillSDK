//
//  WLAgentSkillsSDK.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsSDK.h"
#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsStreamingCache.h"
#import "WLAgentSkillsWebSocketManager.h"
#import "WLAgentSkillsConfig.h"

static NSString * const WLAgentSkillsSDKErrorDomain = @"com.wlagentskills.sdk";

@interface WLAgentSkillsSDK () <WLAgentSkillsWebSocketManagerDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionStatusCallback> *sessionStatusCallbacks;
@property (nonatomic, copy, nullable) WLAgentSkillsWecodeStatusCallback wecodeStatusCallback;

@end

@implementation WLAgentSkillsSDK

+ (instancetype)sharedInstance {
  static WLAgentSkillsSDK *sharedInstance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[WLAgentSkillsSDK alloc] init];
  });
  return sharedInstance;
}

+ (void)configureWithBaseURL:(NSString *)baseURL {
  [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL];
  [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
}

+ (void)configureWithBaseURL:(NSString *)baseURL webSocketURL:(nullable NSString *)webSocketURL {
  [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL webSocketURL:webSocketURL];
  [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _sessionStatusCallbacks = [NSMutableDictionary dictionary];
    [WLAgentSkillsWebSocketManager sharedManager].delegate = self;
  }
  return self;
}

#pragma mark - 1. createSession

- (void)createSession:(WLAgentSkillsCreateSessionParams *)params
              success:(void (^)(WLAgentSkillsSkillSession *session))success
              failure:(void (^)(NSError *error))failure {
  if (params == nil || params.ak.length == 0 || params.imGroupId.length == 0) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: ak and imGroupId are required."];
    return;
  }

  [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsHTTPClient sharedClient] getSessionsWithImGroupId:params.imGroupId
                                                             status:@"ACTIVE"
                                                               page:@0
                                                               size:@20
                                                            success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    NSArray *content = [data[@"content"] isKindOfClass:[NSArray class]] ? data[@"content"] : @[];
    NSDictionary *existing = content.count > 0 && [content.firstObject isKindOfClass:[NSDictionary class]] ? content.firstObject : nil;

    if (existing != nil) {
      if (success) {
        success([[WLAgentSkillsSkillSession alloc] initWithDictionary:existing]);
      }
      return;
    }

    [[WLAgentSkillsHTTPClient sharedClient] createSessionWithAK:params.ak
                                                           title:params.title
                                                       imGroupId:params.imGroupId
                                                         success:^(id  _Nullable createdResponse) {
      NSDictionary *created = [createdResponse isKindOfClass:[NSDictionary class]] ? createdResponse : @{};
      WLAgentSkillsSkillSession *session = [[WLAgentSkillsSkillSession alloc] initWithDictionary:created];
      if (success) {
        success(session);
      }
    }
                                                         failure:^(NSError * _Nonnull error) {
      [weakSelf dispatchFailureObject:failure error:error];
    }];
  }
                                                            failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

#pragma mark - 2. closeSkill

- (void)closeSkillWithSuccess:(void (^)(WLAgentSkillsCloseSkillResult *result))success
                      failure:(void (^)(NSError *error))failure {
  WLAgentSkillsWebSocketManager *manager = [WLAgentSkillsWebSocketManager sharedManager];
  if (!manager.isConnected) {
    [self dispatchFailure:failure code:3000 message:@"WebSocket is not connected."];
    return;
  }

  [manager disconnect];
  [[WLAgentSkillsStreamingCache sharedCache] clearAllCache];

  WLAgentSkillsCloseSkillResult *result = [[WLAgentSkillsCloseSkillResult alloc] init];
  result.status = @"success";
  if (success) {
    success(result);
  }
}

#pragma mark - 3. stopSkill

- (void)stopSkill:(WLAgentSkillsStopSkillParams *)params
          success:(void (^)(WLAgentSkillsStopSkillResult *result))success
          failure:(void (^)(NSError *error))failure {
  if (params == nil || params.welinkSessionId == nil) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
    return;
  }

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsHTTPClient sharedClient] abortSessionWithSessionId:params.welinkSessionId
                                                             success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    WLAgentSkillsStopSkillResult *result = [[WLAgentSkillsStopSkillResult alloc] initWithDictionary:data];
    [weakSelf emitSessionStatus:WLAgentSkillsClientSessionStatusStopped
                      sessionId:params.welinkSessionId];
    if (success) {
      success(result);
    }
  }
                                                             failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

#pragma mark - 4. onSessionStatusChange

- (void)onSessionStatusChange:(WLAgentSkillsOnSessionStatusChangeParams *)params {
  if (params == nil || params.welinkSessionId == nil || params.callback == nil) {
    return;
  }
  @synchronized(self) {
    self.sessionStatusCallbacks[params.welinkSessionId.stringValue] = [params.callback copy];
  }
}

#pragma mark - 5. onSkillWecodeStatusChange

- (void)onSkillWecodeStatusChange:(WLAgentSkillsOnSkillWecodeStatusChangeParams *)params {
  if (params == nil || params.callback == nil) {
    return;
  }
  self.wecodeStatusCallback = [params.callback copy];
}

#pragma mark - 6. regenerateAnswer

- (void)regenerateAnswer:(WLAgentSkillsRegenerateAnswerParams *)params
                 success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                 failure:(void (^)(NSError *error))failure {
  if (params == nil || params.welinkSessionId == nil) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
    return;
  }

  NSString *cachedContent = [[WLAgentSkillsStreamingCache sharedCache] lastUserMessageContentForSessionId:params.welinkSessionId];
  if (cachedContent.length > 0) {
    [self sendMessageWithSessionId:params.welinkSessionId
                           content:cachedContent
                        toolCallId:nil
                           success:success
                           failure:failure];
    return;
  }

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                               page:@0
                                                               size:@50
                                                            success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    WLAgentSkillsPageResult *pageResult = [[WLAgentSkillsPageResult alloc] initWithDictionary:data];
    [[WLAgentSkillsStreamingCache sharedCache] cacheHistoryMessages:pageResult.content
                                                       forSessionId:params.welinkSessionId];

    NSString *content = [[WLAgentSkillsStreamingCache sharedCache] lastUserMessageContentForSessionId:params.welinkSessionId];
    if (content.length == 0) {
      [weakSelf dispatchFailure:failure code:4002 message:@"No user message can be used for regenerateAnswer."];
      return;
    }

    [weakSelf sendMessageWithSessionId:params.welinkSessionId
                               content:content
                            toolCallId:nil
                               success:success
                               failure:failure];
  }
                                                            failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

#pragma mark - 7. sendMessageToIM

- (void)sendMessageToIM:(WLAgentSkillsSendMessageToIMParams *)params
                success:(void (^)(WLAgentSkillsSendMessageToIMResult *result))success
                failure:(void (^)(NSError *error))failure {
  if (params == nil || params.welinkSessionId == nil) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
    return;
  }
  if (params.messageId != nil && params.messageId.length == 0) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: messageId cannot be empty."];
    return;
  }
  if (params.chatId != nil && params.chatId.length == 0) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: chatId cannot be empty."];
    return;
  }

  __weak typeof(self) weakSelf = self;
  void (^sendWithContent)(NSString *) = ^(NSString *content) {
    [[WLAgentSkillsHTTPClient sharedClient] sendToIMWithSessionId:params.welinkSessionId
                                                          content:content
                                                           chatId:params.chatId
                                                          success:^(id  _Nullable responseObject) {
        WLAgentSkillsSendMessageToIMResult *result = [[WLAgentSkillsSendMessageToIMResult alloc] init];

        if ([responseObject isKindOfClass:[NSDictionary class]]) {
          NSDictionary *dict = responseObject;
          if (dict[@"status"] != nil) {
            result.status = [dict[@"status"] description];
          } else if (dict[@"success"] != nil) {
            BOOL ok = [dict[@"success"] boolValue];
            result.status = ok ? @"success" : @"failed";
          } else {
            result.status = @"success";
          }
          if (dict[@"chatId"] != nil) {
            result.chatId = [dict[@"chatId"] description];
          }
          if (dict[@"contentLength"] != nil) {
            result.contentLength = @([dict[@"contentLength"] integerValue]);
          }
        } else {
          result.status = @"success";
        }

        if (success) {
          success(result);
        }
      }
                                                          failure:^(NSError * _Nonnull error) {
      [weakSelf dispatchFailureObject:failure error:error];
    }];
  };

  NSString *content = [[WLAgentSkillsStreamingCache sharedCache] latestCompletedContentForSessionId:params.welinkSessionId
                                                                                             messageId:params.messageId];
  if (content.length > 0) {
    sendWithContent(content);
    return;
  }

  [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                               page:@0
                                                               size:@50
                                                            success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    WLAgentSkillsPageResult *pageResult = [[WLAgentSkillsPageResult alloc] initWithDictionary:data];
    [[WLAgentSkillsStreamingCache sharedCache] cacheHistoryMessages:pageResult.content
                                                       forSessionId:params.welinkSessionId];

    NSString *latest = [[WLAgentSkillsStreamingCache sharedCache] latestCompletedContentForSessionId:params.welinkSessionId
                                                                                             messageId:params.messageId];
    if (latest.length == 0) {
      NSInteger code = params.messageId != nil ? 4003 : 4005;
      NSString *message = params.messageId != nil ? @"Message not found in SDK cache." : @"No completed message available.";
      [weakSelf dispatchFailure:failure code:code message:message];
      return;
    }

    sendWithContent(latest);
  }
                                                            failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

#pragma mark - 8. getSessionMessage

- (void)getSessionMessage:(WLAgentSkillsGetSessionMessageParams *)params
                  success:(void (^)(WLAgentSkillsPageResult *result))success
                  failure:(void (^)(NSError *error))failure {
  if (params == nil || params.welinkSessionId == nil) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
    return;
  }

  NSNumber *page = params.page ?: @0;
  NSNumber *size = params.size ?: @50;

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                               page:page
                                                               size:size
                                                            success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    WLAgentSkillsPageResult *serverPage = [[WLAgentSkillsPageResult alloc] initWithDictionary:data];

    NSArray<WLAgentSkillsSessionMessage *> *merged = [[WLAgentSkillsStreamingCache sharedCache] mergedMessagesWithServerMessages:serverPage.content
                                                                                                                      sessionId:params.welinkSessionId];

    NSInteger pageValue = page.integerValue;
    NSInteger sizeValue = MAX(1, size.integerValue);
    NSInteger start = pageValue * sizeValue;
    NSInteger end = MIN(start + sizeValue, merged.count);

    NSArray<WLAgentSkillsSessionMessage *> *paged = @[];
    if (start < end) {
      paged = [merged subarrayWithRange:NSMakeRange(start, end - start)];
    }

    NSMutableArray *dictContent = [NSMutableArray arrayWithCapacity:paged.count];
    for (WLAgentSkillsSessionMessage *message in paged) {
      [dictContent addObject:[message toDictionary]];
    }

    NSDictionary *pageDict = @{
      @"content" : dictContent,
      @"page" : @(pageValue),
      @"size" : @(sizeValue),
      @"total" : @(merged.count)
    };

    WLAgentSkillsPageResult *result = [[WLAgentSkillsPageResult alloc] initWithDictionary:pageDict];
    if (success) {
      success(result);
    }
  }
                                                            failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

#pragma mark - 9. registerSessionListener

- (void)registerSessionListener:(WLAgentSkillsRegisterSessionListenerParams *)params {
  if (params == nil || params.welinkSessionId == nil || params.onMessage == nil) {
    return;
  }

  [[WLAgentSkillsWebSocketManager sharedManager] addListenerForSessionId:params.welinkSessionId
                                                                onMessage:params.onMessage
                                                                  onError:params.onError
                                                                  onClose:params.onClose];
}

#pragma mark - 10. unregisterSessionListener

- (void)unregisterSessionListener:(WLAgentSkillsUnregisterSessionListenerParams *)params {
  if (params == nil || params.welinkSessionId == nil || params.onMessage == nil) {
    return;
  }

  [[WLAgentSkillsWebSocketManager sharedManager] removeListenerForSessionId:params.welinkSessionId
                                                                   onMessage:params.onMessage
                                                                     onError:params.onError
                                                                     onClose:params.onClose];
}

#pragma mark - 11. sendMessage

- (void)sendMessage:(WLAgentSkillsSendMessageParams *)params
            success:(void (^)(WLAgentSkillsSendMessageResult *result))success
            failure:(void (^)(NSError *error))failure {
  if (params == nil || params.welinkSessionId == nil || params.content.length == 0) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId and content are required."];
    return;
  }

  [self sendMessageWithSessionId:params.welinkSessionId
                         content:params.content
                      toolCallId:params.toolCallId
                         success:success
                         failure:failure];
}

#pragma mark - 12. replyPermission

- (void)replyPermission:(WLAgentSkillsReplyPermissionParams *)params
                success:(void (^)(WLAgentSkillsReplyPermissionResult *result))success
                failure:(void (^)(NSError *error))failure {
  if (params == nil || params.welinkSessionId == nil || params.permId.length == 0 || params.response.length == 0) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params for replyPermission."];
    return;
  }

  NSSet *validResponses = [NSSet setWithArray:@[@"once", @"always", @"reject"]];
  if (![validResponses containsObject:params.response]) {
    [self dispatchFailure:failure code:1000 message:@"response must be once/always/reject."];
    return;
  }

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsHTTPClient sharedClient] replyPermissionWithSessionId:params.welinkSessionId
                                                                 permId:params.permId
                                                               response:params.response
                                                                success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    WLAgentSkillsReplyPermissionResult *result = [[WLAgentSkillsReplyPermissionResult alloc] initWithDictionary:data];
    if (success) {
      success(result);
    }
  }
                                                                failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

#pragma mark - 13. controlSkillWeCode

- (void)controlSkillWeCode:(WLAgentSkillsControlSkillWeCodeParams *)params
                   success:(void (^)(WLAgentSkillsControlSkillWeCodeResult *result))success
                   failure:(void (^)(NSError *error))failure {
  if (params == nil) {
    [self dispatchFailure:failure code:1000 message:@"Invalid params for controlSkillWeCode."];
    return;
  }

  WLAgentSkillsSkillWecodeStatusResult *statusResult = [[WLAgentSkillsSkillWecodeStatusResult alloc] init];
  statusResult.timestamp = @((long long)([[NSDate date] timeIntervalSince1970] * 1000));

  switch (params.action) {
    case WLAgentSkillsWecodeActionClose:
      statusResult.status = WLAgentSkillsWecodeStatusClosed;
      statusResult.message = @"Skill miniapp closed";
      break;
    case WLAgentSkillsWecodeActionMinimize:
      statusResult.status = WLAgentSkillsWecodeStatusMinimized;
      statusResult.message = @"Skill miniapp minimized";
      break;
    default:
      [self dispatchFailure:failure code:1000 message:@"Unsupported action for controlSkillWeCode."];
      return;
  }

  if (self.wecodeStatusCallback != nil) {
    self.wecodeStatusCallback(statusResult);
  }

  WLAgentSkillsControlSkillWeCodeResult *result = [[WLAgentSkillsControlSkillWeCodeResult alloc] init];
  result.status = @"success";
  if (success) {
    success(result);
  }
}

#pragma mark - WLAgentSkillsWebSocketManagerDelegate

- (void)webSocketManagerDidReceiveMessage:(WLAgentSkillsStreamMessage *)message {
  [[WLAgentSkillsStreamingCache sharedCache] updateWithStreamMessage:message];

  NSInteger mappedStatus = [self mapStreamMessageToSessionStatus:message];
  if (mappedStatus == NSNotFound) {
    return;
  }

  NSNumber *sessionId = @([message.welinkSessionId longLongValue]);
  if (sessionId.longLongValue <= 0) {
    return;
  }

  [self emitSessionStatus:(WLAgentSkillsClientSessionStatus)mappedStatus sessionId:sessionId];
}

#pragma mark - Internal Helpers

- (void)sendMessageWithSessionId:(NSNumber *)welinkSessionId
                         content:(NSString *)content
                      toolCallId:(nullable NSString *)toolCallId
                         success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                         failure:(void (^)(NSError *error))failure {
  [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

  __weak typeof(self) weakSelf = self;
  [[WLAgentSkillsHTTPClient sharedClient] sendMessageWithSessionId:welinkSessionId
                                                            content:content
                                                         toolCallId:toolCallId
                                                            success:^(id  _Nullable responseObject) {
    NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
    WLAgentSkillsSendMessageResult *result = [[WLAgentSkillsSendMessageResult alloc] initWithDictionary:data];
    [[WLAgentSkillsStreamingCache sharedCache] cacheSendMessageResult:result];
    if (success) {
      success(result);
    }
  }
                                                            failure:^(NSError * _Nonnull error) {
    [weakSelf dispatchFailureObject:failure error:error];
  }];
}

- (NSInteger)mapStreamMessageToSessionStatus:(WLAgentSkillsStreamMessage *)message {
  NSString *type = message.type ?: @"";

  if ([type isEqualToString:@"step.start"] ||
      [type isEqualToString:@"text.delta"] ||
      [type isEqualToString:@"thinking.delta"] ||
      [type isEqualToString:@"tool.update"] ||
      [type isEqualToString:@"question"] ||
      [type isEqualToString:@"permission.ask"] ||
      [type isEqualToString:@"file"]) {
    return WLAgentSkillsClientSessionStatusExecuting;
  }

  if ([type isEqualToString:@"permission.reply"]) {
    if ([message.response isEqualToString:@"reject"]) {
      return WLAgentSkillsClientSessionStatusStopped;
    }
    if ([message.response isEqualToString:@"once"] || [message.response isEqualToString:@"always"]) {
      return WLAgentSkillsClientSessionStatusExecuting;
    }
  }

  if ([type isEqualToString:@"session.status"]) {
    if ([message.sessionStatus isEqualToString:@"busy"] || [message.sessionStatus isEqualToString:@"retry"]) {
      return WLAgentSkillsClientSessionStatusExecuting;
    }
    if ([message.sessionStatus isEqualToString:@"idle"]) {
      return WLAgentSkillsClientSessionStatusCompleted;
    }
  }

  if ([type isEqualToString:@"step.done"] ||
      [type isEqualToString:@"text.done"] ||
      [type isEqualToString:@"thinking.done"]) {
    return WLAgentSkillsClientSessionStatusCompleted;
  }

  if ([type isEqualToString:@"session.error"] ||
      [type isEqualToString:@"error"] ||
      [type isEqualToString:@"agent.offline"]) {
    return WLAgentSkillsClientSessionStatusStopped;
  }

  return NSNotFound;
}

- (void)emitSessionStatus:(WLAgentSkillsClientSessionStatus)status sessionId:(NSNumber *)sessionId {
  WLAgentSkillsSessionStatusCallback callback = nil;
  @synchronized(self) {
    callback = self.sessionStatusCallbacks[sessionId.stringValue];
  }

  if (callback == nil) {
    return;
  }

  WLAgentSkillsSessionStatusResult *result = [[WLAgentSkillsSessionStatusResult alloc] init];
  result.status = status;
  callback(result);
}

- (void)dispatchFailure:(void (^)(NSError *error))failure
                   code:(NSInteger)code
                message:(NSString *)message {
  if (failure == nil) {
    return;
  }

  NSError *error = [NSError errorWithDomain:WLAgentSkillsSDKErrorDomain
                                       code:code
                                   userInfo:@{
    NSLocalizedDescriptionKey : message ?: @"Unknown error",
    WLAgentSkillsErrorCodeKey : @(code),
    WLAgentSkillsErrorMessageKey : message ?: @"Unknown error"
  }];
  failure(error);
}

- (void)dispatchFailureObject:(void (^)(NSError *error))failure error:(NSError *)error {
  if (failure != nil) {
    failure(error);
  }
}

@end
