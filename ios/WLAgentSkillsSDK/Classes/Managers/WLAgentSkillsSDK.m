//
//  WLAgentSkillsSDK.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsSDK.h"
#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsWebSocketManager.h"
#import "WLAgentSkillsStreamingCache.h"

@interface WLAgentSkillsSDK () <WLAgentSkillsWebSocketDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsClientSessionStatus> *sessionStatuses;
@property (nonatomic, copy, nullable) void (^sessionStatusCallback)(WLAgentSkillsClientSessionStatus status);
@property (nonatomic, copy, nullable) void (^wecodeStatusCallback)(WLAgentSkillsWeCodeStatus status);

@end

@implementation WLAgentSkillsSDK

+ (instancetype)sharedSDK {
    static WLAgentSkillsSDK *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[WLAgentSkillsSDK alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sessionStatuses = [NSMutableDictionary dictionary];
        [WLAgentSkillsWebSocketManager sharedManager].delegate = self;
    }
    return self;
}

#pragma mark - Configuration

+ (void)configureWithBaseURL:(NSString *)baseURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL];
}

#pragma mark - 1. executeSkill - 执行技能

- (void)executeSkillWithParams:(WLAgentSkillsExecuteSkillParams *)params
                        success:(void (^)(WLAgentSkillsSession *session))success
                        failure:(void (^)(NSError *error))failure {
    
    WLAgentSkillsHTTPClient *client = [WLAgentSkillsHTTPClient sharedClient];
    NSInteger agentId = params.agentId > 0 ? params.agentId : 0;
    
    [client createSessionWithUserId:params.userId
                 skillDefinitionId:params.skillDefinitionId
                             agentId:agentId
                               title:params.title
                            imChatId:params.imChatId
                             success:^(id responseObject) {
        
        NSDictionary *sessionDict = responseObject;
        WLAgentSkillsSession *session = [[WLAgentSkillsSession alloc] initWithDictionary:sessionDict];
        
        NSString *sessionIdStr = [NSString stringWithFormat:@"%ld", (long)session.sessionId];
        
        [[WLAgentSkillsWebSocketManager sharedManager] subscribeToSession:sessionIdStr
                                                                onMessage:^(WLAgentSkillsStreamMessage *message) {
            [self handleStreamMessage:message forSessionId:sessionIdStr];
        } onError:^(WLAgentSkillsSessionError *error) {
            NSLog(@"WebSocket error for session %@: %@", sessionIdStr, error.message);
        } onClose:^(NSString *reason) {
            NSLog(@"WebSocket closed for session %@: %@", sessionIdStr, reason);
        }];
        
        [[WLAgentSkillsHTTPClient sharedClient] sendMessageWithSessionId:sessionIdStr
                                                                content:params.skillContent
                                                                success:^(id responseObject) {
            if (success) {
                success(session);
            }
        } failure:^(NSError *error) {
            if (failure) {
                failure(error);
            }
        }];
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)handleStreamMessage:(WLAgentSkillsStreamMessage *)message forSessionId:(NSString *)sessionId {
    [[WLAgentSkillsStreamingCache sharedCache] cacheMessage:message forSessionId:sessionId];
    
    WLAgentSkillsClientSessionStatus status;
    switch (message.type) {
        case WLAgentSkillsStreamMessageTypeDelta:
        case WLAgentSkillsStreamMessageTypeAgentOnline:
            status = WLAgentSkillsClientSessionStatusExecuting;
            break;
        case WLAgentSkillsStreamMessageTypeDone:
            status = WLAgentSkillsClientSessionStatusCompleted;
            break;
        case WLAgentSkillsStreamMessageTypeError:
        case WLAgentSkillsStreamMessageTypeAgentOffline:
            status = WLAgentSkillsClientSessionStatusStopped;
            break;
    }
    
    self.sessionStatuses[sessionId] = status;
    
    if (self.sessionStatusCallback) {
        self.sessionStatusCallback(status);
    }
}

#pragma mark - 2. closeSkill - 关闭技能

- (void)closeSkillWithParams:(WLAgentSkillsCloseSkillParams *)params
                     success:(void (^)(WLAgentSkillsCloseSkillResult *result))success
                     failure:(void (^)(NSError *error))failure {
    
    [[WLAgentSkillsHTTPClient sharedClient] closeSessionWithSessionId:params.sessionId
                                                            success:^(id responseObject) {
        
        [[WLAgentSkillsWebSocketManager sharedManager] unsubscribeFromSession:params.sessionId];
        [[WLAgentSkillsStreamingCache sharedCache] clearCacheForSessionId:params.sessionId];
        [self.sessionStatuses removeObjectForKey:params.sessionId];
        
        WLAgentSkillsCloseSkillResult *result = [[WLAgentSkillsCloseSkillResult alloc] init];
        result.status = @"success";
        
        if (success) {
            success(result);
        }
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - 3. stopSkill - 停止技能

- (void)stopSkillWithParams:(WLAgentSkillsStopSkillParams *)params
                    success:(void (^)(WLAgentSkillsStopSkillResult *result))success
                    failure:(void (^)(NSError *error))failure {
    
    [[WLAgentSkillsWebSocketManager sharedManager] unsubscribeFromSession:params.sessionId];
    
    self.sessionStatuses[params.sessionId] = WLAgentSkillsClientSessionStatusStopped;
    
    if (self.sessionStatusCallback) {
        self.sessionStatusCallback(WLAgentSkillsClientSessionStatusStopped);
    }
    
    WLAgentSkillsStopSkillResult *result = [[WLAgentSkillsStopSkillResult alloc] init];
    result.status = @"success";
    
    if (success) {
        success(result);
    }
}

#pragma mark - 4. onSessionStatusChange - 会话状态变更回调

- (void)onSessionStatusChangeWithParams:(WLAgentSkillsOnSessionStatusChangeParams *)params {
    self.sessionStatuses[params.sessionId] = WLAgentSkillsClientSessionStatusExecuting;
    self.sessionStatusCallback = params.callback;
    
    [[NSNotificationCenter defaultCenter] addObserverForName:@"WLAgentSkillsStreamMessageReceived"
                                                        object:nil
                                                         queue:[NSOperationQueue mainQueue]
                                                    usingBlock:^(NSNotification *note) {
        WLAgentSkillsStreamMessage *message = note.userInfo[@"message"];
        if ([message.sessionId isEqualToString:params.sessionId]) {
            [self handleStreamMessage:message forSessionId:params.sessionId];
        }
    }];
}

#pragma mark - 5. onSkillWecodeStatusChange - 小程序状态变更回调

- (void)onSkillWecodeStatusChangeWithParams:(WLAgentSkillsOnSkillWecodeStatusChangeParams *)params {
    self.wecodeStatusCallback = params.callback;
}

#pragma mark - 6. regenerateAnswer - 重新生成问答

- (void)regenerateAnswerWithParams:(WLAgentSkillsRegenerateAnswerParams *)params
                           success:(void (^)(WLAgentSkillsRegenerateAnswerResult *result))success
                           failure:(void (^)(NSError *error))failure {
    
    [[WLAgentSkillsHTTPClient sharedClient] sendMessageWithSessionId:params.sessionId
                                                            content:params.content
                                                            success:^(id responseObject) {
        
        NSDictionary *msgDict = responseObject;
        WLAgentSkillsRegenerateAnswerResult *result = [[WLAgentSkillsRegenerateAnswerResult alloc] init];
        result.messageId = [NSString stringWithFormat:@"%@", msgDict[@"id"] ?: @""];
        
        if (success) {
            success(result);
        }
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - 7. sendMessageToIM - 发送AI生成消息到IM

- (void)sendMessageToIMWithParams:(WLAgentSkillsSendMessageToIMParams *)params
                          success:(void (^)(WLAgentSkillsSendMessageToIMResult *result))success
                          failure:(void (^)(NSError *error))failure {
    
    [[WLAgentSkillsHTTPClient sharedClient] sendMessageToIMWithSessionId:params.sessionId
                                                                content:params.content
                                                                success:^(id responseObject) {
        
        NSDictionary *dict = responseObject;
        WLAgentSkillsSendMessageToIMResult *result = [[WLAgentSkillsSendMessageToIMResult alloc] init];
        result.success = [dict[@"success"] boolValue];
        result.chatId = dict[@"chatId"];
        result.contentLength = [dict[@"contentLength"] integerValue];
        
        if (success) {
            success(result);
        }
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - 8. getSessionMessage - 获取当前会话消息列表

- (void)getSessionMessageWithParams:(WLAgentSkillsGetSessionMessageParams *)params
                            success:(void (^)(WLAgentSkillsPageResult *result))success
                            failure:(void (^)(NSError *error))failure {
    
    NSInteger page = params.page > 0 ? params.page : 0;
    NSInteger size = params.size > 0 ? params.size : 50;
    
    [[WLAgentSkillsHTTPClient sharedClient] getMessageHistoryWithSessionId:params.sessionId
                                                                    page:page
                                                                    size:size
                                                                 success:^(id responseObject) {
        
        NSDictionary *pageDict = responseObject;
        WLAgentSkillsPageResult *pageResult = [[WLAgentSkillsPageResult alloc] initWithDictionary:pageDict];
        
        NSString *cachedContent = [[WLAgentSkillsStreamingCache sharedCache] getCachedContentForSessionId:params.sessionId];
        BOOL isStreaming = [[WLAgentSkillsStreamingCache sharedCache] isStreamingForSessionId:params.sessionId];
        
        if (cachedContent.length > 0) {
            WLAgentSkillsMessage *streamingMessage = [[WLAgentSkillsMessage alloc] init];
            streamingMessage.messageId = 0;
            streamingMessage.sessionId = [params.sessionId integerValue];
            streamingMessage.seq = pageResult.content.count + 1;
            streamingMessage.role = WLAgentSkillsMessageRoleAssistant;
            streamingMessage.content = cachedContent;
            streamingMessage.contentType = WLAgentSkillsContentTypeMarkdown;
            streamingMessage.createdAt = [[NSDate date] description];
            streamingMessage.meta = isStreaming ? @"{\"isStreaming\":true}" : nil;
            
            NSMutableArray *content = [pageResult.content mutableCopy];
            [content addObject:streamingMessage];
            pageResult.content = content;
            pageResult.totalElements += 1;
        }
        
        if (success) {
            success(pageResult);
        }
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - 9. registerSessionListener - 注册会话监听器

- (void)registerSessionListenerWithParams:(WLAgentSkillsRegisterSessionListenerParams *)params {
    [[WLAgentSkillsWebSocketManager sharedManager] subscribeToSession:params.sessionId
                                                              onMessage:params.onMessage
                                                                onError:params.onError
                                                                onClose:params.onClose];
}

#pragma mark - 10. unregisterSessionListener - 移除会话监听器

- (void)unregisterSessionListenerWithParams:(WLAgentSkillsUnregisterSessionListenerParams *)params {
    [[WLAgentSkillsWebSocketManager sharedManager] unsubscribeFromSession:params.sessionId];
}

#pragma mark - 11. sendMessage - 发送消息内容

- (void)sendMessageWithParams:(WLAgentSkillsSendMessageParams *)params
                     success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                     failure:(void (^)(NSError *error))failure {
    
    [[WLAgentSkillsHTTPClient sharedClient] sendMessageWithSessionId:params.sessionId
                                                            content:params.content
                                                            success:^(id responseObject) {
        
        NSDictionary *msgDict = responseObject;
        WLAgentSkillsSendMessageResult *result = [[WLAgentSkillsSendMessageResult alloc] init];
        result.messageId = [msgDict[@"id"] integerValue];
        result.seq = [msgDict[@"seq"] integerValue];
        result.createdAt = msgDict[@"createdAt"];
        
        if (success) {
            success(result);
        }
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - 12. replyPermission - 权限确认

- (void)replyPermissionWithParams:(WLAgentSkillsReplyPermissionParams *)params
                          success:(void (^)(WLAgentSkillsReplyPermissionResult *result))success
                          failure:(void (^)(NSError *error))failure {
    
    [[WLAgentSkillsHTTPClient sharedClient] replyPermissionWithSessionId:params.sessionId
                                                            permissionId:params.permissionId
                                                                approved:params.approved
                                                                 success:^(id responseObject) {
        
        NSDictionary *dict = responseObject;
        WLAgentSkillsReplyPermissionResult *result = [[WLAgentSkillsReplyPermissionResult alloc] init];
        result.success = [dict[@"success"] boolValue];
        result.permissionId = dict[@"permissionId"];
        result.approved = [dict[@"approved"] boolValue];
        
        if (success) {
            success(result);
        }
        
    } failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - 13. controlSkillWeCode - 小程序控制

- (void)controlSkillWeCodeWithParams:(WLAgentSkillsControlSkillWeCodeParams *)params
                             success:(void (^)(WLAgentSkillsControlSkillWeCodeResult *result))success
                             failure:(void (^)(NSError *error))failure {
    
    WLAgentSkillsWeCodeStatus status;
    switch (params.action) {
        case WLAgentSkillsWeCodeActionClose:
            status = WLAgentSkillsWeCodeStatusClosed;
            break;
        case WLAgentSkillsWeCodeActionMinimize:
            status = WLAgentSkillsWeCodeStatusMinimized;
            break;
    }
    
    if (self.wecodeStatusCallback) {
        self.wecodeStatusCallback(status);
    }
    
    WLAgentSkillsControlSkillWeCodeResult *result = [[WLAgentSkillsControlSkillWeCodeResult alloc] init];
    result.status = @"success";
    
    if (success) {
        success(result);
    }
}

#pragma mark - WLAgentSkillsWebSocketDelegate

- (void)webSocketDidConnect {
    NSLog(@"WebSocket connected");
}

- (void)webSocketDidDisconnectWithError:(NSError *)error {
    NSLog(@"WebSocket disconnected: %@", error.localizedDescription);
}

- (void)webSocketDidReceiveMessage:(WLAgentSkillsStreamMessage *)message {
    NSLog(@"Received message: %@", message.content);
}

@end