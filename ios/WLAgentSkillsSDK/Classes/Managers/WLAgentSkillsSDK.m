//
//  WLAgentSkillsSDK.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsSDK.h"
#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsWebSocketManager.h"
#import "WLAgentSkillsConfig.h"
#import "WLAgentSkillsTypeConverter.h"
#import "WLAgentSkillsWeAgentStore.h"
#import "WLAgentSkillsLog.h"
@import UIKit;

static NSString * const WLAgentSkillsSDKErrorDomain = @"com.wlagentskills.sdk";
static NSString * const WLAgentSkillsAssistantH5URI = @"h5://S008623/index.html";
static NSString * const WLAgentSkillsWeAgentCUIAppId = @"S008623";
static NSString * const WLAgentSkillsWeAgentEventName = @"agentskills.agentUpdated";
static NSString * const WLAgentSkillsIMNotifyModule = @"welink-athena";
typedef void (^WLAgentSkillsCacheMutationCompletion)(void);
typedef void (^WLAgentSkillsCacheMutationTask)(WLAgentSkillsCacheMutationCompletion completion);
@interface WLAgentSkillsDeleteWeAgentContext : NSObject

@property (nonatomic, copy, nullable) NSString *partnerAccount;

@end

@implementation WLAgentSkillsDeleteWeAgentContext
@end

@interface WLAgentSkillsSDK () <WLAgentSkillsWebSocketManagerDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionStatusCallback> *sessionStatusCallbacks;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *sendMessageTriggeredBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *stopSkillHoldingBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *lastSessionStatusBySession;
@property (nonatomic, copy, nullable) WLAgentSkillsWecodeStatusCallback wecodeStatusCallback;
@property (nonatomic, strong) NSMutableArray<WLAgentSkillsCacheMutationTask> *weAgentCacheMutationQueue;
@property (nonatomic, assign) BOOL processingWeAgentCacheMutation;

- (void)refreshWeAgentsOnColdStart;

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
    [[self sharedInstance] refreshWeAgentsOnColdStart];
}

+ (void)configureWithBaseURL:(NSString *)baseURL assistantBaseURL:(nullable NSString *)assistantBaseURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL assistantBaseURL:assistantBaseURL];
    [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
    [[self sharedInstance] refreshWeAgentsOnColdStart];
}

+ (void)configureWithBaseURL:(NSString *)baseURL webSocketURL:(nullable NSString *)webSocketURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL webSocketURL:webSocketURL];
    [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
    [[self sharedInstance] refreshWeAgentsOnColdStart];
}

+ (void)configureWithBaseURL:(NSString *)baseURL
            assistantBaseURL:(nullable NSString *)assistantBaseURL
                webSocketURL:(nullable NSString *)webSocketURL {
    [[WLAgentSkillsConfig sharedConfig] configureWithBaseURL:baseURL
                                            assistantBaseURL:assistantBaseURL
                                                webSocketURL:webSocketURL];
    [[WLAgentSkillsHTTPClient sharedClient] reloadConfiguration];
    [[self sharedInstance] refreshWeAgentsOnColdStart];
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sessionStatusCallbacks = [NSMutableDictionary dictionary];
        _sendMessageTriggeredBySession = [NSMutableDictionary dictionary];
        _stopSkillHoldingBySession = [NSMutableDictionary dictionary];
        _lastSessionStatusBySession = [NSMutableDictionary dictionary];
        _weAgentCacheMutationQueue = [NSMutableArray array];
        [WLAgentSkillsWebSocketManager sharedManager].delegate = self;
    }
    return self;
}

#pragma mark - 1. createSession

