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
@import UIKit;

static NSString * const WLAgentSkillsSDKErrorDomain = @"com.wlagentskills.sdk";
static NSString * const WLAgentSkillsAssistantH5URI = @"h5://S008623/index.html";
static NSString * const WLAgentSkillsWeAgentCUIAppId = @"S008623";
static NSInteger const WLAgentSkillsDefaultWeAgentListPageSize = 100;
static NSInteger const WLAgentSkillsDefaultWeAgentListPageNumber = 1;

@interface WLAgentSkillsDeleteTransitionPlan : NSObject

@property (nonatomic, copy) NSArray<WLAgentSkillsWeAgent *> *updatedList;
@property (nonatomic, copy, nullable) NSString *nextPartnerAccount;

@end

@implementation WLAgentSkillsDeleteTransitionPlan
@end

@interface WLAgentSkillsDeleteWeAgentContext : NSObject

@property (nonatomic, copy, nullable) NSString *partnerAccount;
@property (nonatomic, copy, nullable) NSString *robotId;
@property (nonatomic, assign) BOOL deletingCurrentWeAgent;
@property (nonatomic, assign) BOOL hasListCache;
@property (nonatomic, strong, nullable) WLAgentSkillsDeleteTransitionPlan *transitionPlan;

@end

@implementation WLAgentSkillsDeleteWeAgentContext
@end

@interface WLAgentSkillsSDK () <WLAgentSkillsWebSocketManagerDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionStatusCallback> *sessionStatusCallbacks;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *sendMessageTriggeredBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *stopSkillHoldingBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *lastSessionStatusBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsAssistantDetailUpdatedCallback> *assistantDetailUpdatedCallbacks;
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
        _assistantDetailUpdatedCallbacks = [NSMutableDictionary dictionary];
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
    @synchronized(self) {
        [self.sendMessageTriggeredBySession removeAllObjects];
        [self.stopSkillHoldingBySession removeAllObjects];
        [self.lastSessionStatusBySession removeAllObjects];
        [self.assistantDetailUpdatedCallbacks removeAllObjects];
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

    [[WLAgentSkillsHTTPClient sharedClient] getMessagesWithSessionId:params.welinkSessionId
                                                                                                                                page:@0
                                                                                                                                size:@100
                                                                                                                        success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        WLAgentSkillsPageResult *pageResult = [[WLAgentSkillsPageResult alloc] initWithDictionary:data];

        NSString *latest = [weakSelf latestCompletedContentFromMessages:pageResult.content
                                                              messageId:normalizedMessageId];
        if (latest == nil || latest.length == 0) {
            NSInteger code = 4005;
            NSString *message = @"No completed message available.";
            if (normalizedMessageId != nil) {
                BOOL exists = [weakSelf containsMessageWithId:normalizedMessageId
                                                   inMessages:pageResult.content];
                if (!exists) {
                    code = 4003;
                    message = @"Message not found in server messages.";
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

#pragma mark - 20. getWeAgentUri

- (WLAgentSkillsWeAgentUriResult *)getWeAgentUri {
    NSDictionary *detailDictionary = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
    WLAgentSkillsWeAgentDetails *details = nil;
    if ([detailDictionary isKindOfClass:[NSDictionary class]] && detailDictionary.count > 0) {
        details = [[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:detailDictionary];
    }
    return [self weAgentUriResultFromDetails:details];
}

#pragma mark - 21. updateWeAgent

- (void)updateWeAgent:(WLAgentSkillsUpdateWeAgentParams *)params
              success:(void (^)(WLAgentSkillsUpdateWeAgentResult *result))success
              failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }

    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.partnerAccount];
    NSString *robotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.robotId];
    NSString *identityErrorMessage = nil;
    [self assistantIdentityKeyWithPartnerAccount:partnerAccount
                                         robotId:robotId
                                    errorMessage:&identityErrorMessage];
    if (identityErrorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:identityErrorMessage];
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
    NSString *description = [WLAgentSkillsTypeConverter requiredStringFromValue:params.descriptionValue
                                                                      fieldName:@"description"
                                                                   errorMessage:&errorMessage];
    if (description == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] updateWeAgentWithPartnerAccount:partnerAccount
                                                                    robotId:robotId
                                                                       name:name
                                                                       icon:icon
                                                                description:description
                                                                    success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        NSNumber *codeNumber = [WLAgentSkillsTypeConverter optionalIntegerNumberFromValue:data[@"code"]
                                                                                fieldName:@"code"
                                                                             errorMessage:nil];
        if (codeNumber == nil) {
            [weakSelf dispatchFailure:failure code:7000 message:@"Unexpected updateWeAgent response schema."];
            return;
        }
        if (codeNumber.integerValue != 200) {
            NSString *message = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"message"]] ?: @"updateWeAgent failed.";
            [weakSelf dispatchFailure:failure
                                 code:codeNumber.integerValue
                              message:message];
            return;
        }
        WLAgentSkillsUpdateWeAgentResult *result = [[WLAgentSkillsUpdateWeAgentResult alloc] init];
        result.updateResult = @"success";
        [[WLAgentSkillsWeAgentStore sharedStore] updateCachedWeAgentDetailsWithPartnerAccount:partnerAccount
                                                                                      robotId:robotId
                                                                                         name:name
                                                                                         icon:icon
                                                                                  description:description];
        if (success) {
            success(result);
        }
    }
                                                                    failure:^(NSError * _Nonnull error) {
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

    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.partnerAccount];
    NSString *robotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.robotId];
    NSString *identityErrorMessage = nil;
    [self assistantIdentityKeyWithPartnerAccount:partnerAccount
                                         robotId:robotId
                                    errorMessage:&identityErrorMessage];
    if (identityErrorMessage != nil) {
        [self dispatchFailure:failure code:1000 message:identityErrorMessage];
        return;
    }

    WLAgentSkillsDeleteWeAgentContext *context = [self buildDeleteWeAgentContextWithPartnerAccount:partnerAccount
                                                                                           robotId:robotId];
    __weak typeof(self) weakSelf = self;
    [self prepareDeleteWeAgentContext:context
                              success:^(WLAgentSkillsDeleteWeAgentContext *preparedContext) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        WLAgentSkillsDeleteWeAgentContext *resolvedContext = preparedContext ?: context;
        [strongSelf requestDeleteWeAgentWithContext:resolvedContext
                                            success:^(WLAgentSkillsDeleteWeAgentResult *result) {
            [strongSelf handleDeleteWeAgentResultWithContext:resolvedContext
                                                deleteResult:result
                                                     success:success
                                                     failure:failure];
        }
                                            failure:^(NSError *error) {
            [strongSelf dispatchFailureObject:failure error:error];
        }];
    }
                              failure:^(NSError *error) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        [strongSelf dispatchFailureObject:failure error:error];
    }];
}

