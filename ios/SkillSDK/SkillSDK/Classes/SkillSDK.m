//
//  SkillSDK.m
//  SkillSDK
//

#import "SkillSDK.h"
#import "SkillHTTPClient.h"
#import "SkillWebSocketManager.h"
#import "StreamingMessageCache.h"

@interface SkillSDK () <SkillWebSocketDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray<StreamMessageCallback> *> *messageListeners;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray<SessionErrorCallback> *> *errorListeners;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray<SessionCloseCallback> *> *closeListeners;
@property (nonatomic, strong) NSMutableDictionary<NSString *, SessionStatusCallback> *statusCallbacks;
@property (nonatomic, copy, nullable) SkillWecodeStatusCallback wecodeStatusCallback;
@property (nonatomic, strong) NSMutableDictionary<NSString *, SkillSession *> *activeSessions;
@property (nonatomic, strong) dispatch_queue_t sdkQueue;

@end

@implementation SkillSDK

+ (instancetype)sharedInstance {
    static SkillSDK *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SkillSDK alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _messageListeners = [NSMutableDictionary dictionary];
        _errorListeners = [NSMutableDictionary dictionary];
        _closeListeners = [NSMutableDictionary dictionary];
        _statusCallbacks = [NSMutableDictionary dictionary];
        _activeSessions = [NSMutableDictionary dictionary];
        _sdkQueue = dispatch_queue_create("com.skillSDK.main", DISPATCH_QUEUE_SERIAL);
        
        [SkillWebSocketManager sharedManager].delegate = self;
    }
    return self;
}

#pragma mark - Configuration

- (void)configureWithBaseURL:(NSString *)baseURL {
    [[SkillSDKConfig sharedConfig] configureWithBaseURL:baseURL];
}

- (void)configureWithBaseURL:(NSString *)baseURL wsURL:(NSString *)wsURL {
    [[SkillSDKConfig sharedConfig] configureWithBaseURL:baseURL wsURL:wsURL];
}

#pragma mark - 1. Execute Skill

- (void)executeSkillWithImChatId:(NSString *)imChatId
               skillDefinitionId:(NSInteger)skillDefinitionId
                         userId:(NSString *)userId
                    skillContent:(NSString *)skillContent
                        agentId:(NSInteger)agentId
                          title:(NSString *)title
                      completion:(SkillSessionCallback)completion {
    
    NSDictionary *params = @{
        @"userId": userId,
        @"skillDefinitionId": @(skillDefinitionId),
        @"agentId": @(agentId),
        @"title": title ?: @"",
        @"imChatId": imChatId
    };
    
    [[SkillHTTPClient sharedClient] POST:@"/api/skill/sessions" parameters:params success:^(id responseObject) {
        SkillSession *session = [[SkillSession alloc] initWithDictionary:responseObject];
        
        self.activeSessions[[NSString stringWithFormat:@"%@", @(session.sessionId)]] = session;
        
        [[SkillWebSocketManager sharedManager] connect];
        
        NSString *sessionIdStr = [NSString stringWithFormat:@"%@", @(session.sessionId)];
        [self sendMessageWithSessionId:sessionIdStr content:skillContent completion:^(SkillMessage *message, NSError *error) {
            if (completion) {
                completion(session, nil);
            }
        }];
        
    } failure:^(NSError *error) {
        if (completion) {
            completion(nil, error);
        }
    }];
}

#pragma mark - 2. Close Skill

- (void)closeSkillWithSessionId:(NSString *)sessionId
                      completion:(SkillResultCallback)completion {
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@", sessionId];
    
    [[SkillHTTPClient sharedClient] DELETE:url parameters:nil success:^(id responseObject) {
        [self.activeSessions removeObjectForKey:sessionId];
        [[StreamingMessageCache sharedCache] clearCacheForSessionId:sessionId];
        
        if (completion) {
            NSDictionary *result = @{@"status": @"success", @"sessionId": sessionId};
            completion(result, nil);
        }
    } failure:^(NSError *error) {
        if (completion) {
            completion(nil, error);
        }
    }];
}

#pragma mark - 3. Stop Skill

- (void)stopSkillWithSessionId:(NSString *)sessionId
                    completion:(SkillResultCallback)completion {
    
    [self.activeSessions removeObjectForKey:sessionId];
    [[StreamingMessageCache sharedCache] clearCacheForSessionId:sessionId];
    
    SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
    if (statusCallback) {
        statusCallback(SessionStatusStopped);
    }
    
    if (completion) {
        completion(@{@"status": @"success"}, nil);
    }
}

