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
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *sendMessageTriggeredBySession;
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
                _sendMessageTriggeredBySession = [NSMutableDictionary dictionary];
                [WLAgentSkillsWebSocketManager sharedManager].delegate = self;
        }
        return self;
}

#pragma mark - 1. createSession

- (void)createSession:(WLAgentSkillsCreateSessionParams *)params
                                                        success:(void (^)(WLAgentSkillsSkillSession *session))success
                                                        failure:(void (^)(NSError *error))failure {
        if (params == nil || params.imGroupId.length == 0) {
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
        if (params == nil || params.welinkSessionId.length == 0) {
                [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
                return;
        }

        __weak typeof(self) weakSelf = self;
        [[WLAgentSkillsHTTPClient sharedClient] abortSessionWithSessionId:params.welinkSessionId
                                                                                                                                                                                                                                                    success:^(id  _Nullable responseObject) {
                NSDictionary *data = [responseObject isKindOfClass:[NSDictionary class]] ? responseObject : @{};
                WLAgentSkillsStopSkillResult *result = [[WLAgentSkillsStopSkillResult alloc] initWithDictionary:data];
                [weakSelf setSendMessageTriggered:NO sessionId:params.welinkSessionId];
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
        if (params == nil || params.welinkSessionId.length == 0 || params.callback == nil) {
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
        if (params == nil || params.welinkSessionId.length == 0) {
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
        if (params == nil || params.welinkSessionId.length == 0) {
                [self dispatchFailure:failure code:1000 message:@"Invalid params: welinkSessionId is required."];
                return;
        }
        NSString *normalizedMessageId = [self normalizedOptionalString:params.messageId];
        NSString *normalizedChatId = [self normalizedOptionalString:params.chatId];

        __weak typeof(self) weakSelf = self;
        void (^sendWithContent)(NSString *) = ^(NSString *content) {
                [[WLAgentSkillsHTTPClient sharedClient] sendToIMWithSessionId:params.welinkSessionId
                                                                                                                                                                                                                                        content:content
                                                                                                                                                                                                                                            chatId:normalizedChatId
                                                                                                                                                                                                                                        success:^(id  _Nullable responseObject) {
                                WLAgentSkillsSendMessageToIMResult *result = [[WLAgentSkillsSendMessageToIMResult alloc] init];

                                if ([responseObject isKindOfClass:[NSDictionary class]]) {
                                        NSDictionary *dict = responseObject;
                                        if (dict[@"success"] != nil) {
                                                result.success = [dict[@"success"] boolValue];
                                        } else if (dict[@"status"] != nil) {
                                                result.success = [[dict[@"status"] description] isEqualToString:@"success"];
                                        } else {
                                                result.success = YES;
                                        }
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
        if (content.length > 0) {
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
                if (latest.length == 0) {
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
        if (params == nil || params.welinkSessionId.length == 0) {
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
                        @"number" : @(pageValue),
                        @"size" : @(sizeValue),
                        @"totalElements" : @(merged.count)
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

- (WLAgentSkillsRegisterSessionListenerResult *)registerSessionListener:(WLAgentSkillsRegisterSessionListenerParams *)params {
        if (params == nil || params.welinkSessionId.length == 0 || params.onMessage == nil) {
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
        if (params != nil && params.welinkSessionId.length > 0) {
                [[WLAgentSkillsWebSocketManager sharedManager] removeListenerForSessionId:params.welinkSessionId];
        }
        return [self buildUnregisterSessionListenerResult];
}

#pragma mark - 11. sendMessage

- (void)sendMessage:(WLAgentSkillsSendMessageParams *)params
                                                success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                                                failure:(void (^)(NSError *error))failure {
        if (params == nil || params.welinkSessionId.length == 0 || params.content.length == 0) {
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
        if (params == nil || params.welinkSessionId.length == 0 || params.permId.length == 0 || params.response.length == 0) {
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

        NSString *sessionId = message.welinkSessionId;
        if (sessionId.length == 0) {
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
                if (ak.length > 0 && ![ak isEqualToString:sessionAK]) {
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
        return trimmed.length > 0 ? trimmed : nil;
}

- (NSInteger)mapStreamMessageToSessionStatus:(WLAgentSkillsStreamMessage *)message
                                                                                                                                                sessionId:(NSString *)sessionId {
        NSString *type = message.type ?: @"";

        if (![type isEqualToString:@"session.status"]) {
                return NSNotFound;
        }

        if ([message.sessionStatus isEqualToString:@"busy"] || [message.sessionStatus isEqualToString:@"retry"]) {
                if ([self isSendMessageTriggeredForSessionId:sessionId]) {
                        return WLAgentSkillsClientSessionStatusExecuting;
                }
                return NSNotFound;
        }

        if ([message.sessionStatus isEqualToString:@"idle"]) {
                [self setSendMessageTriggered:NO sessionId:sessionId];
                return WLAgentSkillsClientSessionStatusCompleted;
        }

        return NSNotFound;
}

- (void)emitSessionStatus:(WLAgentSkillsClientSessionStatus)status sessionId:(NSString *)sessionId {
        WLAgentSkillsSessionStatusCallback callback = nil;
        @synchronized(self) {
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
        if (sessionId.length == 0) {
                return;
        }

        @synchronized(self) {
                self.sendMessageTriggeredBySession[sessionId] = @(triggered);
        }
}

- (BOOL)isSendMessageTriggeredForSessionId:(NSString *)sessionId {
        if (sessionId.length == 0) {
                return NO;
        }

        @synchronized(self) {
                return [self.sendMessageTriggeredBySession[sessionId] boolValue];
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