#pragma mark - 23. openAssistantEditPage

- (void)openAssistantEditPage:(WLAgentSkillsOpenAssistantEditPageParams *)params
                      success:(void (^)(WLAgentSkillsOpenAssistantEditPageResult *result))success
                      failure:(void (^)(NSError *error))failure {
    if (params == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: params is required."];
        return;
    }
    if (params.onUpdated == nil) {
        [self dispatchFailure:failure code:1000 message:@"Invalid params: onUpdated is required."];
        return;
    }

    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.partnerAccount];
    NSString *robotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.robotId];
    NSString *identityErrorMessage = nil;
    NSString *identityKey = [self assistantIdentityKeyWithPartnerAccount:partnerAccount
                                                                 robotId:robotId
                                                            errorMessage:&identityErrorMessage];
    if (identityKey == nil) {
        [self dispatchFailure:failure code:1000 message:identityErrorMessage];
        return;
    }

    NSString *uri = [self assistantEditPageUriWithPartnerAccount:partnerAccount robotId:robotId];
    if (uri == nil || uri.length == 0) {
        [self dispatchFailure:failure code:5000 message:@"Failed to build assistant edit page uri."];
        return;
    }

    @synchronized(self) {
        self.assistantDetailUpdatedCallbacks[identityKey] = [params.onUpdated copy];
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

#pragma mark - 24. notifyAssistantDetailUpdated

- (void)notifyAssistantDetailUpdated:(WLAgentSkillsNotifyAssistantDetailUpdatedParams *)params
                             success:(void (^)(WLAgentSkillsNotifyAssistantDetailUpdatedResult *result))success
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
    NSString *description = [WLAgentSkillsTypeConverter requiredStringFromValue:params.descriptionValue
                                                                      fieldName:@"description"
                                                                   errorMessage:&errorMessage];
    if (description == nil) {
        [self dispatchFailure:failure code:1000 message:errorMessage];
        return;
    }

    NSString *partnerAccount = [WLAgentSkillsTypeConverter optionalStringFromValue:params.partnerAccount];
    NSString *robotId = [WLAgentSkillsTypeConverter optionalStringFromValue:params.robotId];
    NSString *identityErrorMessage = nil;
    NSString *identityKey = [self assistantIdentityKeyWithPartnerAccount:partnerAccount
                                                                 robotId:robotId
                                                            errorMessage:&identityErrorMessage];
    if (identityKey == nil) {
        [self dispatchFailure:failure code:1000 message:identityErrorMessage];
        return;
    }

    WLAgentSkillsAssistantDetailUpdatedCallback callbackBlock = nil;
    @synchronized(self) {
        callbackBlock = self.assistantDetailUpdatedCallbacks[identityKey];
    }
    if (callbackBlock != nil) {
        WLAgentSkillsAssistantDetailUpdatedPayload *payload = [[WLAgentSkillsAssistantDetailUpdatedPayload alloc] initWithDictionary:@{
            @"name" : name,
            @"icon" : icon,
            @"description" : description
        }];
        callbackBlock(payload);
    }

    WLAgentSkillsNotifyAssistantDetailUpdatedResult *result = [[WLAgentSkillsNotifyAssistantDetailUpdatedResult alloc] init];
    result.status = @"success";
    if (success) {
        success(result);
    }
}