#pragma mark - 4. On Session Status Change

- (void)onSessionStatusChangeWithSessionId:(NSString *)sessionId
                                  callback:(SessionStatusCallback)callback {
    self.statusCallbacks[sessionId] = callback;
}

#pragma mark - 5. On Skill Wecode Status Change

- (void)onSkillWecodeStatusChange:(SkillWecodeStatusCallback)callback {
    self.wecodeStatusCallback = callback;
}

#pragma mark - 6. Regenerate Answer

- (void)regenerateAnswerWithSessionId:(NSString *)sessionId
                              content:(NSString *)content
                           completion:(SkillMessageCallback)completion {
    
    [self sendMessageWithSessionId:sessionId content:content completion:completion];
}

#pragma mark - 7. Send Message To IM

- (void)sendMessageToIMWithSessionId:(NSString *)sessionId
                             content:(NSString *)content
                          completion:(SkillResultCallback)completion {
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/send-to-im", sessionId];
    NSDictionary *params = @{@"content": content};
    
    [[SkillHTTPClient sharedClient] POST:url parameters:params success:^(id responseObject) {
        if (completion) {
            completion(responseObject, nil);
        }
    } failure:^(NSError *error) {
        if (completion) {
            completion(nil, error);
        }
    }];
}

#pragma mark - 8. Get Session Message

- (void)getSessionMessageWithSessionId:(NSString *)sessionId
                                  page:(NSInteger)page
                                  size:(NSInteger)size
                            completion:(SkillResultCallback)completion {
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages?page=%ld&size=%ld", sessionId, (long)page, (long)size];
    
    [[SkillHTTPClient sharedClient] GET:url parameters:nil success:^(id responseObject) {
        NSMutableDictionary *result = [responseObject mutableCopy];
        
        SkillMessage *streamingMessage = [[StreamingMessageCache sharedCache] getStreamingMessageForSessionId:sessionId];
        if (streamingMessage) {
            NSMutableArray *content = [result[@"content"] mutableCopy];
            if (!content) {
                content = [NSMutableArray array];
            }
            [content addObject:[streamingMessage toDictionary]];
            result[@"content"] = content;
            result[@"totalElements"] = @([result[@"totalElements"] integerValue] + 1);
        }
        
        if (completion) {
            completion([result copy], nil);
        }
    } failure:^(NSError *error) {
        if (completion) {
            completion(nil, error);
        }
    }];
}

#pragma mark - 9. Register Session Listener

- (void)registerSessionListenerWithSessionId:(NSString *)sessionId
                                    onMessage:(StreamMessageCallback)onMessage
                                      onError:(SessionErrorCallback)onError
                                     onClose:(SessionCloseCallback)onClose {
    
    if (!self.messageListeners[sessionId]) {
        self.messageListeners[sessionId] = [NSMutableArray array];
    }
    [self.messageListeners[sessionId] addObject:onMessage];
    
    if (onError) {
        if (!self.errorListeners[sessionId]) {
            self.errorListeners[sessionId] = [NSMutableArray array];
        }
        [self.errorListeners[sessionId] addObject:onError];
    }
    
    if (onClose) {
        if (!self.closeListeners[sessionId]) {
            self.closeListeners[sessionId] = [NSMutableArray array];
        }
        [self.closeListeners[sessionId] addObject:onClose];
    }
    
    [[SkillWebSocketManager sharedManager] connect];
}

#pragma mark - 10. Unregister Session Listener

- (void)unregisterSessionListenerWithSessionId:(NSString *)sessionId
                                     onMessage:(StreamMessageCallback)onMessage
                                       onError:(SessionErrorCallback)onError
                                      onClose:(SessionCloseCallback)onClose {
    
    [self.messageListeners[sessionId] removeObject:onMessage];
    [self.errorListeners[sessionId] removeObject:onError];
    [self.closeListeners[sessionId] removeObject:onClose];
    
    if (self.messageListeners[sessionId].count == 0) {
        [self.messageListeners removeObjectForKey:sessionId];
        [self.errorListeners removeObjectForKey:sessionId];
        [self.closeListeners removeObjectForKey:sessionId];
    }
}

#pragma mark - 11. Send Message