- (void)createSession:(WLAgentSkillsCreateSessionParams *)params
                            success:(void (^)(WLAgentSkillsSession *session))success
                            failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }
    NSString *errorMessage = nil;
    NSString *businessSessionId = [WLAgentSkillsTypeConverter requiredStringFromValue:params.businessSessionId
                                                                        fieldName:@"businessSessionId"
                                                                     errorMessage:&errorMessage];
    if (businessSessionId == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *businessSessionDomain = [WLAgentSkillsTypeConverter requiredStringFromValue:params.businessSessionDomain
                                                                                 fieldName:@"businessSessionDomain"
                                                                              errorMessage:&errorMessage];
    if (businessSessionDomain == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *businessSessionType = [WLAgentSkillsTypeConverter requiredStringFromValue:params.businessSessionType
                                                                               fieldName:@"businessSessionType"
                                                                            errorMessage:&errorMessage];
    if (businessSessionType == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *ak = [WLAgentSkillsTypeConverter optionalStringFromValue:params.ak];
    NSString *title = [WLAgentSkillsTypeConverter optionalStringFromValue:params.title];
    NSString *assistantAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.assistantAccount];

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getHistorySessionsWithPage:@0
                                                                  size:@50
                                                                status:nil
                                                                    ak:ak
                                                    businessSessionId:businessSessionId
                                                      assistantAccount:assistantAccount
                                              businessSessionDomain:businessSessionDomain
                                                businessSessionType:businessSessionType
                                                                success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        NSArray *content = [data[@"content"] isKindOfClass:[NSArray class]] ? data[@"content"] : @[];
        NSDictionary *existing = [weakSelf pickLatestReusableSessionFromArray:content];

        if (existing != nil) {
            if (success) {
                success([[WLAgentSkillsSession alloc] initWithDictionary:existing]);
            }
            return;
        }

        [[WLAgentSkillsHTTPClient sharedClient] createSessionWithAK:ak
                                                                                                                        title:title
                                                                                                        businessSessionDomain:businessSessionDomain
                                                                                                          businessSessionType:businessSessionType
                                                                                                            businessSessionId:businessSessionId
                                                                                                                assistantAccount:assistantAccount
                                                                                                                    success:^(id  _Nullable createdResponse) {
            NSDictionary *created = [createdResponse isKindOfClass:[NSDictionary class]] ? createdResponse : @{};
            WLAgentSkillsSession *session = [[WLAgentSkillsSession alloc] initWithDictionary:created];
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

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                                                                                                page:@0
                                                                                                                                size:@50
                                                                                                                        success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsPageResult *pageResult = [[WLAgentSkillsPageResult alloc] initWithDictionary:data];

        NSString *content = [weakSelf latestUserMessageContentFromMessages:pageResult.content];
        if (content == nil || content.length == 0) {
            [weakSelf dispatchFailure:failure code:4002 message:@"No user message can be used for regenerateAnswer."];
            return;
        }

        [weakSelf sendMessageWithSessionId:params.welinkSessionId
                                                                content:content
                                                        toolCallId:nil
                                                        questionId:nil
                                                subagentSessionId:nil
                                                  businessExtParam:nil
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
    NSString *normalizedContent = [self normalizedOptionalString:params.content];
    if (params.content != nil && normalizedContent == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: content must be a non-empty string."];
        return;
    }
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

    if (normalizedContent != nil) {
        sendWithContent(normalizedContent);
        return;
    }

    [[WLAgentSkillsHTTPClient sharedClient] getMessageHistoryWithSessionId:params.welinkSessionId
                                                                 beforeSeq:nil
                                                                      size:@100
                                                                   success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsCursorResult *pageResult = [[WLAgentSkillsCursorResult alloc] initWithDictionary:data];

        NSString *latest = [weakSelf latestCompletedContentFromMessages:pageResult.content];
        if (latest == nil || latest.length == 0) {
            [weakSelf dispatchFailure:failure code:4005 message:@"No completed message available."];
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
        if (success) {
            success(serverPage);
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
        if (success) {
            success(result);
        }
        if (beforeSeq == nil) {
            // beforeSeq 为空视为首屏历史请求；历史成功返回后尽力补发一次 resume。
            [[WLAgentSkillsWebSocketManager sharedManager] sendResumeMessageForSessionId:welinkSessionId];
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
                                            questionId:params.questionId
                                    subagentSessionId:params.subagentSessionId
                                      businessExtParam:params.businessExtParam
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
                                                                                                                    subagentSessionId:params.subagentSessionId
                                                                                                                      businessExtParam:params.businessExtParam
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
                success:(void (^)(WLAgentSkillsSession *session))success
                failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *businessSessionId = [WLAgentSkillsTypeConverter requiredStringFromValue:params.businessSessionId
                                                                            fieldName:@"businessSessionId"
                                                                         errorMessage:&errorMessage];
    if (businessSessionId == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *businessSessionDomain = [WLAgentSkillsTypeConverter requiredStringFromValue:params.businessSessionDomain
                                                                                 fieldName:@"businessSessionDomain"
                                                                              errorMessage:&errorMessage];
    if (businessSessionDomain == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *businessSessionType = [WLAgentSkillsTypeConverter requiredStringFromValue:params.businessSessionType
                                                                               fieldName:@"businessSessionType"
                                                                            errorMessage:&errorMessage];
    if (businessSessionType == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *ak = [WLAgentSkillsTypeConverter optionalStringFromValue:params.ak];
    NSString *assistantAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.assistantAccount];
    NSString *title = [WLAgentSkillsTypeConverter optionalStringFromValue:params.title];

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] createNewSessionWithAK:ak
                                                             title:title
                                             businessSessionDomain:businessSessionDomain
                                               businessSessionType:businessSessionType
                                                 businessSessionId:businessSessionId
                                                   assistantAccount:assistantAccount
                                                            success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsSession *session = [[WLAgentSkillsSession alloc] initWithDictionary:data];
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
                        success:(void (^)(WLAgentSkillsSessionPageResult *result))success
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
    NSString *businessSessionId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.businessSessionId];
    NSString *assistantAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.assistantAccount];
    NSString *businessSessionDomain = [WLAgentSkillsTypeConverter optionalStringFromValue:params.businessSessionDomain];

    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getHistorySessionsWithPage:page
                                                                   size:size
                                                                 status:status
                                                                     ak:ak
                                                     businessSessionId:businessSessionId
                                                         assistantAccount:assistantAccount
                                                    businessSessionDomain:businessSessionDomain
                                                                success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsSessionPageResult *result = [[WLAgentSkillsSessionPageResult alloc] initWithDictionary:data];
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
    NSString *desc = [WLAgentSkillsTypeConverter requiredStringFromValue:params.descriptionValue
                                                                 fieldName:@"description"
                                                              errorMessage:&errorMessage];
    if (desc == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSNumber *weCrewTypeNumber = [WLAgentSkillsTypeConverter optionalIntegerNumberFromValue:params.weCrewType
                                                                                   fieldName:@"weCrewType"
                                                                                errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    if (weCrewTypeNumber != nil && !(weCrewTypeNumber.integerValue == 0 || weCrewTypeNumber.integerValue == 1)) {
        [self dispatchFailure:failure code:1000 message:@"weCrewType must be 0 or 1."];
        return;
    }
    NSString *bizRobotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.bizRobotId];
    NSString *qrcode = [WLAgentSkillsTypeConverter optionalStringFromValue:params.qrcode];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] createDigitalTwinWithName:name
                                                                  icon:icon
                                                          description:desc
                                                          weCrewType:weCrewTypeNumber
                                                          bizRobotId:bizRobotId
                                                              qrcode:qrcode
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
        WLAgentSkillsWeAgentDetailsArrayResult *result = [self weAgentDetailsArrayResultFromPayload:responseObject];
        [self cacheWeAgentDetailsArrayResult:result partnerAccount:partnerAccount];
        if (success) {
            success(result);
        }
    }
                                                                         failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 19.1. getAssistantDetails

- (void)getAssistantDetails:(WLAgentSkillsQueryWeAgentParams *)params
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

    NSDictionary *cachedDictionary = [[WLAgentSkillsWeAgentStore sharedStore]
        loadWeAgentDetailDictionaryForPartnerAccount:partnerAccount];
    if ([cachedDictionary isKindOfClass:[NSDictionary class]] && cachedDictionary.count > 0) {
        WLAgentSkillsWeAgentDetailsArrayResult *cachedResult =
            [self weAgentDetailsArrayResultFromDetailDictionary:cachedDictionary];
        if (success) {
            success(cachedResult);
        }
        [self refreshAssistantDetailsCacheForPartnerAccount:partnerAccount];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                         success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        WLAgentSkillsWeAgentDetailsArrayResult *result = [strongSelf weAgentDetailsArrayResultFromPayload:responseObject];
        [strongSelf cacheWeAgentDetailsArrayResult:result
                                    partnerAccount:partnerAccount
                                 updateCurrentDetail:NO];
        if (success) {
            success(result);
        }
    }
                                                                         failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 19.2. getWeAgentInfo

/// 复制当前详情缓存生成返回对象，保留全部详情字段且不回写标签兜底值。
- (void)getWeAgentInfo:(void (^)(WLAgentSkillsWeAgentDetails *result))success {
    NSDictionary *cachedDictionary = [[WLAgentSkillsWeAgentStore sharedStore]
        loadCurrentWeAgentDetailDictionary];
    WLAgentSkillsWeAgentDetails *result =
        [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:
            [cachedDictionary isKindOfClass:[NSDictionary class]] ? cachedDictionary : @{}];
    if ([self normalizedOptionalString:result.tagName] == nil) {
        result.tagName = @"助手";
    }
    if ([self normalizedOptionalString:result.tagNameEn] == nil) {
        result.tagNameEn = @"Agent";
    }
    WKFLogInfo(WLAS_BUNDLE_NAME,
               @"getWeAgentInfo succeeded, partnerAccount=%@, tagName=%@, tagNameEn=%@",
               result.partnerAccount ?: @"",
               result.tagName ?: @"",
               result.tagNameEn ?: @"");
    if (success) {
        success(result);
    }
}

#pragma mark - 20. getWeAgentUri

- (void)getWeAgentUri:(void (^)(WLAgentSkillsWeAgentUriResult *result))success
              failure:(void (^)(NSError *error))failure {
    NSDictionary *detailDictionary = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
    WLAgentSkillsWeAgentDetails *details = nil;
    if ([detailDictionary isKindOfClass:[NSDictionary class]] && detailDictionary.count > 0) {
        details = [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:detailDictionary];
    }
    [self buildWeAgentUriResultFromDetails:details success:success failure:failure];
}

#pragma mark - 21. updateWeAgent

- (void)updateWeAgent:(WLAgentSkillsUpdateWeAgentParams *)params
              success:(void (^)(WLAgentSkillsUpdateWeAgentResult *result))success
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
    NSString *description = [WLAgentSkillsTypeConverter requiredStringFromValue:params.descriptionValue
                                                                      fieldName:@"description"
                                                                   errorMessage:&errorMessage];
    if (description == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] updateWeAgentWithPartnerAccount:partnerAccount
                                                                       name:name
                                                                       icon:icon
                                                                description:description
                                                                    success:^(id  _Nullable responseObject) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"updateWeAgent request succeeded, enqueue cache mutation, partnerAccount=%@",
                   partnerAccount);
        WLAgentSkillsUpdateWeAgentResult *result = [[WLAgentSkillsUpdateWeAgentResult alloc] init];
        result.updateResult = @"success";
        NSDictionary *data = @{
            @"partnerAccount" : partnerAccount,
            @"name" : name,
            @"icon" : icon,
            @"description" : description
        };
        [weakSelf enqueueWeAgentCacheMutation:^(WLAgentSkillsCacheMutationCompletion completion) {
            [[WLAgentSkillsWeAgentStore sharedStore] updateCachedWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                                             name:name
                                                                                             icon:icon
                                                                                      description:description];
            [weakSelf broadcastWeAgentEvent:WLAgentSkillsWeAgentEventName
                                    payload:[weakSelf weAgentPayloadWithType:@"update" data:data source:@"local"]
                                 completion:^{
                @try {
                    if (success) {
                        success(result);
                    }
                } @finally {
                    completion();
                }
            }];
        }];
    }
                                                                    failure:^(NSError * _Nonnull error) {
        WKFLogError(WLAS_BUNDLE_NAME, @"updateWeAgent request failed, partnerAccount=%@, error=%@",
                    partnerAccount, error.localizedDescription);
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 22. deleteWeAgent

- (void)deleteWeAgent:(WLAgentSkillsDeleteWeAgentParams *)params
              success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success
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

    WLAgentSkillsDeleteWeAgentContext *context = [self buildDeleteWeAgentContextWithPartnerAccount:partnerAccount];
    __weak typeof(self) weakSelf = self;
    [self requestDeleteWeAgentWithContext:context
                                  success:^(WLAgentSkillsDeleteWeAgentResult *result) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"deleteWeAgent request succeeded, enqueue cache mutation, partnerAccount=%@",
                   partnerAccount);
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        [strongSelf enqueueWeAgentCacheMutation:^(WLAgentSkillsCacheMutationCompletion completion) {
            [strongSelf handleDeleteWeAgentResultWithContext:context
                                                deleteResult:result
                                                     success:^(WLAgentSkillsDeleteWeAgentResult *deleteResult) {
                @try {
                    if (success) {
                        success(deleteResult);
                    }
                } @finally {
                    completion();
                }
            }
                                                     failure:^(NSError *error) {
                @try {
                    if (failure) {
                        failure(error);
                    }
                } @finally {
                    completion();
                }
            }];
        }];
    }
                                  failure:^(NSError *error) {
        WKFLogError(WLAS_BUNDLE_NAME, @"deleteWeAgent request failed, partnerAccount=%@, error=%@",
                    partnerAccount, error.localizedDescription);
        __strong typeof(weakSelf) strongSelf = weakSelf;
        [strongSelf dispatchFailureObject:failure error:error];
    }];
}

/// 接收宿主透传的 IM 助理变更通知。
/// 先校验 notify_module，再把 notify_data 转为业务字典；无关模块或非法载荷直接忽略。
- (void)handleWeAgentImNotifyBroadcastPayload:(NSDictionary *)payload {
    if (![payload isKindOfClass:[NSDictionary class]]) {
        WKFLogError(WLAS_BUNDLE_NAME, @"ignore we-agent IM notification: payload is invalid");
        return;
    }
    NSString *notifyModule = [WLAgentSkillsTypeConverter optionalStringFromValue:payload[@"notify_module"]];
    if (![notifyModule isEqualToString:WLAgentSkillsIMNotifyModule]) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"ignore we-agent IM notification: notify_module does not match");
        return;
    }
    NSDictionary *notifyData = [self dictionaryFromObject:payload[@"notify_data"]];
    if (notifyData == nil) {
        WKFLogError(WLAS_BUNDLE_NAME, @"ignore we-agent IM notification: notify_data parse failed");
        return;
    }
    WKFLogInfo(WLAS_BUNDLE_NAME, @"we-agent IM notification parsed, enqueue server mutation");
    [self enqueueWeAgentCacheMutation:^(WLAgentSkillsCacheMutationCompletion completion) {
        [self handleWeAgentNotifyData:notifyData source:@"server" completion:completion];
    }];
}

#pragma mark - 23. setIsShowWeAgent

- (void)setIsShowWeAgent:(WLAgentSkillsSetIsShowWeAgentParams *)params
                 success:(void (^)(WLAgentSkillsSetIsShowWeAgentResult *result))success
                 failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }
    if (![params.isShowWeAgent isKindOfClass:[NSNumber class]]
        || strcmp([(NSNumber *)params.isShowWeAgent objCType], @encode(BOOL)) != 0) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: isShowWeAgent must be a boolean."];
        return;
    }

    BOOL isShowWeAgent = [(NSNumber *)params.isShowWeAgent boolValue];
    // TODO: save isShowWeAgent by calling host saveSettings.
    // TODO: broadcast isShowWeAgent change to host.
    if (isShowWeAgent) {
        // TODO: open we-agent tab by calling host capability.
    } else {
        // TODO: close we-agent tab by calling host capability.
    }

    WLAgentSkillsSetIsShowWeAgentResult *result = [[WLAgentSkillsSetIsShowWeAgentResult alloc] init];
    result.status = @"success";
    if (success) {
        success(result);
    }
}