#pragma mark - 25. queryQrcodeInfo

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

#pragma mark - 26. updateQrcodeInfo

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
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        NSString *codeString = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"code"]];
        if (codeString == nil || ![codeString isEqualToString:@"200"]) {
            [weakSelf dispatchFailure:failure code:7000 message:@"updateQrcodeInfo did not return code 200."];
            return;
        }
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

- (nullable NSString *)latestCompletedContentFromMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages
                                                messageId:(nullable NSString *)messageId {
    NSString *normalizedMessageId = [self normalizedOptionalString:messageId];
    if (normalizedMessageId != nil) {
        for (WLAgentSkillsSessionMessage *message in messages) {
            if (![[self normalizedOptionalString:message.id] isEqualToString:normalizedMessageId]) {
                continue;
            }
            return [self normalizedOptionalString:message.content];
        }
        return nil;
    }

    for (WLAgentSkillsSessionMessage *message in messages) {
        NSString *content = [self normalizedOptionalString:message.content];
        if (content != nil) {
            return content;
        }
    }
    return nil;
}

- (BOOL)containsMessageWithId:(NSString *)messageId
                   inMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages {
    NSString *normalizedMessageId = [self normalizedOptionalString:messageId];
    if (normalizedMessageId == nil) {
        return NO;
    }
    for (WLAgentSkillsSessionMessage *message in messages) {
        if ([[self normalizedOptionalString:message.id] isEqualToString:normalizedMessageId]) {
            return YES;
        }
    }
    return NO;
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

- (nullable NSString *)assistantIdentityKeyWithPartnerAccount:(nullable NSString *)partnerAccount
                                                      robotId:(nullable NSString *)robotId
                                                 errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    NSString *normalizedPartnerAccount = [self normalizedOptionalString:partnerAccount];
    if (normalizedPartnerAccount != nil) {
        return normalizedPartnerAccount;
    }
    NSString *normalizedRobotId = [self normalizedOptionalString:robotId];
    if (normalizedRobotId != nil) {
        return normalizedRobotId;
    }
    if (errorMessage != NULL) {
        *errorMessage = @"partnerAccount or robotId is required.";
    }
    return nil;
}