- (void)sendMessageWithSessionId:(NSString *)sessionId
                         content:(NSString *)content
                      completion:(SkillMessageCallback)completion {
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId];
    NSDictionary *params = @{@"content": content};
    
    [[SkillHTTPClient sharedClient] POST:url parameters:params success:^(id responseObject) {
        SkillMessage *message = [[SkillMessage alloc] initWithDictionary:responseObject];
        
        SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
        if (statusCallback) {
            statusCallback(SessionStatusExecuting);
        }
        
        if (completion) {
            completion(message, nil);
        }
    } failure:^(NSError *error) {
        if (completion) {
            completion(nil, error);
        }
    }];
}

#pragma mark - 12. Reply Permission

- (void)replyPermissionWithSessionId:(NSString *)sessionId
                         permissionId:(NSString *)permissionId
                             approved:(BOOL)approved
                           completion:(SkillResultCallback)completion {
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/permissions/%@", sessionId, permissionId];
    NSDictionary *params = @{@"approved": @(approved)};
    
    [[SkillHTTPClient sharedClient] POST:url parameters:params success:^(id responseObject) {
        if (completion) {
            completion(responseObject, nil);
        }
    } failure:^(NSError *error) {
        if (completion) {
            completion(nil, error);
        }
    }];
}

#pragma mark - 13. Control Skill WeCode

- (void)controlSkillWeCodeWithAction:(SkillWeCodeAction)action
                          completion:(SkillResultCallback)completion {
    
    // 注意：该接口仅通过 onSkillWecodeStatusChange 回调通知上层应用，不处理 WebSocket 连接
    
    if (action == SkillWeCodeActionClose) {
        // 关闭小程序 - 仅通知状态，由上层应用决定是否调用 closeSkill
        if (self.wecodeStatusCallback) {
            self.wecodeStatusCallback(SkillWecodeStatusClosed);
        }
        
    } else if (action == SkillWeCodeActionMinimize) {
        // 最小化小程序 - 仅通知状态，由上层应用决定是否调用 stopSkill
        if (self.wecodeStatusCallback) {
            self.wecodeStatusCallback(SkillWecodeStatusMinimized);
        }
    }
    
    if (completion) {
        completion(@{@"status": @"success"}, nil);
    }
}

#pragma mark - SkillWebSocketDelegate

- (void)webSocketDidOpen {
}

- (void)webSocketDidReceiveMessage:(StreamMessage *)message {
    NSString *sessionId = message.sessionId;
    
    if (message.type == StreamMessageTypeDelta) {
        [[StreamingMessageCache sharedCache] appendDeltaMessage:message forSessionId:sessionId];
        
        SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
        if (statusCallback) {
            statusCallback(SessionStatusExecuting);
        }
    } else if (message.type == StreamMessageTypeDone) {
        [[StreamingMessageCache sharedCache] markStreamingCompleteForSessionId:sessionId];
        
        SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
        if (statusCallback) {
            statusCallback(SessionStatusCompleted);
        }
    } else if (message.type == StreamMessageTypeError) {
        [[StreamingMessageCache sharedCache] clearCacheForSessionId:sessionId];
        
        SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
        if (statusCallback) {
            statusCallback(SessionStatusStopped);
        }
    } else if (message.type == StreamMessageTypeAgentOffline) {
        SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
        if (statusCallback) {
            statusCallback(SessionStatusStopped);
        }
    } else if (message.type == StreamMessageTypeAgentOnline) {
        SessionStatusCallback statusCallback = self.statusCallbacks[sessionId];
        if (statusCallback) {
            statusCallback(SessionStatusExecuting);
        }
    }
    
    NSArray<StreamMessageCallback> *callbacks = self.messageListeners[sessionId];
    for (StreamMessageCallback callback in callbacks) {
        callback(message);
    }
}

- (void)webSocketDidFailWithError:(NSError *)error {
    for (NSString *sessionId in self.errorListeners) {
        NSArray<SessionErrorCallback> *callbacks = self.errorListeners[sessionId];
        for (SessionErrorCallback callback in callbacks) {
            callback(error);
        }
    }
}

- (void)webSocketDidCloseWithReason:(NSString *)reason {
    for (NSString *sessionId in self.closeListeners) {
        NSArray<SessionCloseCallback> *callbacks = self.closeListeners[sessionId];
        for (SessionCloseCallback callback in callbacks) {
            callback(reason);
        }
    }
}

@end