#pragma mark - 24. getIsShowWeAgent

- (void)getIsShowWeAgent:(void (^)(WLAgentSkillsGetIsShowWeAgentResult *result))success
                 failure:(void (^)(NSError *error))failure {
    (void)failure;
    // TODO: read isShowWeAgent by calling host getSettings.
    WLAgentSkillsGetIsShowWeAgentResult *result = [[WLAgentSkillsGetIsShowWeAgentResult alloc] init];
    result.isShowWeAgent = NO;
    if (success) {
        success(result);
    }
}

#pragma mark - 25. openWeAgent

- (void)openWeAgent:(WLAgentSkillsOpenWeAgentParams *)params
            success:(void (^)(WLAgentSkillsOpenWeAgentResult *result))success
            failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.partnerAccount];

    // TODO: save isShowWeAgent = true by calling host saveSettings.
    // TODO: broadcast isShowWeAgent = true to host.
    __weak typeof(self) weakSelf = self;
    if (partnerAccount.length > 0) {
        WLAgentSkillsQueryWeAgentParams *queryParams = [[WLAgentSkillsQueryWeAgentParams alloc] init];
        queryParams.partnerAccount = partnerAccount;
        [self getAssistantDetails:queryParams
                          success:^(WLAgentSkillsWeAgentDetailsArrayResult *result) {
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (strongSelf == nil) {
                return;
            }

            WLAgentSkillsWeAgentDetails *targetDetail =
                result.weAgentDetailsArray.count > 0 ? result.weAgentDetailsArray.firstObject : nil;
            if (targetDetail == nil) {
                [strongSelf dispatchFailure:failure code:7000 message:@"getAssistantDetails returned empty detail."];
                return;
            }
            NSString *weCodeUrl = [WLAgentSkillsTypeConverter optionalStringFromValue:targetDetail.weCodeUrl];
            if (weCodeUrl == nil) {
                [strongSelf dispatchFailure:failure code:7000 message:@"getAssistantDetails returned empty weCodeUrl."];
                return;
            }

            [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:[targetDetail toDictionary]];
            [strongSelf buildWeAgentUriResultFromDetails:targetDetail
                                                 success:^(WLAgentSkillsWeAgentUriResult *uris) {
                (void)uris;
                // TODO: open we-agent tab by calling host capability.
                // TODO: call host openWeAgentCUI with uris.weAgentUri, uris.assistantDetailUri and uris.switchAssistantUri.
                WLAgentSkillsOpenWeAgentResult *openResult = [[WLAgentSkillsOpenWeAgentResult alloc] init];
                openResult.status = @"success";
                if (success) {
                    success(openResult);
                }
            }
                                                 failure:^(NSError *error) {
                [strongSelf dispatchFailureObject:failure error:error];
            }];
        }
                          failure:^(NSError *error) {
            [weakSelf dispatchFailureObject:failure error:error];
        }];
        return;
    }

    [self getWeAgentUri:^(WLAgentSkillsWeAgentUriResult *result) {
        (void)result;
        // TODO: open we-agent tab by calling host capability.
        // TODO: call host openWeAgentCUI with result.weAgentUri, result.assistantDetailUri and result.switchAssistantUri.
        WLAgentSkillsOpenWeAgentResult *openResult = [[WLAgentSkillsOpenWeAgentResult alloc] init];
        openResult.status = @"success";
        if (success) {
            success(openResult);
        }
    }
               failure:^(NSError *error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 26. openAssistantEditPage

- (void)openAssistantEditPage:(WLAgentSkillsOpenAssistantEditPageParams *)params
                      success:(void (^)(WLAgentSkillsOpenAssistantEditPageResult *result))success
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

    NSString *uri = [self assistantEditPageUriWithPartnerAccount:partnerAccount];
    if (uri == nil || uri.length == 0) {
        [self dispatchFailure:failure code:5000 message:@"Failed to build assistant edit page uri."];
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        NSURL *url = [NSURL URLWithString:uri];
        if (url == nil) {
            [self dispatchFailure:failure code:5000 message:@"Invalid assistant edit page uri."];
            return;
        }

        [[UIApplication sharedApplication] openURL:url
                                           options:@{}
                                 completionHandler:^(BOOL successOpen) {
            if (!successOpen) {
                [self dispatchFailure:failure code:5000 message:@"Failed to open assistant edit page."];
                return;
            }
            WLAgentSkillsOpenAssistantEditPageResult *result = [[WLAgentSkillsOpenAssistantEditPageResult alloc] init];
            result.status = @"success";
            if (success) {
                success(result);
            }
        }];
    });
}

