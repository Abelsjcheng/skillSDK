//
//  WLAgentSkillsSDK.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsSDK.h"
#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsStreamingCache.h"
#import "WLAgentSkillsWebSocketManager.h"
#import "WLAgentSkillsConfig.h"
#import "WLAgentSkillsTypeConverter.h"
#import "WLAgentSkillsWeAgentStore.h"

static NSString * const WLAgentSkillsSDKErrorDomain = @"com.wlagentskills.sdk";
static NSString * const WLAgentSkillsAssistantH5URI = @"h5://S008623/index.html";
static NSString * const WLAgentSkillsWeAgentCUIAppId = @"S008623";

@interface WLAgentSkillsSDK () <WLAgentSkillsWebSocketManagerDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionStatusCallback> *sessionStatusCallbacks;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *sendMessageTriggeredBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *stopSkillHoldingBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *lastSessionStatusBySession;
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

+ (void)configureWithBaseURL:(NSString *)baseURL assistantBaseURL:(nullable NSString *)assistantBaseURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL assistantBaseURL:assistantBaseURL];
    [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
}

+ (void)configureWithBaseURL:(NSString *)baseURL webSocketURL:(nullable NSString *)webSocketURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL webSocketURL:webSocketURL];
    [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
}

+ (void)configureWithBaseURL:(NSString *)baseURL
            assistantBaseURL:(nullable NSString *)assistantBaseURL
                webSocketURL:(nullable NSString *)webSocketURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL
                                            assistantBaseURL:assistantBaseURL
                                                webSocketURL:webSocketURL];
    [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sessionStatusCallbacks = [NSMutableDictionary dictionary];
        _sendMessageTriggeredBySession = [NSMutableDictionary dictionary];
        _stopSkillHoldingBySession = [NSMutableDictionary dictionary];
        _lastSessionStatusBySession = [NSMutableDictionary dictionary];
        [WLAgentSkillsWebSocketManager sharedManager].delegate = self;
    }
    return self;
}

#pragma mark - 1. createSession