- (nullable NSString *)assistantEditPageUriWithPartnerAccount:(nullable NSString *)partnerAccount
                                                      robotId:(nullable NSString *)robotId {
    NSString *baseUri = [self appendHashToUri:WLAgentSkillsAssistantH5URI hash:@"editAssistant"];
    NSString *normalizedPartnerAccount = [self normalizedOptionalString:partnerAccount];
    if (normalizedPartnerAccount != nil) {
        return [self appendQueryItemToUri:baseUri key:@"partnerAccount" value:normalizedPartnerAccount];
    }
    NSString *normalizedRobotId = [self normalizedOptionalString:robotId];
    if (normalizedRobotId != nil) {
        return [self appendQueryItemToUri:baseUri key:@"robotId" value:normalizedRobotId];
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

- (void)prepareDeleteWeAgentTransitionWithPartnerAccount:(nullable NSString *)partnerAccount
                                                 robotId:(nullable NSString *)robotId
                                                 success:(void (^)(WLAgentSkillsDeleteTransitionPlan *plan))success
                                                 failure:(void (^)(NSError *error))failure {
    NSArray<NSDictionary *> *cachedDictionaries = [[WLAgentSkillsWeAgentStore sharedStore] loadWeAgentListDictionaries];
    NSArray<WLAgentSkillsWeAgent *> *cachedList = [self weAgentListFromDictionaries:cachedDictionaries];
    if (cachedList.count > 0) {
        if (success) {
            success([self deleteTransitionPlanFromSnapshot:cachedList
                                            partnerAccount:partnerAccount
                                                   robotId:robotId]);
        }
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentListWithPageSize:@(WLAgentSkillsDefaultWeAgentListPageSize)
                                                             pageNumber:@(WLAgentSkillsDefaultWeAgentListPageNumber)
                                                                success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        NSArray<WLAgentSkillsWeAgent *> *remoteList = [strongSelf parseWeAgentListFromResponse:responseObject];
        [[WLAgentSkillsWeAgentStore sharedStore] saveWeAgentListDictionaries:[strongSelf dictionariesFromWeAgentList:remoteList]];
        if (success) {
            success([strongSelf deleteTransitionPlanFromSnapshot:remoteList
                                                  partnerAccount:partnerAccount
                                                         robotId:robotId]);
        }
    }
                                                                failure:^(NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (WLAgentSkillsDeleteTransitionPlan *)deleteTransitionPlanFromSnapshot:(NSArray<WLAgentSkillsWeAgent *> *)snapshot
                                                         partnerAccount:(nullable NSString *)partnerAccount
                                                                robotId:(nullable NSString *)robotId {
    NSMutableArray<WLAgentSkillsWeAgent *> *updatedList = [snapshot mutableCopy];
    NSInteger deletedIndex = [self indexOfWeAgentInList:updatedList
                                         partnerAccount:partnerAccount
                                                robotId:robotId];
    WLAgentSkillsDeleteTransitionPlan *plan = [[WLAgentSkillsDeleteTransitionPlan alloc] init];
    if (deletedIndex == NSNotFound) {
        plan.updatedList = [updatedList copy];
        plan.nextPartnerAccount = nil;
        return plan;
    }

    [updatedList removeObjectAtIndex:deletedIndex];
    plan.updatedList = [updatedList copy];
    if (updatedList.count == 0) {
        plan.nextPartnerAccount = nil;
        return plan;
    }

    NSUInteger nextIndex = deletedIndex < updatedList.count ? (NSUInteger)deletedIndex : 0;
    plan.nextPartnerAccount = [self normalizedOptionalString:updatedList[nextIndex].partnerAccount];
    return plan;
}

- (NSInteger)indexOfWeAgentInList:(NSArray<WLAgentSkillsWeAgent *> *)list
                   partnerAccount:(nullable NSString *)partnerAccount
                          robotId:(nullable NSString *)robotId {
    NSString *normalizedPartnerAccount = [self normalizedOptionalString:partnerAccount];
    NSString *normalizedRobotId = [self normalizedOptionalString:robotId];
    for (NSUInteger index = 0; index < list.count; index++) {
        WLAgentSkillsWeAgent *item = list[index];
        if (normalizedPartnerAccount != nil
            && [normalizedPartnerAccount isEqualToString:[self normalizedOptionalString:item.partnerAccount]]) {
            return (NSInteger)index;
        }
        if (normalizedPartnerAccount == nil
            && normalizedRobotId != nil
            && [normalizedRobotId isEqualToString:[self normalizedOptionalString:item.robotId]]) {
            return (NSInteger)index;
        }
    }
    return NSNotFound;
}

- (void)handleDeleteWeAgentSuccessWithPlan:(WLAgentSkillsDeleteTransitionPlan *)plan
                              deleteResult:(WLAgentSkillsDeleteWeAgentResult *)deleteResult
                                   success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success {
    [[WLAgentSkillsWeAgentStore sharedStore] saveWeAgentListDictionaries:[self dictionariesFromWeAgentList:plan.updatedList]];
    if (plan.nextPartnerAccount.length == 0) {
        [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:nil];
        if (success) {
            success(deleteResult);
        }
        return;
    }

    NSDictionary *cachedDetail = [[WLAgentSkillsWeAgentStore sharedStore]
        loadWeAgentDetailDictionaryForPartnerAccount:plan.nextPartnerAccount];
    if ([cachedDetail isKindOfClass:[NSDictionary class]] && cachedDetail.count > 0) {
        [self finalizeDeleteWeAgentTransitionWithDetail:[[WLAgentSkillsWeAgentDetails alloc] initWithDictionary:cachedDetail]
                                           deleteResult:deleteResult
                                                success:success];
        return;
    }

    __weak typeof(self) weakSelf = self;
    [[WLAgentSkillsHTTPClient sharedClient] getWeAgentDetailsWithPartnerAccount:plan.nextPartnerAccount
                                                                         success:^(id  _Nullable responseObject) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        WLAgentSkillsWeAgentDetailsArrayResult *result = [strongSelf weAgentDetailsArrayResultFromPayload:responseObject];
        [strongSelf cacheWeAgentDetailsArrayResult:result
                                    partnerAccount:plan.nextPartnerAccount
                                 updateCurrentDetail:NO];
        WLAgentSkillsWeAgentDetails *nextDetail = result.weAgentDetailsArray.firstObject;
        [strongSelf finalizeDeleteWeAgentTransitionWithDetail:nextDetail
                                                 deleteResult:deleteResult
                                                      success:success];
    }
                                                                         failure:^(NSError * _Nonnull error) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        [strongSelf finalizeDeleteWeAgentTransitionWithDetail:nil
                                                 deleteResult:deleteResult
                                                      success:success];
    }];
}

- (WLAgentSkillsDeleteWeAgentContext *)buildDeleteWeAgentContextWithPartnerAccount:(nullable NSString *)partnerAccount
                                                                           robotId:(nullable NSString *)robotId {
    WLAgentSkillsDeleteWeAgentContext *context = [[WLAgentSkillsDeleteWeAgentContext alloc] init];
    context.partnerAccount = partnerAccount;
    context.robotId = robotId;
    context.deletingCurrentWeAgent = [self isCurrentWeAgentWithPartnerAccount:partnerAccount robotId:robotId];
    context.hasListCache = [[WLAgentSkillsWeAgentStore sharedStore] hasWeAgentListCache];
    return context;
}

- (void)requestDeleteWeAgentWithContext:(WLAgentSkillsDeleteWeAgentContext *)context
                                success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success
                                failure:(void (^)(NSError *error))failure {
    [[WLAgentSkillsHTTPClient sharedClient] deleteWeAgentWithPartnerAccount:context.partnerAccount
                                                                    robotId:context.robotId
                                                                    success:^(id  _Nullable responseObject) {
        NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
        NSNumber *codeNumber = [WLAgentSkillsTypeConverter optionalIntegerNumberFromValue:data[@"code"]
                                                                                fieldName:@"code"
                                                                             errorMessage:nil];
        if (codeNumber == nil) {
            if (failure) {
                failure([NSError errorWithDomain:WLAgentSkillsSDKErrorDomain
                                            code:7000
                                        userInfo:@{NSLocalizedDescriptionKey : @"Unexpected deleteWeAgent response schema."}]);
            }
            return;
        }
        if (codeNumber.integerValue != 200) {
            NSString *message = [WLAgentSkillsTypeConverter optionalStringFromValue:data[@"message"]] ?: @"deleteWeAgent failed.";
            [self dispatchFailure:failure
                             code:codeNumber.integerValue
                          message:message];
            return;
        }
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

- (void)prepareDeleteWeAgentContext:(WLAgentSkillsDeleteWeAgentContext *)context
                            success:(void (^)(WLAgentSkillsDeleteWeAgentContext *context))success
                            failure:(void (^)(NSError *error))failure {
    if (!context.deletingCurrentWeAgent) {
        if (success) {
            success(context);
        }
        return;
    }

    [self prepareDeleteWeAgentTransitionWithPartnerAccount:context.partnerAccount
                                                   robotId:context.robotId
                                                   success:^(WLAgentSkillsDeleteTransitionPlan *plan) {
        context.transitionPlan = plan;
        if (success) {
            success(context);
        }
    }
                                                   failure:^(NSError *error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)handleDeleteWeAgentResultWithContext:(WLAgentSkillsDeleteWeAgentContext *)context
                                deleteResult:(WLAgentSkillsDeleteWeAgentResult *)deleteResult
                                     success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success
                                     failure:(void (^)(NSError *error))failure {
    if (!context.deletingCurrentWeAgent) {
        [self handleDeleteNonCurrentWeAgentSuccessWithContext:context
                                                 deleteResult:deleteResult
                                                      success:success];
        return;
    }
    WLAgentSkillsDeleteTransitionPlan *plan = context.transitionPlan;
    if (plan == nil) {
        plan = [[WLAgentSkillsDeleteTransitionPlan alloc] init];
        plan.updatedList = @[];
        plan.nextPartnerAccount = nil;
    }
    [self handleDeleteWeAgentSuccessWithPlan:plan
                                deleteResult:deleteResult
                                     success:success];
}

- (void)handleDeleteNonCurrentWeAgentSuccessWithContext:(WLAgentSkillsDeleteWeAgentContext *)context
                                           deleteResult:(WLAgentSkillsDeleteWeAgentResult *)deleteResult
                                                success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success {
    WLAgentSkillsWeAgentStore *store = [WLAgentSkillsWeAgentStore sharedStore];
    if (context.hasListCache) {
        NSArray<WLAgentSkillsWeAgent *> *cachedList = [self weAgentListFromDictionaries:[store loadWeAgentListDictionaries]];
        WLAgentSkillsDeleteTransitionPlan *plan = [self deleteTransitionPlanFromSnapshot:cachedList
                                                                          partnerAccount:context.partnerAccount
                                                                                 robotId:context.robotId];
        [store saveWeAgentListDictionaries:[self dictionariesFromWeAgentList:plan.updatedList]];
    }
    if (success) {
        success(deleteResult);
    }
}

- (void)finalizeDeleteWeAgentTransitionWithDetail:(nullable WLAgentSkillsWeAgentDetails *)nextDetail
                                     deleteResult:(WLAgentSkillsDeleteWeAgentResult *)deleteResult
                                          success:(void (^)(WLAgentSkillsDeleteWeAgentResult *result))success {
    WLAgentSkillsWeAgentUriResult *nextUris = nil;
    if (nextDetail == nil) {
        [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:nil];
        nextUris = [self weAgentUriResultFromDetails:nil];
    } else {
        [[WLAgentSkillsWeAgentStore sharedStore] saveCurrentWeAgentDetailDictionary:[nextDetail toDictionary]];
        nextUris = [self weAgentUriResultFromDetails:nextDetail];
    }
    (void)nextUris;
    // TODO: call openWeAgentCUI with nextUris.weAgentUri, nextUris.assistantDetailUri and nextUris.switchAssistantUri.
    if (success) {
        success(deleteResult);
    }
}

- (BOOL)isCurrentWeAgentWithPartnerAccount:(nullable NSString *)partnerAccount
                                   robotId:(nullable NSString *)robotId {
    NSDictionary *currentDetail = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
    return [self detailDictionary:currentDetail matchesPartnerAccount:partnerAccount robotId:robotId];
}

- (BOOL)detailDictionary:(nullable NSDictionary *)dictionary
     matchesPartnerAccount:(nullable NSString *)partnerAccount
                    robotId:(nullable NSString *)robotId {
    if (![dictionary isKindOfClass:[NSDictionary class]]) {
        return NO;
    }
    NSString *normalizedPartnerAccount = [self normalizedOptionalString:partnerAccount];
    if (normalizedPartnerAccount != nil) {
        return [normalizedPartnerAccount isEqualToString:[self normalizedOptionalString:dictionary[@"partnerAccount"]]];
    }
    NSString *normalizedRobotId = [self normalizedOptionalString:robotId];
    return normalizedRobotId != nil
        && [normalizedRobotId isEqualToString:[self normalizedOptionalString:dictionary[@"id"]]];
}

- (WLAgentSkillsWeAgentUriResult *)weAgentUriResultFromDetails:(nullable WLAgentSkillsWeAgentDetails *)details {
    WLAgentSkillsWeAgentUriResult *result = [[WLAgentSkillsWeAgentUriResult alloc] init];
    if (details == nil) {
        NSString *fallbackWeAgentUri = [self appendQueryItemToUri:WLAgentSkillsAssistantH5URI
                                                              key:@"wecodePlace"
                                                            value:@"weAgent"];
        result.weAgentUri = [self appendHashToUri:fallbackWeAgentUri hash:@"activateAssistant"] ?: @"";
        result.assistantDetailUri = @"";
        result.switchAssistantUri = @"";
        return result;
    }

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