#pragma mark - 27. queryQrcodeInfo

- (void)queryQrcodeInfo:(WLAgentSkillsQueryQrcodeInfoParams *)params
                success:(void (^)(WLAgentSkillsQrcodeInfo *result))success
                failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *qrcode = [WLAgentSkillsTypeConverter requiredStringFromValue:params.qrcode
                                                                 fieldName:@"qrcode"
                                                              errorMessage:&errorMessage];
    if (qrcode == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] queryQrcodeInfoWithQrcode:qrcode
                                                              success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsQrcodeInfo *result = [[WLAgentSkillsQrcodeInfo alloc] initWithDictionary:data];
        if (success) {
            success(result);
        }
    }
                                                              failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 28. updateQrcodeInfo

- (void)updateQrcodeInfo:(WLAgentSkillsUpdateQrcodeInfoParams *)params
                 success:(void (^)(WLAgentSkillsUpdateQrcodeInfoResult *result))success
                 failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *errorMessage = nil;
    NSString *qrcode = [WLAgentSkillsTypeConverter requiredStringFromValue:params.qrcode
                                                                 fieldName:@"qrcode"
                                                              errorMessage:&errorMessage];
    if (qrcode == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSInteger statusValue = [WLAgentSkillsTypeConverter requiredIntegerFromValue:params.status
                                                                       fieldName:@"status"
                                                                    errorMessage:&errorMessage];
    if (errorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }
    NSString *robotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.robotId];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] updateQrcodeInfoWithQrcode:qrcode
                                                               robotId:robotId
                                                               status:@(statusValue)
                                                              success:^(id  _Nullable responseObject) {
        WLAgentSkillsUpdateQrcodeInfoResult *result = [[WLAgentSkillsUpdateQrcodeInfoResult alloc] init];
        result.status = @"success";
        if (success) {
            success(result);
        }
    }
                                                              failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 29. queryAssistantGraySingle

- (void)queryAssistantGraySingle:(WLAgentSkillsQueryAssistantGraySingleParams *)params
                         success:(void (^)(WLAgentSkillsQueryAssistantGraySingleResult *result))success
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

    NSNumber *cachedValue = [[WLAgentSkillsWeAgentStore sharedStore] loadAssistantGraySingleForPartnerAccount:partnerAccount];
    if (cachedValue != nil) {
        WLAgentSkillsQueryAssistantGraySingleResult *result = [[WLAgentSkillsQueryAssistantGraySingleResult alloc] init];
        result.data = cachedValue.boolValue;
        if (success) {
            success(result);
        }
        [self refreshAssistantGraySingleCacheForPartnerAccount:partnerAccount];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] queryAssistantGraySingleWithPartnerAccount:partnerAccount
                                                                               success:^(id  _Nullable responseObject) {
        BOOL grayValue = [responseObject respondsToSelector:@selector(boolValue)] ? [responseObject boolValue] : NO;
        [[WLAgentSkillsWeAgentStore sharedStore] saveAssistantGraySingle:grayValue
                                                       forPartnerAccount:partnerAccount];
        WLAgentSkillsQueryAssistantGraySingleResult *result = [[WLAgentSkillsQueryAssistantGraySingleResult alloc] init];
        result.data = grayValue;
        if (success) {
            success(result);
        }
    }
                                                                               failure:^(NSError * _Nonnull error) {
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - WLAgentSkillsWebSocketManagerDelegate

- (void)webSocketManagerDidReceiveMessage:(WLAgentSkillsStreamMessage *)message {
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
                                            questionId:(nullable NSString *)questionId
                                    subagentSessionId:(nullable NSString *)subagentSessionId
                                      businessExtParam:(nullable NSDictionary *)businessExtParam
                                                    success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                                                    failure:(void (^)(NSError *error))failure {
    [self setSendMessageTriggered:YES sessionId:welinkSessionId];
    [[WLAgentSkillsWebSocketManager sharedManager] connectIfNeeded];

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] sendMessageWithSessionId:welinkSessionId
                                                                                                                        content:content
                                                                                                                    toolCallId:toolCallId
                                                                                                                    questionId:questionId
                                                                                                            subagentSessionId:subagentSessionId
                                                                                                              businessExtParam:businessExtParam
                                                                                                                        success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsSendMessageResult *result = [[WLAgentSkillsSendMessageResult alloc] initWithDictionary:data];
        if (success) {
            success(result);
        }
    }
                                                                                                                            failure:^(NSError * _Nonnull error) {
        [weakSelf setSendMessageTriggered:NO sessionId:welinkSessionId];
        [weakSelf dispatchFailureObject:failure error:error];
    }];
}

- (nullable NSString *)latestUserMessageContentFromMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages {
    for (WLAgentSkillsSessionMessage *message in messages) {
        NSString *role = [self normalizedOptionalString:message.role];
        if (![role isEqualToString:@"user"]) {
            continue;
        }
        NSString *content = [self normalizedOptionalString:message.content];
        if (content != nil) {
            return content;
        }
    }
    return nil;
}

- (nullable NSString *)latestCompletedContentFromMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages {
    for (NSInteger index = messages.count - 1; index >= 0; index--) {
        WLAgentSkillsSessionMessage *message = messages[index];
        NSString *content = [self resolvedMessageDisplayContent:message];
        if (content != nil) {
            return content;
        }
    }
    return nil;
}