- (void)createSession:(WLAgentSkillsCreateSessionParams *)params
                            success:(void (^)(WLAgentSkillsSkillSession *session))success
                            failure:(void (^)(NSError *error))failure {
    if (params == nil || params.imGroupId == nil || params.imGroupId.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: imGroupId is required."];
        return;
    }
    if (params.ak != nil && params.ak.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: ak cannot be empty."];
        return;
    }
    if (params.title != nil && params.title.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: title cannot be empty."];
        return;
    }

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getSessionsWithImGroupId:params.imGroupId
                                                                                                                                ak:params.ak
                                                                                                                        status:@"ACTIVE"
                                                                                                                                page:@0
                                                                                                                                size:@20
                                                                                                                        success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        NSArray *content = [data[@"content"] isKindOfClass:[NSArray class]] ? data[@"content"] : @[];
        NSDictionary *existing = [weakSelf pickLatestActiveSessionFromArray:content
                                                                                                                                        ak:params.ak
                                                                                                                            imGroupId:params.imGroupId];

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
    @synchronized(self) {
        [self.sendMessageTriggeredBySession removeAllObjects];
        [self.stopSkillHoldingBySession removeAllObjects];
        [self.lastSessionStatusBySession removeAllObjects];
    }

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
    if (params == nil || params.welinkSessionId == nil || params.welinkSessionId.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
        return;
    }

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] abortSessionWithSessionId:params.welinkSessionId
                                                                                                                            success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsStopSkillResult *result = [[WLAgentSkillsStopSkillResult alloc] initWithDictionary:data];
        [weakSelf setSendMessageTriggered:NO sessionId:params.welinkSessionId];
        [weakSelf setStopSkillHolding:YES sessionId:params.welinkSessionId];
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
    if (params == nil || params.welinkSessionId == nil || params.welinkSessionId.length == 0 || params.callback == nil) {
        return;
    }
    @synchronized(self) {
        self.sessionStatusCallbacks[params.welinkSessionId] = [params.callback copy];
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
    if (params == nil || params.welinkSessionId == nil || params.welinkSessionId.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
        return;
    }

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    NSString *cachedContent = [[WLAgentSkillsStreamingCache sharedCache] lastUserMessageContentForSessionId:params.welinkSessionId];
    if (cachedContent != nil && cachedContent.length > 0) {
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
        if (content == nil || content.length == 0) {
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
    if (params == nil || params.welinkSessionId == nil || params.welinkSessionId.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
        return;
    }
    NSString *normalizedMessageId = [self normalizedOptionalString:params.messageId];
    NSString *normalizedChatId = [self normalizedOptionalString:params.chatId];

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    void (^sendWithContent)(NSString *) = ^(NSString *content) {
        [[WLAgentSkillsHTTPClient sharedClient] sendToIMWithSessionId:params.welinkSessionId
                                                                                                                    content:content
                                                                                                                        chatId:normalizedChatId
                                                                                                                    success:^(id  _Nullable responseObject) {
                if (![responseObject isKindOfClass:[NSDictionary class]]) {
                    NSString *responseType = responseObject != nil
                            ? NSStringFromClass([responseObject class])
                            : @"nil";
                    NSString *message = [NSString stringWithFormat:@"Invalid sendMessageToIM response type: %@.", responseType];
                    [weakSelf dispatchFailure:failure code:5006 message:message];
                    return;
                }

                WLAgentSkillsSendMessageToIMResult *result = [[WLAgentSkillsSendMessageToIMResult alloc] init];
                NSDictionary *dict = (NSDictionary *)responseObject;
                if (dict[@"success"] != nil) {
                    result.success = [dict[@"success"] boolValue];
                } else if (dict[@"status"] != nil) {
                    result.success = [[dict[@"status"] description] isEqualToString:@"success"];
                } else {
                    result.success = YES;
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
                                                                                                                            messageId:normalizedMessageId];
    if (content != nil && content.length > 0) {
        sendWithContent(content);
        return;
    }

    [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                                                                                                page:@0
                                                                                                                                size:@100
                                                                                                                        success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsPageResult *pageResult = [[WLAgentSkillsPageResult alloc] initWithDictionary:data];
        [[WLAgentSkillsStreamingCache sharedCache] cacheHistoryMessages:pageResult.content
                                                                                                                forSessionId:params.welinkSessionId];

        NSString *latest = [[WLAgentSkillsStreamingCache sharedCache] latestCompletedContentForSessionId:params.welinkSessionId
                                                                                                                            messageId:normalizedMessageId];
        if (latest == nil || latest.length == 0) {
            NSInteger code = 4005;
            NSString *message = @"No completed message available.";
            if (normalizedMessageId != nil) {
                BOOL exists = [[WLAgentSkillsStreamingCache sharedCache] hasMessageForSessionId:params.welinkSessionId
                                                                                                                                                                                                messageId:normalizedMessageId];
                if (!exists) {
                    code = 4003;
                    message = @"Message not found in SDK cache.";
                } else {
                    BOOL completed = [[WLAgentSkillsStreamingCache sharedCache] isMessageCompletedForSessionId:params.welinkSessionId
                                                                                                                                                                                                    messageId:normalizedMessageId];
                    if (!completed) {
                        code = 4004;
                        message = @"Message is not completed.";
                    }
                }
            }
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
    if (params == nil || params.welinkSessionId == nil || params.welinkSessionId.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
        return;
    }

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    NSNumber *page = params.page ?: @0;
    NSNumber *size = params.size ?: @50;
    BOOL isFirst = params.isFirst;

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                                                                                                page:page
                                                                                                                                size:size
                                                                                                                        success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsPageResult *serverPage = [strongSelf normalizedPageResultFromDictionary:data
                                                                                                                    requestPage:page
                                                                                                                    requestSize:size];

        if (!isFirst) {
            [[WLAgentSkillsStreamingCache sharedCache] cacheHistoryMessages:serverPage.content
                                                                                                                forSessionId:params.welinkSessionId];
            if (success) {
                success(serverPage);
            }
            return;
        }

        WLAgentSkillsSessionMessage *localLatest = [[WLAgentSkillsStreamingCache sharedCache] latestLocalMessageNotInServerMessages:serverPage.content
                                                                                                                                                                                                                                            sessionId:params.welinkSessionId];
        if (localLatest == nil) {
            if (success) {
                success(serverPage);
            }
            return;
        }

        NSMutableArray<WLAgentSkillsSessionMessage *> *merged = [NSMutableArray arrayWithObject:localLatest];
        for (WLAgentSkillsSessionMessage *message in serverPage.content) {
            if ([strongSelf isSameSessionMessage:message other:localLatest]) {
                continue;
            }
            [merged addObject:message];
        }

        NSMutableArray *dictContent = [NSMutableArray arrayWithCapacity:merged.count];
        for (WLAgentSkillsSessionMessage *message in merged) {
            [dictContent addObject:[message toDictionary]];
        }

        NSDictionary *pageDict = @{
            @"content" : dictContent,
            @"page" : serverPage.page ?: @0,
            @"size" : serverPage.size ?: @50,
            @"total" : serverPage.total ?: @0,
            @"totalPages" : serverPage.totalPages ?: @0
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

#pragma mark - 8.1 getSessionMessageHistory

- (void)getSessionMessageHistory:(WLAgentSkillsGetSessionMessageHistoryParams *)params
                                success:(void (^)(WLAgentSkillsCursorResult *result))success
                                failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *welinkSessionId = [WLAgentSkillsTypeConverter requiredStringFromValue:params.welinkSessionId
                                                                           fieldName:@"welinkSessionId"
                                                                        errorMessage:&errorMessage];
    if (welinkSessionId == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    NSNumber *beforeSeq = [WLAgentSkillsTypeConverter integerNumberFromValue:params.beforeSeq
                                                                    fieldName:@"beforeSeq"
                                                                 errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    if (beforeSeq != nil && beforeSeq.integerValue < 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: beforeSeq must be greater than or equal to 0."];
        return;
    }

    NSInteger sizeValue = [WLAgentSkillsTypeConverter positiveIntegerFromValue:params.size
                                                                   defaultValue:50
                                                                       fieldName:@"size"
                                                                    errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSNumber *size = @(sizeValue);

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getMessageHistoryWithSessionId:welinkSessionId
                                                                  beforeSeq:beforeSeq
                                                                       size:size
                                                                    success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsCursorResult *result = [strongSelf normalizedCursorResultFromDictionary:data requestSize:size];
        [[WLAgentSkillsStreamingCache sharedCache] cacheHistoryMessages:result.content
                                                           forSessionId:welinkSessionId];
        if (success) {
            success(result);
        }
    }
                                                                    failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 9. registerSessionListener

- (WLAgentSkillsRegisterSessionListenerResult *)registerSessionListener:(WLAgentSkillsRegisterSessionListenerParams *)params {
    if (params == nil || params.welinkSessionId == nil || params.welinkSessionId.length == 0 || params.onMessage == nil) {
        return [self buildRegisterSessionListenerResult];
    }

    [[WLAgentSkillsWebSocketManager sharedManager] addListenerForSessionId:params.welinkSessionId
                                                                                                                                onMessage:params.onMessage
                                                                                                                                    onError:params.onError
                                                                                                                                    onClose:params.onClose];
    return [self buildRegisterSessionListenerResult];
}

#pragma mark - 10. unregisterSessionListener

- (WLAgentSkillsUnregisterSessionListenerResult *)unregisterSessionListener:(WLAgentSkillsUnregisterSessionListenerParams *)params {
    if (params != nil && params.welinkSessionId != nil && params.welinkSessionId.length > 0) {
        [[WLAgentSkillsWebSocketManager sharedManager] removeListenerForSessionId:params.welinkSessionId];
    }
    return [self buildUnregisterSessionListenerResult];
}

#pragma mark - 11. sendMessage

- (void)sendMessage:(WLAgentSkillsSendMessageParams *)params
                        success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                        failure:(void (^)(NSError *error))failure {
    if (params == nil ||
            params.welinkSessionId == nil ||
            params.welinkSessionId.length == 0 ||
            params.content == nil ||
            params.content.length == 0) {
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
    if (params == nil ||
            params.welinkSessionId == nil ||
            params.welinkSessionId.length == 0 ||
            params.permId == nil ||
            params.permId.length == 0 ||
            params.response == nil ||
            params.response.length == 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params for replyPermission."];
        return;
    }

    NSSet *validResponses = [NSSet setWithArray:@[@"once", @"always", @"reject"]];
    if (![validResponses containsObject:params.response]) {
        [self dispatchFailure:failure code:1000 message:@"response must be once/always/reject."];
        return;
    }

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

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

#pragma mark - 14. createNewSession

- (void)createNewSession:(WLAgentSkillsCreateNewSessionParams *)params
                success:(void (^)(WLAgentSkillsSkillSession *session))success
                failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *ak = [WLAgentSkillsTypeConverter requiredStringFromValue:params.ak
                                                              fieldName:@"ak"
                                                           errorMessage:&errorMessage];
    if (ak == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *bussinessDomain = [WLAgentSkillsTypeConverter requiredStringFromValue:params.bussinessDomain
                                                                            fieldName:@"bussinessDomain"
                                                                         errorMessage:&errorMessage];
    if (bussinessDomain == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *bussinessType = [WLAgentSkillsTypeConverter requiredStringFromValue:params.bussinessType
                                                                          fieldName:@"bussinessType"
                                                                       errorMessage:&errorMessage];
    if (bussinessType == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *bussinessId = [WLAgentSkillsTypeConverter requiredStringFromValue:params.bussinessId
                                                                        fieldName:@"bussinessId"
                                                                     errorMessage:&errorMessage];
    if (bussinessId == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *assistantAccount = [WLAgentSkillsTypeConverter requiredStringFromValue:params.assistantAccount
                                                                              fieldName:@"assistantAccount"
                                                                           errorMessage:&errorMessage];
    if (assistantAccount == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *title = [WLAgentSkillsTypeConverter optionalStringFromValue:params.title];

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] createNewSessionWithAK:ak
                                                             title:title
                                                   bussinessDomain:bussinessDomain
                                                     bussinessType:bussinessType
                                                       bussinessId:bussinessId
                                                   assistantAccount:assistantAccount
                                                            success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsSkillSession *session = [[WLAgentSkillsSkillSession alloc] initWithDictionary:data];
        if (success) {
            success(session);
        }
    }
                                                            failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 15. getHistorySessionsList

- (void)getHistorySessionsList:(WLAgentSkillsHistorySessionsParams *)params
                        success:(void (^)(WLAgentSkillsSkillSessionPageResult *result))success
                        failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSInteger pageValue = [WLAgentSkillsTypeConverter nonNegativeIntegerFromValue:params.page
                                                                      defaultValue:0
                                                                          fieldName:@"page"
                                                                       errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSInteger sizeValue = [WLAgentSkillsTypeConverter positiveIntegerFromValue:params.size
                                                                   defaultValue:50
                                                                       fieldName:@"size"
                                                                    errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    NSString *status = [WLAgentSkillsTypeConverter optionalStringFromValue:params.status];
    if (status != nil) {
        status = [status uppercaseString];
    }
    if (status != nil) {
        NSSet *validStatuses = [NSSet setWithArray:@[@"ACTIVE", @"IDLE", @"CLOSED"]];
        if (![validStatuses containsObject:status]) {
            [self dispatchFailure:failure code:1000 message:@"status must be ACTIVE/IDLE/CLOSED."];
            return;
        }
    }

    NSNumber *page = @(pageValue);
    NSNumber *size = @(sizeValue);
    NSString *ak = [WLAgentSkillsTypeConverter optionalStringFromValue:params.ak];
    NSString *bussinessId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.bussinessId];
    NSString *assistantAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.assistantAccount];
    NSString *businessSessionDomain = [WLAgentSkillsTypeConverter optionalStringFromValue:params.businessSessionDomain];
    if (businessSessionDomain != nil) {
        businessSessionDomain = [businessSessionDomain lowercaseString];
        NSSet *validBusinessSessionDomains = [NSSet setWithArray:@[@"miniapp", @"im"]];
        if (![validBusinessSessionDomains containsObject:businessSessionDomain]) {
            [self dispatchFailure:failure code:1000 message:@"businessSessionDomain must be miniapp/im."];
            return;
        }
    }

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getHistorySessionsWithPage:page
                                                                   size:size
                                                                 status:status
                                                                     ak:ak
                                                             bussinessId:bussinessId
                                                         assistantAccount:assistantAccount
                                                    businessSessionDomain:businessSessionDomain
                                                                success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsSkillSessionPageResult *result = [strongSelf normalizedSkillSessionPageResultFromDictionary:data
                                                                                                     requestPage:page
                                                                                                     requestSize:size];
        if (success) {
            success(result);
        }
    }
                                                                failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 16. createDigitalTwin

- (void)createDigitalTwin:(WLAgentSkillsCreateDigitalTwinParams *)params
                    success:(void (^)(WLAgentSkillsCreateDigitalTwinResult *result))success
                    failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *name = [WLAgentSkillsTypeConverter requiredStringFromValue:params.name
                                                                fieldName:@"name"
                                                             errorMessage:&errorMessage];
    if (name == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *icon = [WLAgentSkillsTypeConverter requiredStringFromValue:params.icon
                                                                fieldName:@"icon"
                                                             errorMessage:&errorMessage];
    if (icon == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    id descriptionCandidate = params.descriptionValue != nil ? params.descriptionValue : params.desc;
    NSString *desc = [WLAgentSkillsTypeConverter requiredStringFromValue:descriptionCandidate
                                                                 fieldName:@"description"
                                                              errorMessage:&errorMessage];
    if (desc == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSInteger weCrewType = [WLAgentSkillsTypeConverter requiredIntegerFromValue:params.weCrewType
                                                                        fieldName:@"weCrewType"
                                                                     errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    if (!(weCrewType == 0 || weCrewType == 1)) {
        [self dispatchFailure:failure code:1000 message:@"weCrewType must be 0 or 1."];
        return;
    }
    NSString *bizRobotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.bizRobotId];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] createDigitalTwinWithName:name
                                                                  icon:icon
                                                          description:desc
                                                          weCrewType:@(weCrewType)
                                                          bizRobotId:bizRobotId
                                                              success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsCreateDigitalTwinResult *result = [[WLAgentSkillsCreateDigitalTwinResult alloc] initWithDictionary:data];
        if (result.message == nil || result.message.length == 0) {
            result.message = @"success";
        }
        if (success) {
            success(result);
        }
    }
                                                              failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 17. getAgentType

- (void)getAgentTypeWithSuccess:(void (^)(WLAgentSkillsAgentTypeListResult *result))success
                        failure:(void (^)(NSError *error))failure {
    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getAgentTypeWithSuccess:^(id  _Nullable responseObject) {
        NSArray<WLAgentSkillsAgentType *> *list = [self parseAgentTypeListFromResponse:responseObject];
        WLAgentSkillsAgentTypeListResult *result = [[WLAgentSkillsAgentTypeListResult alloc] init];
        result.content = list;
        if (success) {
            success(result);
        }
    } failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 18. getWeAgentList

- (void)getWeAgentList:(WLAgentSkillsPageParams *)params
                success:(void (^)(WLAgentSkillsWeAgentListResult *result))success
                failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSInteger pageSize = 0;
    NSInteger pageNumber = 0;
    NSString *errorMessage = nil;

    pageSize = [WLAgentSkillsTypeConverter requiredIntegerFromValue:params.pageSize
                                                           fieldName:@"pageSize"
                                                        errorMessage:&errorMessage];
    if (errorMessage != nil || pageSize <= 0) {
        [self dispatchFailure:failure code:1000 message:errorMessage ?: @"pageSize must be a positive integer."];
        return;
    }
    pageNumber = [WLAgentSkillsTypeConverter requiredIntegerFromValue:params.pageNumber
                                                              fieldName:@"pageNumber"
                                                           errorMessage:&errorMessage];
    if (errorMessage != nil || pageNumber <= 0) {
        [self dispatchFailure:failure code:1000 message:errorMessage ?: @"pageNumber must be a positive integer."];
        return;
    }

    pageSize = [self clampInteger:pageSize min:1 max:100];
    pageNumber = [self clampInteger:pageNumber min:1 max:1000];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentListWithPageSize:@(pageSize)
                                                              pageNumber:@(pageNumber)
                                                                 success:^(id  _Nullable responseObject) {
        NSArray<WLAgentSkillsWeAgent *> *remoteList = [self parseWeAgentListFromResponse:responseObject];
        [[WLAgentSkillsWeAgentStore sharedStore] saveWeAgentListDictionaries:[self dictionariesFromWeAgentList:remoteList]];
        WLAgentSkillsWeAgentListResult *result = [[WLAgentSkillsWeAgentListResult alloc] init];
        result.content = remoteList;
        if (success) {
            success(result);
        }
    }
                                                                 failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 19. getWeAgentDetails

- (void)getWeAgentDetails:(WLAgentSkillsQueryWeAgentParams *)params
                    success:(void (^)(WLAgentSkillsWeAgentDetailsArrayResult *result))success
                    failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *partnerAccount = [WLAgentSkillsTypeConverter requiredStringFromValue:params.partnerAccount
                                                                          fieldName:@"partnerAccount"
                                                                       errorMessage:&errorMessage];
    if (partnerAccount == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                         success:^(id  _Nullable responseObject) {
        NSArray<WLAgentSkillsWeAgentDetails *> *detailsList = [self parseWeAgentDetailsListFromResponse:responseObject];
        if (detailsList.count > 0) {
            [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:[detailsList.firstObject toDictionary]];
        }
        WLAgentSkillsWeAgentDetailsArrayResult *result = [[WLAgentSkillsWeAgentDetailsArrayResult alloc] init];
        result.WeAgentDetailsArray = detailsList;
        if (success) {
            success(result);
        }
    }
                                                                         failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 20. getWeAgentUri

- (WLAgentSkillsWeAgentUriResult *)getWeAgentUri {
    NSDictionary *detailDictionary = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
    WLAgentSkillsWeAgentUriResult *result = [[WLAgentSkillsWeAgentUriResult alloc] init];
    if (detailDictionary == nil || detailDictionary.count == 0) {
        NSString *fallbackWeAgentUri = [self appendQueryItemToUri:WLAgentSkillsAssistantH5URI
                                                              key:@"wecodePlace"
                                                            value:@"weAgent"];
        result.weAgentUri = [self appendHashToUri:fallbackWeAgentUri hash:@"activateAssistant"] ?: @"";
        result.assistantDetailUri = @"";
        result.switchAssistantUri = @"";
        return result;
    }

    WLAgentSkillsWeAgentDetails *details = [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:detailDictionary];
    NSString *weCodeUrl = [WLAgentSkillsTypeConverter optionalStringFromValue:details.weCodeUrl];
    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:details.partnerAccount];
    NSString *detailId = [WLAgentSkillsTypeConverter optionalStringFromValue:details.id];
    NSString *weCodeUrlHost = [self hostFromUri:weCodeUrl];

    NSString *baseWeAgentUri = [self appendQueryItemToUri:weCodeUrl key:@"wecodePlace" value:@"weAgent"];
    if (weCodeUrlHost != nil && [weCodeUrlHost caseInsensitiveCompare:WLAgentSkillsWeAgentCUIAppId] == NSOrderedSame) {
        result.weAgentUri = [self appendQueryItemToUri:baseWeAgentUri key:@"assistantAccount" value:partnerAccount] ?: @"";
    } else {
        result.weAgentUri = [self appendQueryItemToUri:baseWeAgentUri key:@"robotId" value:detailId] ?: @"";
    }

    NSString *assistantDetailUri = [self appendQueryItemToUri:WLAgentSkillsAssistantH5URI
                                                          key:@"partnerAccount"
                                                        value:partnerAccount];
    result.assistantDetailUri = [self appendHashToUri:assistantDetailUri hash:@"assistantDetail"] ?: @"";

    NSString *switchAssistantUri = [self appendQueryItemToUri:WLAgentSkillsAssistantH5URI
                                                          key:@"partnerAccount"
                                                        value:partnerAccount];
    result.switchAssistantUri = [self appendHashToUri:switchAssistantUri hash:@"switchAssistant"] ?: @"";
    return result;
}

#pragma mark - WLAgentSkillsWebSocketManagerDelegate

- (void)webSocketManagerDidReceiveMessage:(WLAgentSkillsStreamMessage *)message {
    [[WLAgentSkillsStreamingCache sharedCache] updateWithStreamMessage:message];

    NSString *sessionId = message.welinkSessionId;
    if (sessionId == nil || sessionId.length == 0) {
        return;
    }

    NSInteger mappedStatus = [self mapStreamMessageToSessionStatus:message sessionId:sessionId];
    if (mappedStatus == NSNotFound) {
        return;
    }

    [self emitSessionStatus:(WLAgentSkillsClientSessionStatus)mappedStatus sessionId:sessionId];
}

#pragma mark - Internal Helpers

- (void)sendMessageWithSessionId:(NSString *)welinkSessionId
                                                    content:(NSString *)content
                                            toolCallId:(nullable NSString *)toolCallId
                                                    success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                                                    failure:(void (^)(NSError *error))failure {
    [self setSendMessageTriggered:YES sessionId:welinkSessionId];
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
        [weakSelf setSendMessageTriggered:NO sessionId:welinkSessionId];
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

- (nullable NSDictionary *)pickLatestActiveSessionFromArray:(NSArray *)sessions
                                                                                                                    ak:(nullable NSString *)ak
                                                                                                    imGroupId:(NSString *)imGroupId {
    if (sessions.count == 0) {
        return nil;
    }

    static NSISO8601DateFormatter *formatter = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        formatter = [[NSISO8601DateFormatter alloc] init];
    });

    NSDictionary *latest = nil;
    NSDate *latestUpdatedAt = [NSDate dateWithTimeIntervalSince1970:0];
    for (id item in sessions) {
        if (![item isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        NSDictionary *session = (NSDictionary *)item;
        NSString *status = [session[@"status"] isKindOfClass:[NSString class]] ? session[@"status"] : @"";
        if (![status isEqualToString:@"ACTIVE"]) {
            continue;
        }
        NSString *sessionAK = [session[@"ak"] isKindOfClass:[NSString class]] ? session[@"ak"] : @"";
        NSString *sessionImGroupId = [session[@"imGroupId"] isKindOfClass:[NSString class]] ? session[@"imGroupId"] : @"";
        if (ak != nil && ak.length > 0 && ![ak isEqualToString:sessionAK]) {
            continue;
        }
        if (imGroupId.length > 0 && ![imGroupId isEqualToString:sessionImGroupId]) {
            continue;
        }

        NSString *updatedAtRaw = [session[@"updatedAt"] isKindOfClass:[NSString class]] ? session[@"updatedAt"] : @"";
        NSDate *updatedAt = updatedAtRaw.length > 0 ? [formatter dateFromString:updatedAtRaw] : nil;
        if (updatedAt == nil) {
            updatedAt = [NSDate dateWithTimeIntervalSince1970:0];
        }

        if (latest == nil || [updatedAt compare:latestUpdatedAt] == NSOrderedDescending) {
            latest = session;
            latestUpdatedAt = updatedAt;
        }
    }
    return latest;
}

- (nullable NSString *)normalizedOptionalString:(nullable NSString *)value {
    if (value == nil) {
        return nil;
    }
    NSString *trimmed = [value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    return trimmed != nil && trimmed.length > 0 ? trimmed : nil;
}

- (WLAgentSkillsPageResult *)normalizedPageResultFromDictionary:(NSDictionary *)dictionary
                                                                                                                requestPage:(NSNumber *)requestPage
                                                                                                                requestSize:(NSNumber *)requestSize {
    WLAgentSkillsPageResult *raw = [[WLAgentSkillsPageResult alloc] initWithDictionary:dictionary];
    NSNumber *safePage = raw.page ?: (requestPage ?: @0);
    NSInteger safeSizeValue = raw.size != nil && raw.size.integerValue > 0
        ? raw.size.integerValue
        : (requestSize != nil && requestSize.integerValue > 0 ? requestSize.integerValue : 50);
    NSNumber *safeSize = @(safeSizeValue);
    NSNumber *safeTotal = raw.total ?: @((NSInteger)raw.content.count);
    NSNumber *safeTotalPages = raw.totalPages;
    if (safeTotalPages == nil || safeTotalPages.integerValue < 0) {
        NSInteger totalPages = 0;
        if (safeTotal.longLongValue > 0 && safeSizeValue > 0) {
            totalPages = (NSInteger)((safeTotal.longLongValue + safeSizeValue - 1) / safeSizeValue);
        }
        safeTotalPages = @(totalPages);
    }

    NSMutableArray *dictContent = [NSMutableArray arrayWithCapacity:raw.content.count];
    for (WLAgentSkillsSessionMessage *message in raw.content) {
        [dictContent addObject:[message toDictionary]];
    }

    NSDictionary *normalized = @{
        @"content" : dictContent,
        @"page" : safePage,
        @"size" : safeSize,
        @"total" : safeTotal,
        @"totalPages" : safeTotalPages
    };
    return [[WLAgentSkillsPageResult alloc] initWithDictionary:normalized];
}

- (WLAgentSkillsCursorResult *)normalizedCursorResultFromDictionary:(NSDictionary *)dictionary
                                                         requestSize:(NSNumber *)requestSize {
    WLAgentSkillsCursorResult *raw = [[WLAgentSkillsCursorResult alloc] initWithDictionary:dictionary];
    NSInteger safeSizeValue = raw.size != nil && raw.size.integerValue > 0
        ? raw.size.integerValue
        : (requestSize != nil && requestSize.integerValue > 0 ? requestSize.integerValue : 50);
    NSNumber *safeSize = @(safeSizeValue);

    NSMutableArray *dictContent = [NSMutableArray arrayWithCapacity:raw.content.count];
    for (WLAgentSkillsSessionMessage *message in raw.content) {
        [dictContent addObject:[message toDictionary]];
    }

    NSDictionary *normalized = @{
        @"content" : dictContent,
        @"size" : safeSize,
        @"hasMore" : @([self resolveBoolValue:dictionary[@"hasMore"] fallback:raw.hasMore]),
        @"nextBeforeSeq" : raw.nextBeforeSeq ?: [NSNull null]
    };
    return [[WLAgentSkillsCursorResult alloc] initWithDictionary:normalized];
}

- (BOOL)resolveBoolValue:(id)value fallback:(BOOL)fallback {
    if ([value isKindOfClass:[NSNumber class]]) {
        return [(NSNumber *)value boolValue];
    }
    if ([value isKindOfClass:[NSString class]]) {
        NSString *normalized = [((NSString *)value) lowercaseString];
        if ([normalized isEqualToString:@"true"] || [normalized isEqualToString:@"1"]) {
            return YES;
        }
        if ([normalized isEqualToString:@"false"] || [normalized isEqualToString:@"0"]) {
            return NO;
        }
    }
    return fallback;
}

- (WLAgentSkillsSkillSessionPageResult *)normalizedSkillSessionPageResultFromDictionary:(NSDictionary *)dictionary
                                                                                 requestPage:(NSNumber *)requestPage
                                                                                 requestSize:(NSNumber *)requestSize {
    WLAgentSkillsSkillSessionPageResult *raw = [[WLAgentSkillsSkillSessionPageResult alloc] initWithDictionary:dictionary];
    NSNumber *safePage = raw.page ?: (requestPage ?: @0);
    NSInteger safeSizeValue = raw.size != nil && raw.size.integerValue > 0
        ? raw.size.integerValue
        : (requestSize != nil && requestSize.integerValue > 0 ? requestSize.integerValue : 50);
    NSNumber *safeSize = @(safeSizeValue);
    NSNumber *safeTotal = raw.total ?: @((NSInteger)raw.content.count);
    NSNumber *safeTotalPages = raw.totalPages;
    if (safeTotalPages == nil || safeTotalPages.integerValue < 0) {
        NSInteger totalPages = 0;
        if (safeTotal.longLongValue > 0 && safeSizeValue > 0) {
            totalPages = (NSInteger)((safeTotal.longLongValue + safeSizeValue - 1) / safeSizeValue);
        }
        safeTotalPages = @(totalPages);
    }

    raw.page = safePage;
    raw.size = safeSize;
    raw.total = safeTotal;
    raw.totalPages = safeTotalPages;
    raw.number = safePage;
    raw.totalElements = safeTotal;
    return raw;
}

- (NSArray<WLAgentSkillsAgentType *> *)parseAgentTypeListFromResponse:(id)responseObject {
    NSMutableArray<WLAgentSkillsAgentType *> *result = [NSMutableArray array];
    if (![responseObject isKindOfClass:[NSArray class]]) {
        return @[];
    }

    for (id item in (NSArray *)responseObject) {
        if (![item isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        [result addObject:[[WLAgentSkillsAgentType alloc] initWithDictionary:(NSDictionary *)item]];
    }
    return [result copy];
}

- (NSArray<WLAgentSkillsWeAgent *> *)parseWeAgentListFromResponse:(id)responseObject {
    NSMutableArray<WLAgentSkillsWeAgent *> *result = [NSMutableArray array];
    if (![responseObject isKindOfClass:[NSArray class]]) {
        return @[];
    }

    for (id item in (NSArray *)responseObject) {
        if (![item isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        [result addObject:[[WLAgentSkillsWeAgent alloc] initWithDictionary:(NSDictionary *)item]];
    }
    return [result copy];
}

- (NSArray<WLAgentSkillsWeAgentDetails *> *)parseWeAgentDetailsListFromResponse:(id)responseObject {
    NSMutableArray<WLAgentSkillsWeAgentDetails *> *result = [NSMutableArray array];
    if ([responseObject isKindOfClass:[NSDictionary class]]) {
        [result addObject:[[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:(NSDictionary *)responseObject]];
        return [result copy];
    }
    if (![responseObject isKindOfClass:[NSArray class]]) {
        return @[];
    }

    for (id item in (NSArray *)responseObject) {
        if (![item isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        [result addObject:[[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:(NSDictionary *)item]];
    }
    return [result copy];
}

- (NSArray<NSDictionary *> *)dictionariesFromWeAgentList:(NSArray<WLAgentSkillsWeAgent *> *)list {
    NSMutableArray<NSDictionary *> *result = [NSMutableArray arrayWithCapacity:list.count];
    for (WLAgentSkillsWeAgent *item in list) {
        [result addObject:[item toDictionary]];
    }
    return [result copy];
}

- (NSInteger)clampInteger:(NSInteger)value min:(NSInteger)minValue max:(NSInteger)maxValue {
    return MAX(minValue, MIN(value, maxValue));
}

- (nullable NSString *)appendQueryItemToUri:(nullable NSString *)uri
                                        key:(NSString *)key
                                      value:(nullable NSString *)value {
    NSString *base = [WLAgentSkillsTypeConverter optionalStringFromValue:uri];
    if (base == nil || base.length == 0) {
        return nil;
    }
    NSString *safeValue = value ?: @"";

    NSURLComponents *components = [NSURLComponents componentsWithString:base];
    if (components != nil) {
        NSMutableArray<NSURLQueryItem *> *items = [NSMutableArray array];
        if (components.queryItems != nil) {
            [items addObjectsFromArray:components.queryItems];
        }
        [items addObject:[NSURLQueryItem queryItemWithName:key value:safeValue]];
        components.queryItems = items;
        if (components.string != nil && components.string.length > 0) {
            return components.string;
        }
    }

    NSString *separator = [base containsString:@"?"]
        ? (([base hasSuffix:@"?"] || [base hasSuffix:@"&"]) ? @"" : @"&")
        : @"?";
    NSString *encodedValue = [safeValue stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]] ?: @"";
    return [NSString stringWithFormat:@"%@%@%@=%@", base, separator, key, encodedValue];
}

- (nullable NSString *)appendHashToUri:(nullable NSString *)uri
                                   hash:(nullable NSString *)hash {
    NSString *base = [WLAgentSkillsTypeConverter optionalStringFromValue:uri];
    if (base == nil || base.length == 0) {
        return nil;
    }

    NSString *safeHash = [WLAgentSkillsTypeConverter optionalStringFromValue:hash] ?: @"";
    if (safeHash.length == 0) {
        return base;
    }

    NSURLComponents *components = [NSURLComponents componentsWithString:base];
    if (components != nil) {
        components.fragment = safeHash;
        if (components.string != nil && components.string.length > 0) {
            return components.string;
        }
    }

    NSRange hashRange = [base rangeOfString:@"#"];
    NSString *baseWithoutHash = hashRange.location == NSNotFound ? base : [base substringToIndex:hashRange.location];
    return [NSString stringWithFormat:@"%@#%@", baseWithoutHash, safeHash];
}

- (nullable NSString *)hostFromUri:(nullable NSString *)uri {
    NSString *base = [WLAgentSkillsTypeConverter optionalStringFromValue:uri];
    if (base == nil || base.length == 0) {
        return nil;
    }

    NSURLComponents *components = [NSURLComponents componentsWithString:base];
    NSString *host = components.host;
    return host.length > 0 ? host : nil;
}

- (BOOL)isSameSessionMessage:(WLAgentSkillsSessionMessage *)left
                                                                                            other:(WLAgentSkillsSessionMessage *)right {
    NSString *leftId = (left.id != nil && left.id.length > 0) ? left.id : @"";
    NSString *rightId = (right.id != nil && right.id.length > 0) ? right.id : @"";
    if (leftId.length > 0 && rightId.length > 0 && [leftId isEqualToString:rightId]) {
        return YES;
    }
    if (left.messageSeq != nil && right.messageSeq != nil) {
        return [left.messageSeq compare:right.messageSeq] == NSOrderedSame;
    }
    return NO;
}

- (NSInteger)mapStreamMessageToSessionStatus:(WLAgentSkillsStreamMessage *)message
                                                                        sessionId:(NSString *)sessionId {
    NSString *type = message.type ?: @"";

    if (![type isEqualToString:@"session.status"]) {
        return NSNotFound;
    }

    if ([message.sessionStatus isEqualToString:@"busy"] || [message.sessionStatus isEqualToString:@"retry"]) {
        if ([self isSendMessageTriggeredForSessionId:sessionId]) {
            [self setStopSkillHolding:NO sessionId:sessionId];
            return WLAgentSkillsClientSessionStatusExecuting;
        }
        return NSNotFound;
    }

    if ([message.sessionStatus isEqualToString:@"idle"]) {
        // Keep STOPPED after stopSkill; ignore idle until next round reaches busy/retry.
        if ([self isStopSkillHoldingForSessionId:sessionId]) {
            return NSNotFound;
        }
        [self setSendMessageTriggered:NO sessionId:sessionId];
        return WLAgentSkillsClientSessionStatusCompleted;
    }

    return NSNotFound;
}

- (void)emitSessionStatus:(WLAgentSkillsClientSessionStatus)status sessionId:(NSString *)sessionId {
    WLAgentSkillsSessionStatusCallback callback = nil;
    @synchronized(self) {
        NSNumber *lastStatus = self.lastSessionStatusBySession[sessionId];
        if (lastStatus != nil && lastStatus.integerValue == status) {
            return;
        }
        self.lastSessionStatusBySession[sessionId] = @(status);
        callback = self.sessionStatusCallbacks[sessionId];
    }

    if (callback == nil) {
        return;
    }

    WLAgentSkillsSessionStatusResult *result = [[WLAgentSkillsSessionStatusResult alloc] init];
    result.status = status;
    callback(result);
}

- (WLAgentSkillsRegisterSessionListenerResult *)buildRegisterSessionListenerResult {
    WLAgentSkillsRegisterSessionListenerResult *result = [[WLAgentSkillsRegisterSessionListenerResult alloc] init];
    result.status = @"success";
    return result;
}

- (WLAgentSkillsUnregisterSessionListenerResult *)buildUnregisterSessionListenerResult {
    WLAgentSkillsUnregisterSessionListenerResult *result = [[WLAgentSkillsUnregisterSessionListenerResult alloc] init];
    result.status = @"success";
    return result;
}

- (void)setSendMessageTriggered:(BOOL)triggered sessionId:(NSString *)sessionId {
    if (sessionId == nil || sessionId.length == 0) {
        return;
    }

    @synchronized(self) {
        self.sendMessageTriggeredBySession[sessionId] = @(triggered);
    }
}

- (BOOL)isSendMessageTriggeredForSessionId:(NSString *)sessionId {
    if (sessionId == nil || sessionId.length == 0) {
        return NO;
    }

    @synchronized(self) {
        return [self.sendMessageTriggeredBySession[sessionId] boolValue];
    }
}

- (void)setStopSkillHolding:(BOOL)holding sessionId:(NSString *)sessionId {
    if (sessionId == nil || sessionId.length == 0) {
        return;
    }

    @synchronized(self) {
        self.stopSkillHoldingBySession[sessionId] = @(holding);
    }
}

- (BOOL)isStopSkillHoldingForSessionId:(NSString *)sessionId {
    if (sessionId == nil || sessionId.length == 0) {
        return NO;
    }

    @synchronized(self) {
        return [self.stopSkillHoldingBySession[sessionId] boolValue];
    }
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