- (nullable NSString *)resolvedMessageDisplayContent:(WLAgentSkillsSessionMessage *)message {
    NSString *content = [self normalizedOptionalString:message.content];
    if (content != nil) {
        return content;
    }
    NSMutableArray<NSString *> *segments = [NSMutableArray array];
    for (WLAgentSkillsSessionMessagePart *part in message.parts) {
        NSString *partContent = [self normalizedOptionalString:part.content];
        if (partContent == nil) {
            partContent = [self normalizedOptionalString:part.output];
        }
        if (partContent != nil) {
            [segments addObject:partContent];
        }
    }
    if (segments.count == 0) {
        return nil;
    }
    return [segments componentsJoinedByString:@"\n"];
}

- (nullable NSDictionary *)pickLatestReusableSessionFromArray:(NSArray *)sessions {
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
        if ([status isEqualToString:@"CLOSED"]) {
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

/// 构造助理编辑页 URI，仅使用必填 partnerAccount 作为目标助理定位参数。
- (nullable NSString *)assistantEditPageUriWithPartnerAccount:(NSString *)partnerAccount {
    NSString *baseUri = [self appendHashToUri:WLAgentSkillsAssistantH5URI hash:@"editAssistant"];
    NSString *normalizedPartnerAccount = [self normalizedOptionalString:partnerAccount];
    if (normalizedPartnerAccount != nil) {
        return [self appendQueryItemToUri:baseUri key:@"partnerAccount" value:normalizedPartnerAccount];
    }
    return nil;
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

- (WLAgentSkillsWeAgentDetailsArrayResult *)weAgentDetailsArrayResultFromPayload:(id)payload {
    WLAgentSkillsWeAgentDetailsArrayResult *result = [[WLAgentSkillsWeAgentDetailsArrayResult alloc] init];
    result.weAgentDetailsArray = [self parseWeAgentDetailsListFromResponse:payload];
    return result;
}

- (void)cacheWeAgentDetailsArrayResult:(WLAgentSkillsWeAgentDetailsArrayResult *)result
                        partnerAccount:(NSString *)partnerAccount {
    [self cacheWeAgentDetailsArrayResult:result
                          partnerAccount:partnerAccount
                       updateCurrentDetail:YES];
}

- (void)cacheWeAgentDetailsArrayResult:(WLAgentSkillsWeAgentDetailsArrayResult *)result
                        partnerAccount:(NSString *)partnerAccount
                   updateCurrentDetail:(BOOL)updateCurrentDetail {
    if (result.weAgentDetailsArray.count == 0) {
        return;
    }
    if (partnerAccount.length > 0) {
        NSDictionary *detailDictionary = [result.weAgentDetailsArray.firstObject toDictionary];
        [[WLAgentSkillsWeAgentStore sharedStore] saveWeAgentDetailDictionary:detailDictionary
                                                           forPartnerAccount:partnerAccount];
        if (updateCurrentDetail) {
            [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:detailDictionary];
        }
    }
}

- (void)refreshAssistantDetailsCacheForPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0) {
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                         success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        WLAgentSkillsWeAgentDetailsArrayResult *result = [strongSelf weAgentDetailsArrayResultFromPayload:responseObject];
        [strongSelf cacheWeAgentDetailsArrayResult:result
                                    partnerAccount:partnerAccount
                                 updateCurrentDetail:NO];
    }
                                                                         failure:^(NSError * _Nonnull error) {
        // Ignore background refresh failures.
    }];
}

- (void)refreshAssistantGraySingleCacheForPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0) {
        return;
    }

    [[WLAgentSkillsHTTPClient sharedClient] queryAssistantGraySingleWithPartnerAccount:partnerAccount
                                                                               success:^(id  _Nullable responseObject) {
        BOOL grayValue = [responseObject respondsToSelector:@selector(boolValue)] ? [responseObject boolValue] : NO;
        [[WLAgentSkillsWeAgentStore sharedStore] saveAssistantGraySingle:grayValue
                                                       forPartnerAccount:partnerAccount];
    }
                                                                               failure:^(NSError * _Nonnull error) {
        // Ignore background refresh failures.
    }];
}

/// 冷启动时批量查询本地已缓存助理，使缓存状态与服务端收敛。
/// 服务端缺失的账号会进入统一删除流程，完成缓存清理、当前助理 URI 处理和 delete 广播；
/// 返回且与本地有差异的详情只覆盖已有缓存并广播 update，请求失败时不修改缓存。
- (void)refreshWeAgentsOnColdStart {
    [self enqueueWeAgentCacheMutation:^(WLAgentSkillsCacheMutationCompletion completion) {
        [self performColdStartWeAgentRefreshWithCompletion:completion];
    }];
}

- (void)performColdStartWeAgentRefreshWithCompletion:(WLAgentSkillsCacheMutationCompletion)completion {
    WLAgentSkillsWeAgentStore *store = [WLAgentSkillsWeAgentStore sharedStore];
    NSArray<NSString *> *partnerAccounts = [store cachedWeAgentPartnerAccounts];
    if (partnerAccounts.count == 0) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"cold-start we-agent refresh skipped: no cached partnerAccount");
        completion();
        return;
    }
    WKFLogInfo(WLAS_BUNDLE_NAME, @"cold-start we-agent refresh started, accountCount=%lu",
               (unsigned long)partnerAccounts.count);
    NSDictionary<NSString *, NSDictionary *> *cachedDetails = [store loadWeAgentDetailsCacheDictionary];
    NSDictionary *currentDetail = [store loadCurrentWeAgentDetailDictionary];
    NSString *partnerAccountsValue = [partnerAccounts componentsJoinedByString:@","];
    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentDetailsWithPartnerAccount:partnerAccountsValue
                                                                        success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            completion();
            return;
        }
        NSArray<WLAgentSkillsWeAgentDetails *> *remoteDetails =
            [strongSelf parseWeAgentDetailsListFromResponse:responseObject];
        WKFLogInfo(WLAS_BUNDLE_NAME, @"cold-start we-agent detail request succeeded, remoteCount=%lu",
                   (unsigned long)remoteDetails.count);
        NSMutableDictionary<NSString *, NSDictionary *> *remoteDetailsByAccount =
            [NSMutableDictionary dictionary];
        for (WLAgentSkillsWeAgentDetails *detail in remoteDetails) {
            NSString *partnerAccount = [strongSelf normalizedOptionalString:detail.partnerAccount];
            if (partnerAccount.length > 0) {
                remoteDetailsByAccount[partnerAccount] = [detail toDictionary];
            }
        }

        [strongSelf processColdStartWeAgentAccounts:partnerAccounts
                              remoteDetailsByAccount:remoteDetailsByAccount
                                      cachedDetails:cachedDetails
                                      currentDetail:currentDetail
                                              index:0
                                         completion:completion];
    }
                                                                        failure:^(NSError * _Nonnull error) {
        // Cold-start compensation failures do not change cache or emit broadcasts.
        WKFLogError(WLAS_BUNDLE_NAME, @"cold-start we-agent detail request failed, error=%@",
                    error.localizedDescription);
        completion();
    }];
}

- (void)processColdStartWeAgentAccounts:(NSArray<NSString *> *)partnerAccounts
                  remoteDetailsByAccount:(NSDictionary<NSString *, NSDictionary *> *)remoteDetailsByAccount
                          cachedDetails:(NSDictionary<NSString *, NSDictionary *> *)cachedDetails
                          currentDetail:(NSDictionary *)currentDetail
                                  index:(NSUInteger)index
                             completion:(WLAgentSkillsCacheMutationCompletion)completion {
    if (index >= partnerAccounts.count) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"cold-start we-agent refresh completed, accountCount=%lu",
                   (unsigned long)partnerAccounts.count);
        completion();
        return;
    }
    NSString *partnerAccount = partnerAccounts[index];
    NSDictionary *remoteDetail = remoteDetailsByAccount[partnerAccount];
    if (remoteDetail == nil) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"cold-start detected deleted we-agent, partnerAccount=%@",
                   partnerAccount);
        void (^continueProcessing)(void) = ^{
            [self processColdStartWeAgentAccounts:partnerAccounts
                            remoteDetailsByAccount:remoteDetailsByAccount
                                    cachedDetails:cachedDetails
                                    currentDetail:currentDetail
                                            index:index + 1
                                       completion:completion];
        };
        [self handleDeletedWeAgentWithPartnerAccount:partnerAccount
                                                data:@{ @"partnerAccount" : partnerAccount }
                                              source:@"server"
                                             success:continueProcessing
                                             failure:^(NSError *error) {
            (void)error;
            continueProcessing();
        }];
        return;
    }

    NSDictionary *cachedDetail = cachedDetails[partnerAccount];
    BOOL currentMatches =
        [[self normalizedOptionalString:currentDetail[@"partnerAccount"]] isEqualToString:partnerAccount];
    BOOL changed = cachedDetail != nil && ![cachedDetail isEqualToDictionary:remoteDetail];
    changed = changed || (currentMatches && ![currentDetail isEqualToDictionary:remoteDetail]);
    if (changed) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"cold-start detected updated we-agent, partnerAccount=%@",
                   partnerAccount);
        [[WLAgentSkillsWeAgentStore sharedStore] replaceCachedWeAgentDetailIfPresent:remoteDetail
                                                                  forPartnerAccount:partnerAccount];
        [self dispatchHostBroadcast:WLAgentSkillsWeAgentEventName
                            payload:[self weAgentPayloadWithType:@"update"
                                                           data:remoteDetail
                                                         source:@"server"]];
    }
    [self processColdStartWeAgentAccounts:partnerAccounts
                    remoteDetailsByAccount:remoteDetailsByAccount
                            cachedDetails:cachedDetails
                            currentDetail:currentDetail
                                    index:index + 1
                               completion:completion];
}

/// 解析业务通知并执行更新或删除同步。
/// update 仅修改已存在缓存的基础字段，再补拉完整详情广播；delete 复用统一删除流程处理
/// 缓存、当前助理跳转和广播。
- (void)handleWeAgentNotifyData:(NSDictionary *)notifyData
                         source:(NSString *)source
                     completion:(WLAgentSkillsCacheMutationCompletion)completion {
    NSString *action = [WLAgentSkillsTypeConverter optionalStringFromValue:notifyData[@"action"]];
    NSDictionary *weCrew = [self dictionaryFromObject:notifyData[@"weCrew"]];
    if (action.length == 0 || weCrew == nil) {
        WKFLogError(WLAS_BUNDLE_NAME, @"ignore we-agent notification: action or weCrew is missing");
        completion();
        return;
    }
    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:weCrew[@"partnerAccount"]];
    if ([action isEqualToString:@"update"]) {
        if (partnerAccount.length == 0) {
            WKFLogError(WLAS_BUNDLE_NAME, @"ignore we-agent update notification: partnerAccount is missing");
            completion();
            return;
        }
        WKFLogInfo(WLAS_BUNDLE_NAME, @"process server we-agent update, partnerAccount=%@", partnerAccount);
        [self updateCachedBasicFieldsForPartnerAccount:partnerAccount data:weCrew];
        [self broadcastWeAgentEvent:WLAgentSkillsWeAgentEventName
                             payload:[self weAgentPayloadWithType:@"update" data:weCrew source:source]
                          completion:completion];
        return;
    }
    if ([action isEqualToString:@"delete"]) {
        if (partnerAccount.length == 0) {
            WKFLogError(WLAS_BUNDLE_NAME, @"ignore we-agent delete notification: partnerAccount is missing");
            completion();
            return;
        }
        WKFLogInfo(WLAS_BUNDLE_NAME, @"process server we-agent delete, partnerAccount=%@", partnerAccount);
        [self handleDeletedWeAgentWithPartnerAccount:partnerAccount
                                                data:weCrew
                                             source:source
                                             success:completion
                                             failure:^(NSError *error) {
            (void)error;
            completion();
        }];
        return;
    }
    completion();
}

/// 从通知中提取名称、头像和描述并更新已命中的缓存。
/// 描述兼容 description 和 desc；任一字段缺失时不更新，也不会创建新详情缓存。
- (void)updateCachedBasicFieldsForPartnerAccount:(NSString *)partnerAccount data:(NSDictionary *)data {
    NSString *name = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"name"]];
    NSString *icon = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"icon"]];
    NSString *description = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"description"]];
    if (description.length == 0) {
        description = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"desc"]];
    }
    if (name.length == 0 || icon.length == 0 || description.length == 0) {
        return;
    }
    [[WLAgentSkillsWeAgentStore sharedStore] updateCachedWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                                     name:name
                                                                                     icon:icon
                                                                              description:description];
}

/// 构造三端统一的助理广播结构：type、data 与 extraData.source。
- (NSDictionary *)weAgentPayloadWithType:(NSString *)type data:(NSDictionary *)data source:(NSString *)source {
    return @{
        @"type" : type ?: @"",
        @"data" : data ?: @{},
        @"extraData" : @{
            @"source" : source ?: @""
        }
    };
}

/// 按同步方案发送助理事件。
/// update 会先按 partnerAccount 补拉完整详情并替换 data，补拉失败或结果为空时不广播；
/// delete 无需网络请求，直接交给宿主广播出口。
- (void)broadcastWeAgentEvent:(NSString *)eventName
                      payload:(NSDictionary *)payload
                   completion:(WLAgentSkillsCacheMutationCompletion)completion {
    NSString *type = [WLAgentSkillsTypeConverter optionalStringFromValue:payload[@"type"]];
    if ([type isEqualToString:@"update"]) {
        NSDictionary *data = [self dictionaryFromObject:payload[@"data"]];
        NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"partnerAccount"]];
        if (partnerAccount.length == 0) {
            WKFLogError(WLAS_BUNDLE_NAME, @"skip we-agent update broadcast: partnerAccount is missing");
            completion();
            return;
        }
        __weak typeof(self) weakSelf = self;
        [[WLAgentSkillsHTTPClient sharedClient] getWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                            success:^(id  _Nullable responseObject) {
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (strongSelf == nil) {
                completion();
                return;
            }
            WLAgentSkillsWeAgentDetailsArrayResult *result = [strongSelf weAgentDetailsArrayResultFromPayload:responseObject];
            WLAgentSkillsWeAgentDetails *detail = result.weAgentDetailsArray.firstObject;
            if (detail == nil) {
                WKFLogError(WLAS_BUNDLE_NAME,
                            @"skip we-agent update broadcast: detail response is empty, partnerAccount=%@",
                            partnerAccount);
                completion();
                return;
            }
            NSMutableDictionary *finalPayload = [payload mutableCopy];
            finalPayload[@"data"] = [detail toDictionary];
            [strongSelf dispatchHostBroadcast:eventName payload:finalPayload];
            WKFLogInfo(WLAS_BUNDLE_NAME, @"we-agent update broadcast completed, partnerAccount=%@",
                       partnerAccount);
            completion();
        }
                                                                            failure:^(NSError * _Nonnull error) {
        // Per plan: update broadcast detail fetch failures do not emit a broadcast.
        WKFLogError(WLAS_BUNDLE_NAME, @"fetch detail before update broadcast failed, partnerAccount=%@, error=%@",
                    partnerAccount, error.localizedDescription);
        completion();
        }];
        return;
    }
    [self dispatchHostBroadcast:eventName payload:payload];
    WKFLogInfo(WLAS_BUNDLE_NAME, @"we-agent delete broadcast completed");
    completion();
}

/// 宿主广播能力的统一适配出口，后续接入 WeBroadCast 时在此透传事件名和完整载荷。
- (void)dispatchHostBroadcast:(NSString *)eventName payload:(NSDictionary *)payload {
    (void)eventName;
    (void)payload;
    // TODO: call host WeBroadCast(eventName, payload) when the host broadcast adapter is wired.
}

/// 将字典或 JSON 字符串安全转换为业务字典；非法 JSON、数组及其他类型返回 nil。
- (nullable NSDictionary *)dictionaryFromObject:(nullable id)object {
    if ([object isKindOfClass:[NSDictionary class]]) {
        return (NSDictionary *)object;
    }
    if ([object isKindOfClass:[NSString class]]) {
        NSData *data = [(NSString *)object dataUsingEncoding:NSUTF8StringEncoding];
        if (data == nil) {
            return nil;
        }
        id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        return [parsed isKindOfClass:[NSDictionary class]] ? (NSDictionary *)parsed : nil;
    }
    return nil;
}

- (WLAgentSkillsWeAgentDetailsArrayResult *)weAgentDetailsArrayResultFromDetailDictionary:(NSDictionary *)dictionary {
    WLAgentSkillsWeAgentDetailsArrayResult *result = [[WLAgentSkillsWeAgentDetailsArrayResult alloc] init];
    if (![dictionary isKindOfClass:[NSDictionary class]] || dictionary.count == 0) {
        result.weAgentDetailsArray = @[];
        return result;
    }
    result.weAgentDetailsArray = @[
        [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:dictionary]
    ];
    return result;
}

- (NSArray<NSDictionary *> *)dictionariesFromWeAgentList:(NSArray<WLAgentSkillsWeAgent *> *)list {
    NSMutableArray<NSDictionary *> *result = [NSMutableArray arrayWithCapacity:list.count];
    for (WLAgentSkillsWeAgent *item in list) {
        [result addObject:[item toDictionary]];
    }
    return [result copy];
}

- (NSArray<WLAgentSkillsWeAgent *> *)weAgentListFromDictionaries:(NSArray<NSDictionary *> *)dictionaries {
    NSMutableArray<WLAgentSkillsWeAgent *> *result = [NSMutableArray arrayWithCapacity:dictionaries.count];
    for (id item in dictionaries) {
        if (![item isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        [result addObject:[[WLAgentSkillsWeAgent alloc] initWithDictionary:(NSDictionary *)item]];
    }
    return [result copy];
}

/// 创建删除请求上下文，统一保存服务端删除接口所需的 partnerAccount。
- (WLAgentSkillsDeleteWeAgentContext *)buildDeleteWeAgentContextWithPartnerAccount:(nullable NSString *)partnerAccount {
    WLAgentSkillsDeleteWeAgentContext *context = [[WLAgentSkillsDeleteWeAgentContext alloc] init];
    context.partnerAccount = partnerAccount;
    return context;
}

/// 使用上下文中的 partnerAccount 调用服务端删除接口，并将响应转换为 SDK 删除结果。
- (void)requestDeleteWeAgentWithContext:(WLAgentSkillsDeleteWeAgentContext *)context
                                success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success
                                failure:(void (^)(NSError *error))failure {
    [[WLAgentSkillsHTTPClient sharedClient] deleteWeAgentWithPartnerAccount:context.partnerAccount
                                                                    success:^(id  _Nullable responseObject) {
        WLAgentSkillsDeleteWeAgentResult *result = [[WLAgentSkillsDeleteWeAgentResult alloc] init];
        result.deleteResult = @"success";
        if (success) {
            success(result);
        }
    }
                                                                    failure:^(NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

/// 处理本端删除成功后的缓存、跳转和广播。
/// 所有删除先移除列表与详情缓存；非当前助理直接广播，当前助理还会清空当前详情并通过
/// getWeAgentUri 计算后续页面，完成后再广播删除事件。
- (void)handleDeleteWeAgentResultWithContext:(WLAgentSkillsDeleteWeAgentContext *)context
                                deleteResult:(WLAgentSkillsDeleteWeAgentResult *)deleteResult
                                     success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success
                                     failure:(void (^)(NSError *error))failure {
    [self handleDeletedWeAgentWithPartnerAccount:context.partnerAccount
                                            data:@{ @"partnerAccount" : context.partnerAccount ?: @"" }
                                          source:@"local"
                                         success:^{
        if (success) {
            success(deleteResult);
        }
    }
                                         failure:failure];
}

/// 统一处理冷启动补偿、服务端通知和本端接口触发的助理删除。
/// 方法先判断目标是否为当前助理，再幂等清理列表和详情缓存；删除当前助理时还会清空当前
/// 详情并调用 getWeAgentUri 计算后续页面，最后使用传入数据和来源发送统一删除广播。
- (void)handleDeletedWeAgentWithPartnerAccount:(NSString *)partnerAccount
                                          data:(NSDictionary *)data
                                        source:(NSString *)source
                                       success:(void (^ _Nullable)(void))success
                                       failure:(void (^ _Nullable)(NSError *error))failure {
    BOOL deletingCurrentWeAgent = [self isCurrentWeAgentWithPartnerAccount:partnerAccount];
    WKFLogInfo(WLAS_BUNDLE_NAME,
               @"handle we-agent delete mutation, partnerAccount=%@, source=%@, deletingCurrent=%@",
               partnerAccount, source, deletingCurrentWeAgent ? @"YES" : @"NO");
    WLAgentSkillsWeAgentStore *store = [WLAgentSkillsWeAgentStore sharedStore];
    [store removeWeAgentFromListForPartnerAccount:partnerAccount];
    [store removeWeAgentDetailForPartnerAccount:partnerAccount];
    if (!deletingCurrentWeAgent) {
        [self broadcastWeAgentEvent:WLAgentSkillsWeAgentEventName
                             payload:[self weAgentPayloadWithType:@"delete" data:data source:source]
                          completion:success ?: ^{}];
        return;
    }
    [store saveCurrentWeAgentDetailDictionary:nil];
    [self getWeAgentUri:^(WLAgentSkillsWeAgentUriResult *result) {
        (void)result;
        WKFLogInfo(WLAS_BUNDLE_NAME, @"resolved URI after deleting current we-agent, partnerAccount=%@",
                   partnerAccount);
        // TODO: call openWeAgentCUI with result.weAgentUri, result.assistantDetailUri and result.switchAssistantUri.
        [self broadcastWeAgentEvent:WLAgentSkillsWeAgentEventName
                             payload:[self weAgentPayloadWithType:@"delete" data:data source:source]
                          completion:success ?: ^{}];
    } failure:^(NSError *error) {
        WKFLogError(WLAS_BUNDLE_NAME,
                    @"resolve URI after deleting current we-agent failed, partnerAccount=%@, error=%@",
                    partnerAccount, error.localizedDescription);
        if (failure) {
            failure(error);
        }
    }];
}

/// 判断指定 partnerAccount 是否与当前助理详情中的账号一致。
- (BOOL)isCurrentWeAgentWithPartnerAccount:(nullable NSString *)partnerAccount {
    NSDictionary *currentDetail = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
    return [self detailDictionary:currentDetail matchesPartnerAccount:partnerAccount];
}

- (BOOL)detailDictionary:(nullable NSDictionary *)dictionary
     matchesPartnerAccount:(nullable NSString *)partnerAccount {
    if (![dictionary isKindOfClass:[NSDictionary class]]) {
        return NO;
    }
    NSString *normalizedPartnerAccount = [self normalizedOptionalString:partnerAccount];
    return normalizedPartnerAccount != nil
        && [normalizedPartnerAccount isEqualToString:[self normalizedOptionalString:dictionary[@"partnerAccount"]]];
}

/// 将助理缓存变更任务加入 FIFO 队列，任务完成缓存、网络和广播后才启动下一项。
- (void)enqueueWeAgentCacheMutation:(WLAgentSkillsCacheMutationTask)task {
    BOOL shouldStart = NO;
    @synchronized(self) {
        [self.weAgentCacheMutationQueue addObject:[task copy]];
        WKFLogInfo(WLAS_BUNDLE_NAME, @"we-agent cache mutation enqueued, queueSize=%lu",
                   (unsigned long)self.weAgentCacheMutationQueue.count);
        if (!self.processingWeAgentCacheMutation) {
            self.processingWeAgentCacheMutation = YES;
            shouldStart = YES;
        }
    }
    if (shouldStart) {
        [self processNextWeAgentCacheMutation];
    }
}

- (void)processNextWeAgentCacheMutation {
    __block WLAgentSkillsCacheMutationTask task = nil;
    @synchronized(self) {
        task = self.weAgentCacheMutationQueue.firstObject;
        if (task == nil) {
            self.processingWeAgentCacheMutation = NO;
            return;
        }
        WKFLogInfo(WLAS_BUNDLE_NAME, @"we-agent cache mutation started, queueSize=%lu",
                   (unsigned long)self.weAgentCacheMutationQueue.count);
    }
    __weak typeof(self) weakSelf = self;
    __block BOOL finished = NO;
    WLAgentSkillsCacheMutationCompletion finishTask = ^{
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        @synchronized(strongSelf) {
            if (finished) {
                return;
            }
            finished = YES;
            if (strongSelf.weAgentCacheMutationQueue.count > 0) {
                [strongSelf.weAgentCacheMutationQueue removeObjectAtIndex:0];
            }
            WKFLogInfo(WLAS_BUNDLE_NAME, @"we-agent cache mutation completed, remaining=%lu",
                       (unsigned long)strongSelf.weAgentCacheMutationQueue.count);
        }
        [strongSelf processNextWeAgentCacheMutation];
    };
    @try {
        task(finishTask);
    } @catch (NSException *exception) {
        WKFLogError(WLAS_BUNDLE_NAME, @"we-agent cache mutation threw unexpectedly, error=%@",
                    exception.reason ?: @"unknown");
        finishTask();
    }
}

- (void)buildWeAgentUriResultFromDetails:(nullable WLAgentSkillsWeAgentDetails *)details
                                 success:(void (^)(WLAgentSkillsWeAgentUriResult *result))success
                                 failure:(void (^)(NSError *error))failure {
    if (details != nil) {
        if ([self normalizedOptionalString:details.weCodeUrl] == nil) {
            if (success) {
                success([self buildActivateAssistantFallbackUriResult]);
            }
            return;
        }
        WLAgentSkillsWeAgentUriResult *result = [self isMyAgentDetail:details]
            ? [self buildMyAgentWeAgentUriResult:details]
            : [self buildLegacyWeAgentUriResult:details];
        if (success) {
            success(result);
        }
        return;
    }

    __weak typeof(self) weakSelf = self;
    [self resolveMyWeAgentDetailWithSuccess:^(WLAgentSkillsWeAgentDetails *detail) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        if (detail == nil) {
            if (success) {
                success([strongSelf buildActivateAssistantFallbackUriResult]);
            }
            return;
        }
        if ([strongSelf normalizedOptionalString:detail.weCodeUrl] == nil) {
            if (success) {
                success([strongSelf buildActivateAssistantFallbackUriResult]);
            }
            return;
        }
        if (success) {
            success([strongSelf buildMyAgentWeAgentUriResult:detail]);
        }
    }
                                 failure:^(NSError *error) {
        (void)error;
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        if (success) {
            success([strongSelf buildActivateAssistantFallbackUriResult]);
        }
    }];
}

- (void)resolveMyWeAgentDetailWithSuccess:(void (^)(WLAgentSkillsWeAgentDetails *detail))success
                                  failure:(void (^)(NSError *error))failure {
    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getMyWeAgentWithSuccess:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        WLAgentSkillsWeAgentDetails *detail = [strongSelf myWeAgentDetailFromPayload:responseObject];
        if (detail != nil) {
            [strongSelf cacheMyWeAgentDetail:detail];
        }
        if (success) {
            success(detail);
        }
    }
                                                          failure:^(NSError * _Nonnull error) {
        (void)error;
        if (failure) {
            failure(nil);
        }
    }];
}

- (nullable WLAgentSkillsWeAgentDetails *)myWeAgentDetailFromPayload:(id)payload {
    if (![payload isKindOfClass:[NSDictionary class]]) {
        return nil;
    }
    NSMutableDictionary *dictionary = [NSMutableDictionary dictionaryWithDictionary:(NSDictionary *)payload];
    dictionary[@"id"] = [WLAgentSkillsTypeConverter optionalStringFromValue:dictionary[@"robotId"]] ?: @"";
    return [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:dictionary];
}

- (void)cacheMyWeAgentDetail:(WLAgentSkillsWeAgentDetails *)detail {
    NSDictionary *currentDetailDictionary = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
    WLAgentSkillsWeAgentDetails *currentDetail = nil;
    if ([currentDetailDictionary isKindOfClass:[NSDictionary class]] && currentDetailDictionary.count > 0) {
        currentDetail = [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:currentDetailDictionary];
    }
    if (currentDetail == nil || [self isMyAgentDetail:currentDetail]) {
        [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:[detail toDictionary]];
    }
}

- (BOOL)isMyAgentDetail:(nullable WLAgentSkillsWeAgentDetails *)detail {
    NSString *bizRobotTag = [self normalizedOptionalString:detail.bizRobotTag];
    return bizRobotTag != nil && [bizRobotTag caseInsensitiveCompare:@"myagent"] == NSOrderedSame;
}

- (WLAgentSkillsWeAgentUriResult *)buildActivateAssistantFallbackUriResult {
    WLAgentSkillsWeAgentUriResult *result = [[WLAgentSkillsWeAgentUriResult alloc] init];
    NSString *weAgentUri = [self appendQueryItemToUri:WLAgentSkillsAssistantH5URI
                                                  key:@"wecodePlace"
                                                value:@"weAgent"];
    result.weAgentUri = [self appendHashToUri:weAgentUri hash:@"activateAssistant"] ?: @"";
    result.assistantDetailUri = @"";
    result.switchAssistantUri = @"";
    return result;
}

- (WLAgentSkillsWeAgentUriResult *)buildLegacyWeAgentUriResult:(WLAgentSkillsWeAgentDetails *)details {
    WLAgentSkillsWeAgentUriResult *result = [[WLAgentSkillsWeAgentUriResult alloc] init];
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

- (WLAgentSkillsWeAgentUriResult *)buildMyAgentWeAgentUriResult:(WLAgentSkillsWeAgentDetails *)details {
    WLAgentSkillsWeAgentUriResult *result = [[WLAgentSkillsWeAgentUriResult alloc] init];
    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:details.partnerAccount];
    NSString *weAgentUri = [self appendQueryItemToUri:details.weCodeUrl key:@"wecodePlace" value:@"weAgent"];
    result.weAgentUri = [self appendQueryItemToUri:weAgentUri key:@"from" value:@"weAgent"] ?: @"";

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
