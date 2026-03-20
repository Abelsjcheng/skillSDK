//
//  WLAgentSkillsStreamingCache.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsStreamingCache.h"

@interface WLAgentSkillsStreamingCache ()

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary<NSString *, NSMutableDictionary *> *> *messagesBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary<NSString *, NSString *> *> *messageIdIndexBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *nextSyntheticIdBySession;
@property (nonatomic, strong) dispatch_queue_t messagesBySessionQueue;
@property (nonatomic, strong) dispatch_queue_t messageIdIndexBySessionQueue;
@property (nonatomic, strong) dispatch_queue_t nextSyntheticIdBySessionQueue;

@end

@implementation WLAgentSkillsStreamingCache

+ (instancetype)sharedCache {
    static WLAgentSkillsStreamingCache *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[WLAgentSkillsStreamingCache alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _messagesBySession = [NSMutableDictionary dictionary];
        _messageIdIndexBySession = [NSMutableDictionary dictionary];
        _nextSyntheticIdBySession = [NSMutableDictionary dictionary];
        _messagesBySessionQueue = dispatch_queue_create("com.wlagentskills.cache.messages", DISPATCH_QUEUE_CONCURRENT);
        _messageIdIndexBySessionQueue = dispatch_queue_create("com.wlagentskills.cache.messageIndex", DISPATCH_QUEUE_CONCURRENT);
        _nextSyntheticIdBySessionQueue = dispatch_queue_create("com.wlagentskills.cache.syntheticId", DISPATCH_QUEUE_CONCURRENT);
    }
    return self;
}

- (void)updateWithStreamMessage:(WLAgentSkillsStreamMessage *)message {
    if (message == nil || message.welinkSessionId == nil || message.welinkSessionId.length == 0) {
        return;
    }

    NSString *sessionKey = message.welinkSessionId;
    [self withStateWriteLock:^{
        if ([message.type isEqualToString:@"snapshot"]) {
            [self applySnapshot:message];
            return;
        }

        if ([message.type isEqualToString:@"streaming"]) {
            [self applyStreaming:message];
            return;
        }

        if ([self isTransportOnlyType:message.type]) {
            [self applyTransportOnlyEventForSession:sessionKey message:message];
            return;
        }

        if ((message.messageId == nil || message.messageId.length == 0) && message.messageSeq == nil) {
            return;
        }

        NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                                                                                    messageId:message.messageId
                                                                                                                                messageSeq:message.messageSeq
                                                                                                                                            role:message.role];
        NSMutableDictionary *partStore = [self ensurePartStoreForMessageStore:messageStore streamMessage:message];
        [self applyMessage:message toPartStore:partStore];
        [self recomputeContentForMessageStore:messageStore];
        [self applyCompletionStateWithMessage:message toMessageStore:messageStore];
        messageStore[@"updatedAt"] = @([self currentTimestampMs]);
    }];
}

- (void)cacheSendMessageResult:(WLAgentSkillsSendMessageResult *)result {
    if (result == nil ||
            result.welinkSessionId == nil ||
            result.welinkSessionId.length == 0 ||
            result.id == nil ||
            result.id.length == 0) {
        return;
    }

    NSString *sessionKey = result.welinkSessionId;
    NSString *messageId = result.id;
    [self withStateWriteLock:^{
        NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                                                                                    messageId:messageId
                                                                                                                                messageSeq:result.messageSeq
                                                                                                                                            role:result.role];
        messageStore[@"welinkSessionId"] = result.welinkSessionId;
        if (result.seq != nil) {
            messageStore[@"seq"] = result.seq;
        } else {
            [messageStore removeObjectForKey:@"seq"];
        }
        messageStore[@"content"] = result.content ?: @"";
        messageStore[@"createdAt"] = result.createdAt ?: @"";
        messageStore[@"completed"] = @YES;
        messageStore[@"updatedAt"] = @([self currentTimestampMs]);
    }];
}

- (void)cacheHistoryMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages
                                forSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
        return;
    }

    NSString *sessionKey = welinkSessionId;
    [self withStateWriteLock:^{
        for (WLAgentSkillsSessionMessage *message in messages) {
            NSString *messageId = [self normalizedMessageIdValue:message.id];
            NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                                                                                        messageId:messageId
                                                                                                                                    messageSeq:message.messageSeq
                                                                                                                                                role:message.role];
            messageStore[@"welinkSessionId"] = welinkSessionId;
            if (message.seq != nil) {
                messageStore[@"seq"] = message.seq;
            } else {
                [messageStore removeObjectForKey:@"seq"];
            }
            messageStore[@"content"] = message.content ?: @"";
            messageStore[@"createdAt"] = message.createdAt ?: @"";
            messageStore[@"completed"] = @YES;
            if (message.contentType != nil && message.contentType.length > 0) {
                messageStore[@"contentType"] = message.contentType;
            } else {
                [messageStore removeObjectForKey:@"contentType"];
            }

            NSMutableDictionary *parts = [NSMutableDictionary dictionary];
            for (WLAgentSkillsSessionMessagePart *part in message.parts) {
                NSMutableDictionary *partDictionary = [[part toDictionary] mutableCopy];
                NSString *partId = [self partIdentifierFromPartDictionary:partDictionary];
                if (partId.length == 0) {
                    continue;
                }
                parts[partId] = partDictionary;
            }
            messageStore[@"parts"] = parts;
            messageStore[@"updatedAt"] = @([self currentTimestampMs]);
        }
    }];
}

- (nullable WLAgentSkillsSessionMessage *)latestLocalMessageNotInServerMessages:(NSArray<WLAgentSkillsSessionMessage *> *)serverMessages
                                                                                                                                sessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
        return nil;
    }

    [self cacheHistoryMessages:serverMessages forSessionId:welinkSessionId];

    NSString *sessionKey = welinkSessionId;
    return [self withStateReadLock:^id{
        NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey] ?: @{};
        NSMutableDictionary *latestStore = nil;

        for (NSMutableDictionary *store in messages.allValues) {
            WLAgentSkillsSessionMessage *candidate = [self messageModelFromStore:store sessionKey:sessionKey];
            if ([self containsMessage:candidate inServerMessages:serverMessages]) {
                continue;
            }

            if (latestStore == nil) {
                latestStore = store;
                continue;
            }

            NSComparisonResult orderCompare = [self compareMessageStoreOrder:store other:latestStore];
            if (orderCompare == NSOrderedDescending) {
                latestStore = store;
                continue;
            }
            if (orderCompare == NSOrderedSame) {
                NSNumber *latestUpdated = latestStore[@"updatedAt"] ?: @0;
                NSNumber *currentUpdated = store[@"updatedAt"] ?: @0;
                if ([currentUpdated compare:latestUpdated] == NSOrderedDescending) {
                    latestStore = store;
                }
            }
        }

        if (latestStore == nil) {
            return nil;
        }
        return [self messageModelFromStore:latestStore sessionKey:sessionKey];
    }];
}

- (nullable NSString *)latestCompletedContentForSessionId:(NSString *)welinkSessionId
                                                                                                    messageId:(nullable NSString *)messageId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
        return nil;
    }

    NSString *sessionKey = welinkSessionId;
    return [self withStateReadLock:^id{
        NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey];
        if (messages.count == 0) {
            return nil;
        }

        if (messageId != nil && messageId.length > 0) {
            NSString *messageKey = [self resolveMessageKeyForSession:sessionKey messageId:messageId messageSeq:nil createIfMissing:NO];
            if (messageKey == nil || messageKey.length == 0) {
                messageKey = messageId;
            }
            NSDictionary *store = messages[messageKey];
            if (store == nil || ![store[@"completed"] boolValue]) {
                return nil;
            }
            NSString *content = [store[@"content"] isKindOfClass:[NSString class]] ? store[@"content"] : nil;
            return (content != nil && content.length > 0) ? content : nil;
        }

        NSArray<NSMutableDictionary *> *sortedStores = [messages.allValues sortedArrayUsingComparator:^NSComparisonResult(NSMutableDictionary *lhs, NSMutableDictionary *rhs) {
            NSComparisonResult orderCompare = [self compareMessageStoreOrder:lhs other:rhs];
            if (orderCompare != NSOrderedSame) {
                return orderCompare;
            }
            NSNumber *leftUpdated = lhs[@"updatedAt"] ?: @0;
            NSNumber *rightUpdated = rhs[@"updatedAt"] ?: @0;
            return [leftUpdated compare:rightUpdated];
        }];

        for (NSMutableDictionary *store in [sortedStores reverseObjectEnumerator]) {
            if (![store[@"completed"] boolValue]) {
                continue;
            }
            NSString *content = [store[@"content"] isKindOfClass:[NSString class]] ? store[@"content"] : nil;
            if (content != nil && content.length > 0) {
                return content;
            }
        }
        return nil;
    }];
}

- (BOOL)hasMessageForSessionId:(NSString *)welinkSessionId messageId:(NSString *)messageId {
    if (welinkSessionId == nil || welinkSessionId.length == 0 || messageId == nil || messageId.length == 0) {
        return NO;
    }

    NSNumber *result = [self withStateReadLock:^id{
        NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[welinkSessionId];
        if (messages.count == 0) {
            return @NO;
        }
        NSString *messageKey = [self resolveMessageKeyForSession:welinkSessionId
                                                                        messageId:messageId
                                                                        messageSeq:nil
                                                            createIfMissing:NO];
        BOOL found = messageKey != nil && messageKey.length > 0 && messages[messageKey] != nil;
        return @(found);
    }];
    return result.boolValue;
}

- (BOOL)isMessageCompletedForSessionId:(NSString *)welinkSessionId messageId:(NSString *)messageId {
    if (welinkSessionId == nil || welinkSessionId.length == 0 || messageId == nil || messageId.length == 0) {
        return NO;
    }

    NSNumber *result = [self withStateReadLock:^id{
        NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[welinkSessionId];
        if (messages.count == 0) {
            return @NO;
        }
        NSString *messageKey = [self resolveMessageKeyForSession:welinkSessionId
                                                                        messageId:messageId
                                                                        messageSeq:nil
                                                            createIfMissing:NO];
        if (messageKey == nil || messageKey.length == 0) {
            return @NO;
        }
        NSDictionary *store = messages[messageKey];
        return @([store[@"completed"] boolValue]);
    }];
    return result.boolValue;
}

- (nullable NSString *)lastUserMessageContentForSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
        return nil;
    }

    NSString *sessionKey = welinkSessionId;
    return [self withStateReadLock:^id{
        NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey];
        if (messages.count == 0) {
            return nil;
        }

        NSArray<NSMutableDictionary *> *sortedStores = [messages.allValues sortedArrayUsingComparator:^NSComparisonResult(NSMutableDictionary *lhs, NSMutableDictionary *rhs) {
            return [self compareMessageStoreOrder:lhs other:rhs];
        }];

        for (NSMutableDictionary *store in [sortedStores reverseObjectEnumerator]) {
            NSString *role = [store[@"role"] isKindOfClass:[NSString class]] ? store[@"role"] : nil;
            if (role == nil || ![role.lowercaseString isEqualToString:@"user"]) {
                continue;
            }
            NSString *content = [store[@"content"] isKindOfClass:[NSString class]] ? store[@"content"] : nil;
            if (content != nil && content.length > 0) {
                return content;
            }
        }
        return nil;
    }];
}

- (void)clearCacheForSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
        return;
    }
    NSString *sessionKey = welinkSessionId;
    [self withStateWriteLock:^{
        [self.messagesBySession removeObjectForKey:sessionKey];
        [self.messageIdIndexBySession removeObjectForKey:sessionKey];
        [self.nextSyntheticIdBySession removeObjectForKey:sessionKey];
    }];
}

- (void)clearAllCache {
    [self withStateWriteLock:^{
        [self.messagesBySession removeAllObjects];
        [self.messageIdIndexBySession removeAllObjects];
        [self.nextSyntheticIdBySession removeAllObjects];
    }];
}

#pragma mark - Internal

- (void)withStateWriteLock:(dispatch_block_t)block {
    if (block == nil) {
        return;
    }

    dispatch_barrier_sync(self.messagesBySessionQueue, ^{
        dispatch_barrier_sync(self.messageIdIndexBySessionQueue, ^{
            dispatch_barrier_sync(self.nextSyntheticIdBySessionQueue, ^{
                block();
            });
        });
    });
}

- (nullable id)withStateReadLock:(id (^)(void))block {
    if (block == nil) {
        return nil;
    }

    __block id result = nil;
    dispatch_sync(self.messagesBySessionQueue, ^{
        dispatch_sync(self.messageIdIndexBySessionQueue, ^{
            dispatch_sync(self.nextSyntheticIdBySessionQueue, ^{
                result = block();
            });
        });
    });
    return result;
}

- (BOOL)isTransportOnlyType:(NSString *)type {
    return [type isEqualToString:@"session.status"] ||
                    [type isEqualToString:@"session.title"] ||
                    [type isEqualToString:@"session.error"] ||
                    [type isEqualToString:@"agent.online"] ||
                    [type isEqualToString:@"agent.offline"] ||
                    [type isEqualToString:@"error"];
}

- (void)applyTransportOnlyEventForSession:(NSString *)sessionId message:(WLAgentSkillsStreamMessage *)message {
    if ([message.type isEqualToString:@"session.status"]) {
        if ([message.sessionStatus isEqualToString:@"idle"]) {
            [self markLatestMessageForSession:sessionId completed:YES];
            return;
        }
        if ([message.sessionStatus isEqualToString:@"busy"] || [message.sessionStatus isEqualToString:@"retry"]) {
            [self markLatestMessageForSession:sessionId completed:NO];
        }
        return;
    }

    if ([message.type isEqualToString:@"session.error"] ||
            [message.type isEqualToString:@"error"] ||
            [message.type isEqualToString:@"agent.offline"]) {
        [self markLatestMessageForSession:sessionId completed:YES];
    }
}

- (NSMutableDictionary<NSString *, NSMutableDictionary *> *)ensureSessionMessages:(NSString *)sessionId {
    NSMutableDictionary<NSString *, NSMutableDictionary *> *sessionMessages = self.messagesBySession[sessionId];
    if (sessionMessages == nil) {
        sessionMessages = [NSMutableDictionary dictionary];
        self.messagesBySession[sessionId] = sessionMessages;
    }
    return sessionMessages;
}

- (NSMutableDictionary<NSString *, NSString *> *)ensureMessageIndexForSession:(NSString *)sessionId {
    NSMutableDictionary<NSString *, NSString *> *sessionIndex = self.messageIdIndexBySession[sessionId];
    if (sessionIndex == nil) {
        sessionIndex = [NSMutableDictionary dictionary];
        self.messageIdIndexBySession[sessionId] = sessionIndex;
    }
    return sessionIndex;
}

- (NSString *)nextSyntheticMessageKeyForSession:(NSString *)sessionId {
    NSNumber *current = self.nextSyntheticIdBySession[sessionId];
    NSInteger value = current != nil ? current.integerValue : -1;
    self.nextSyntheticIdBySession[sessionId] = @(value - 1);
    return [NSString stringWithFormat:@"__local_%ld", (long)value];
}

- (NSString *)sequenceAliasFromMessageSeq:(NSNumber *)messageSeq {
    return [NSString stringWithFormat:@"seq_%@", messageSeq];
}

- (NSString *)normalizedMessageIdValue:(id)value {
    if ([value isKindOfClass:[NSString class]]) {
        return (NSString *)value;
    }
    if ([value respondsToSelector:@selector(stringValue)]) {
        return [value stringValue];
    }
    return @"";
}

- (void)bindAliasesForSession:(NSString *)sessionId
                                        messageKey:(NSString *)messageKey
                                            messageId:(nullable NSString *)messageId
                                        messageSeq:(nullable NSNumber *)messageSeq {
    NSMutableDictionary<NSString *, NSString *> *sessionIndex = [self ensureMessageIndexForSession:sessionId];
    sessionIndex[messageKey] = messageKey;
    if (messageId != nil && messageId.length > 0) {
        sessionIndex[messageId] = messageKey;
    }
    if (messageSeq != nil) {
        sessionIndex[[self sequenceAliasFromMessageSeq:messageSeq]] = messageKey;
    }
}

- (nullable NSString *)resolveMessageKeyForSession:(NSString *)sessionId
                                                                                    messageId:(nullable NSString *)messageId
                                                                                    messageSeq:(nullable NSNumber *)messageSeq
                                                                        createIfMissing:(BOOL)createIfMissing {
    NSMutableDictionary<NSString *, NSString *> *sessionIndex = [self ensureMessageIndexForSession:sessionId];
    NSMutableDictionary<NSString *, NSMutableDictionary *> *sessionMessages = [self ensureSessionMessages:sessionId];

    if (messageId != nil && messageId.length > 0) {
        NSString *existing = sessionIndex[messageId];
        if (existing != nil && existing.length > 0) {
            return existing;
        }
        if (!createIfMissing) {
            return nil;
        }
        NSString *messageKey = messageId;
        if (sessionMessages[messageKey] != nil) {
            messageKey = [NSString stringWithFormat:@"%@_%@", messageId, [NSUUID UUID].UUIDString];
        }
        [self bindAliasesForSession:sessionId messageKey:messageKey messageId:messageId messageSeq:messageSeq];
        return messageKey;
    }

    if (messageSeq != nil) {
        NSString *seqAlias = [self sequenceAliasFromMessageSeq:messageSeq];
        NSString *existing = sessionIndex[seqAlias];
        if (existing != nil && existing.length > 0) {
            return existing;
        }
        if (!createIfMissing) {
            return nil;
        }
        NSString *messageKey = seqAlias;
        [self bindAliasesForSession:sessionId messageKey:messageKey messageId:nil messageSeq:messageSeq];
        return messageKey;
    }

    if (!createIfMissing) {
        return nil;
    }
    NSString *messageKey = [self nextSyntheticMessageKeyForSession:sessionId];
    [self bindAliasesForSession:sessionId messageKey:messageKey messageId:nil messageSeq:nil];
    return messageKey;
}

- (NSMutableDictionary *)ensureMessageStoreForSession:(NSString *)sessionId
                                                                                        messageId:(nullable NSString *)messageId
                                                                                        messageSeq:(nullable NSNumber *)messageSeq
                                                                                                    role:(nullable NSString *)role {
    NSString *messageKey = [self resolveMessageKeyForSession:sessionId
                                                                                                    messageId:messageId
                                                                                                    messageSeq:messageSeq
                                                                                        createIfMissing:YES];
    NSMutableDictionary<NSString *, NSMutableDictionary *> *sessionMessages = [self ensureSessionMessages:sessionId];
    NSMutableDictionary *messageStore = sessionMessages[messageKey];
    if (messageStore == nil) {
        messageStore = [@{
            @"messageId" : (messageId != nil && messageId.length > 0) ? messageId : messageKey,
            @"messageSeq" : messageSeq ?: @0,
            @"role" : role ?: @"assistant",
            @"parts" : [NSMutableDictionary dictionary],
            @"content" : @"",
            @"completed" : @NO,
            @"createdAt" : @"",
            @"updatedAt" : @([self currentTimestampMs])
        } mutableCopy];
        sessionMessages[messageKey] = messageStore;
    }

    if (messageSeq != nil && [messageSeq compare:messageStore[@"messageSeq"]] == NSOrderedDescending) {
        messageStore[@"messageSeq"] = messageSeq;
    }
    if (role != nil && role.length > 0) {
        messageStore[@"role"] = role;
    }
    if (messageId != nil && messageId.length > 0) {
        messageStore[@"messageId"] = messageId;
    }
    [self bindAliasesForSession:sessionId messageKey:messageKey messageId:messageId messageSeq:messageSeq];
    return messageStore;
}

- (NSString *)partIdentifierFromPartDictionary:(NSDictionary *)part {
    NSString *partId = [part[@"partId"] isKindOfClass:[NSString class]] ? part[@"partId"] : @"";
    if (partId.length > 0) {
        return partId;
    }
    NSNumber *partSeq = [part[@"partSeq"] isKindOfClass:[NSNumber class]] ? part[@"partSeq"] : nil;
    if (partSeq != nil) {
        return [NSString stringWithFormat:@"partseq_%@", partSeq];
    }
    return @"";
}

- (NSMutableDictionary *)ensurePartStoreForMessageStore:(NSMutableDictionary *)messageStore
                                                                                        streamMessage:(WLAgentSkillsStreamMessage *)message {
    NSMutableDictionary *partsStore = messageStore[@"parts"];
    if (![partsStore isKindOfClass:[NSMutableDictionary class]]) {
        partsStore = [NSMutableDictionary dictionary];
        messageStore[@"parts"] = partsStore;
    }

    NSString *partId = message.partId;
    if (partId.length == 0 && message.partSeq != nil) {
        partId = [NSString stringWithFormat:@"partseq_%@", message.partSeq];
    }
    if (partId.length == 0) {
        partId = [NSString stringWithFormat:@"meta_%@_%lu", message.type ?: @"unknown", (unsigned long)partsStore.count];
    }

    NSMutableDictionary *partStore = partsStore[partId];
    if (partStore == nil) {
        partStore = [@{ @"partId" : partId } mutableCopy];
        partsStore[partId] = partStore;
    }

    if (message.partSeq != nil) {
        partStore[@"partSeq"] = message.partSeq;
    }

    NSString *partType = [self partTypeFromMessageType:message.type explicitType:partStore[@"type"]];
    if (partType.length > 0) {
        partStore[@"type"] = partType;
    }
    return partStore;
}

- (void)applyMessage:(WLAgentSkillsStreamMessage *)message toPartStore:(NSMutableDictionary *)partStore {
    if ([message.type isEqualToString:@"text.delta"] || [message.type isEqualToString:@"thinking.delta"]) {
        NSString *existing = partStore[@"content"] ?: @"";
        NSString *delta = message.content ?: @"";
        partStore[@"content"] = [existing stringByAppendingString:delta];
        return;
    }

    if ([message.type isEqualToString:@"text.done"] || [message.type isEqualToString:@"thinking.done"]) {
        partStore[@"content"] = message.content ?: @"";
        return;
    }

    if ([message.type isEqualToString:@"tool.update"]) {
        partStore[@"toolName"] = message.toolName ?: @"";
        if (message.toolCallId != nil && message.toolCallId.length > 0) {
            partStore[@"toolCallId"] = message.toolCallId;
        }
        if (message.status != nil && message.status.length > 0) {
            partStore[@"status"] = message.status;
        }
        if (message.input != nil && message.input.count > 0) {
            partStore[@"input"] = message.input;
        }
        if (message.output != nil && message.output.length > 0) {
            partStore[@"output"] = message.output;
        }
        if (message.error != nil && message.error.length > 0) {
            partStore[@"error"] = message.error;
        }
        if (message.title != nil && message.title.length > 0) {
            partStore[@"title"] = message.title;
        }
        return;
    }

    if ([message.type isEqualToString:@"question"]) {
        partStore[@"toolName"] = message.toolName ?: @"question";
        if (message.toolCallId != nil && message.toolCallId.length > 0) {
            partStore[@"toolCallId"] = message.toolCallId;
        }
        if (message.status != nil && message.status.length > 0) {
            partStore[@"status"] = message.status;
        }
        if (message.input != nil && message.input.count > 0) {
            partStore[@"input"] = message.input;
        }
        if (message.header != nil && message.header.length > 0) {
            partStore[@"header"] = message.header;
        }
        if (message.question != nil && message.question.length > 0) {
            partStore[@"question"] = message.question;
            partStore[@"content"] = message.question;
        }
        if (message.options != nil && message.options.count > 0) {
            partStore[@"options"] = message.options;
        }
        return;
    }

    if ([message.type isEqualToString:@"file"]) {
        if (message.fileName != nil && message.fileName.length > 0) {
            partStore[@"fileName"] = message.fileName;
        }
        if (message.fileUrl != nil && message.fileUrl.length > 0) {
            partStore[@"fileUrl"] = message.fileUrl;
            partStore[@"content"] = message.fileUrl;
        }
        if (message.fileMime != nil && message.fileMime.length > 0) {
            partStore[@"fileMime"] = message.fileMime;
        }
        return;
    }

    if ([message.type isEqualToString:@"permission.ask"] || [message.type isEqualToString:@"permission.reply"]) {
        if (message.permissionId != nil && message.permissionId.length > 0) {
            partStore[@"permissionId"] = message.permissionId;
        }
        if (message.permType != nil && message.permType.length > 0) {
            partStore[@"permType"] = message.permType;
        }
        if (message.metadata != nil && message.metadata.count > 0) {
            partStore[@"metadata"] = message.metadata;
        }
        if (message.response != nil && message.response.length > 0) {
            partStore[@"response"] = message.response;
        }
        if (message.title != nil && message.title.length > 0) {
            partStore[@"title"] = message.title;
            partStore[@"content"] = message.title;
        }
        if ([message.type isEqualToString:@"permission.reply"] && message.response != nil && message.response.length > 0) {
            partStore[@"content"] = message.response;
        }
        return;
    }

    if (message.content != nil && message.content.length > 0) {
        partStore[@"content"] = message.content;
    }
}

- (NSString *)partTypeFromMessageType:(NSString *)messageType explicitType:(nullable NSString *)explicitType {
    if (explicitType != nil && explicitType.length > 0) {
        return explicitType;
    }
    if ([messageType hasPrefix:@"text"]) {
        return @"text";
    }
    if ([messageType hasPrefix:@"thinking"]) {
        return @"thinking";
    }
    if ([messageType isEqualToString:@"tool.update"]) {
        return @"tool";
    }
    if ([messageType isEqualToString:@"question"]) {
        return @"question";
    }
    if ([messageType hasPrefix:@"permission"]) {
        return @"permission";
    }
    if ([messageType isEqualToString:@"file"]) {
        return @"file";
    }
    return @"text";
}

- (void)recomputeContentForMessageStore:(NSMutableDictionary *)messageStore {
    NSDictionary<NSString *, NSDictionary *> *partsStore = [messageStore[@"parts"] isKindOfClass:[NSDictionary class]]
            ? messageStore[@"parts"]
            : @{};
    NSMutableArray<NSDictionary *> *partValues = [NSMutableArray array];
    for (id value in partsStore.allValues) {
        if ([value isKindOfClass:[NSDictionary class]]) {
            [partValues addObject:value];
        }
    }
    NSArray<NSDictionary *> *parts = [partValues sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *lhs, NSDictionary *rhs) {
        NSNumber *left = lhs[@"partSeq"] ?: @0;
        NSNumber *right = rhs[@"partSeq"] ?: @0;
        NSComparisonResult seqCompare = [left compare:right];
        if (seqCompare != NSOrderedSame) {
            return seqCompare;
        }
        NSString *leftId = [lhs[@"partId"] isKindOfClass:[NSString class]] ? lhs[@"partId"] : @"";
        NSString *rightId = [rhs[@"partId"] isKindOfClass:[NSString class]] ? rhs[@"partId"] : @"";
        return [leftId compare:rightId];
    }];

    NSMutableArray<NSString *> *contentPieces = [NSMutableArray array];
    for (NSDictionary *part in parts) {
        NSString *content = [part[@"content"] isKindOfClass:[NSString class]] ? part[@"content"] : nil;
        if (content == nil || content.length == 0) {
            content = [part[@"output"] isKindOfClass:[NSString class]] ? part[@"output"] : nil;
        }
        if (content != nil && content.length > 0) {
            [contentPieces addObject:content];
        }
    }

    messageStore[@"content"] = [contentPieces componentsJoinedByString:@"\n"];
}

- (void)applyCompletionStateWithMessage:(WLAgentSkillsStreamMessage *)message toMessageStore:(NSMutableDictionary *)messageStore {
    static NSSet<NSString *> *executingTypes;
    static NSSet<NSString *> *completedTypes;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        executingTypes = [NSSet setWithArray:@[
            @"step.start", @"text.delta", @"thinking.delta", @"tool.update", @"question", @"permission.ask", @"file"
        ]];
        completedTypes = [NSSet setWithArray:@[
            @"step.done", @"text.done", @"thinking.done"
        ]];
    });

    if ([executingTypes containsObject:message.type]) {
        messageStore[@"completed"] = @NO;
    }

    if ([completedTypes containsObject:message.type]) {
        messageStore[@"completed"] = @YES;
    }

    if ([message.type isEqualToString:@"permission.reply"] && [message.response isEqualToString:@"reject"]) {
        messageStore[@"completed"] = @YES;
    }
}

- (void)markLatestMessageForSession:(NSString *)sessionId completed:(BOOL)completed {
    NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionId];
    if (messages.count == 0) {
        return;
    }

    NSMutableDictionary *latest = nil;
    for (NSMutableDictionary *store in messages.allValues) {
        if (latest == nil) {
            latest = store;
            continue;
        }
        NSComparisonResult orderCompare = [self compareMessageStoreOrder:store other:latest];
        if (orderCompare == NSOrderedDescending) {
            latest = store;
            continue;
        }
        if (orderCompare == NSOrderedSame) {
            NSNumber *latestUpdated = latest[@"updatedAt"] ?: @0;
            NSNumber *currentUpdated = store[@"updatedAt"] ?: @0;
            if ([currentUpdated compare:latestUpdated] == NSOrderedDescending) {
                latest = store;
            }
        }
    }

    latest[@"completed"] = @(completed);
    latest[@"updatedAt"] = @([self currentTimestampMs]);
}

- (NSMutableDictionary *)normalizedPartDictionaryFromRawPart:(NSDictionary *)part {
    NSMutableDictionary *normalized = [NSMutableDictionary dictionary];
    NSString *partId = [part[@"partId"] isKindOfClass:[NSString class]] ? part[@"partId"] : @"";
    NSNumber *partSeq = [part[@"partSeq"] isKindOfClass:[NSNumber class]] ? part[@"partSeq"] : nil;
    if (partId.length == 0 && partSeq != nil) {
        partId = [NSString stringWithFormat:@"partseq_%@", partSeq];
    }
    if (partId.length == 0) {
        return normalized;
    }
    normalized[@"partId"] = partId;
    if (partSeq != nil) {
        normalized[@"partSeq"] = partSeq;
    }
    if ([part[@"type"] isKindOfClass:[NSString class]]) {
        normalized[@"type"] = part[@"type"];
    }
    if ([part[@"content"] isKindOfClass:[NSString class]]) {
        normalized[@"content"] = part[@"content"];
    }
    if ([part[@"toolName"] isKindOfClass:[NSString class]]) {
        normalized[@"toolName"] = part[@"toolName"];
    }
    if ([part[@"toolCallId"] isKindOfClass:[NSString class]]) {
        normalized[@"toolCallId"] = part[@"toolCallId"];
    }
    if ([part[@"status"] isKindOfClass:[NSString class]]) {
        normalized[@"status"] = part[@"status"];
    } else if ([part[@"toolStatus"] isKindOfClass:[NSString class]]) {
        normalized[@"status"] = part[@"toolStatus"];
    }
    if ([part[@"input"] isKindOfClass:[NSDictionary class]]) {
        normalized[@"input"] = part[@"input"];
    } else if ([part[@"toolInput"] isKindOfClass:[NSDictionary class]]) {
        normalized[@"input"] = part[@"toolInput"];
    }
    if ([part[@"output"] isKindOfClass:[NSString class]]) {
        normalized[@"output"] = part[@"output"];
    } else if ([part[@"toolOutput"] isKindOfClass:[NSString class]]) {
        normalized[@"output"] = part[@"toolOutput"];
    }
    if ([part[@"error"] isKindOfClass:[NSString class]]) {
        normalized[@"error"] = part[@"error"];
    }
    if ([part[@"title"] isKindOfClass:[NSString class]]) {
        normalized[@"title"] = part[@"title"];
    }
    if ([part[@"header"] isKindOfClass:[NSString class]]) {
        normalized[@"header"] = part[@"header"];
    }
    if ([part[@"question"] isKindOfClass:[NSString class]]) {
        normalized[@"question"] = part[@"question"];
    }
    if ([part[@"options"] isKindOfClass:[NSArray class]]) {
        normalized[@"options"] = part[@"options"];
    }
    if ([part[@"permissionId"] isKindOfClass:[NSString class]]) {
        normalized[@"permissionId"] = part[@"permissionId"];
    }
    if ([part[@"permType"] isKindOfClass:[NSString class]]) {
        normalized[@"permType"] = part[@"permType"];
    }
    if ([part[@"metadata"] isKindOfClass:[NSDictionary class]]) {
        normalized[@"metadata"] = part[@"metadata"];
    }
    if ([part[@"response"] isKindOfClass:[NSString class]]) {
        normalized[@"response"] = part[@"response"];
    }
    if ([part[@"fileName"] isKindOfClass:[NSString class]]) {
        normalized[@"fileName"] = part[@"fileName"];
    }
    if ([part[@"fileUrl"] isKindOfClass:[NSString class]]) {
        normalized[@"fileUrl"] = part[@"fileUrl"];
    }
    if ([part[@"fileMime"] isKindOfClass:[NSString class]]) {
        normalized[@"fileMime"] = part[@"fileMime"];
    }
    return normalized;
}

- (void)applySnapshot:(WLAgentSkillsStreamMessage *)message {
    NSArray<NSDictionary *> *snapshotMessages = [message.messages isKindOfClass:[NSArray class]] ? (NSArray *)message.messages : @[];
    NSString *sessionId = message.welinkSessionId;
    for (NSDictionary *snapshot in snapshotMessages) {
        NSString *messageId = [self normalizedMessageIdValue:snapshot[@"id"]];
        NSNumber *messageSeq = [snapshot[@"messageSeq"] isKindOfClass:[NSNumber class]] ? snapshot[@"messageSeq"] : nil;
        if (messageSeq == nil) {
            messageSeq = [snapshot[@"seq"] isKindOfClass:[NSNumber class]] ? snapshot[@"seq"] : @0;
        }
        NSString *role = [snapshot[@"role"] isKindOfClass:[NSString class]] ? snapshot[@"role"] : @"assistant";

        NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionId
                                                                                                                                    messageId:messageId
                                                                                                                                messageSeq:messageSeq
                                                                                                                                            role:role];
        if ([snapshot[@"seq"] isKindOfClass:[NSNumber class]]) {
            messageStore[@"seq"] = snapshot[@"seq"];
        } else {
            [messageStore removeObjectForKey:@"seq"];
        }
        messageStore[@"content"] = [snapshot[@"content"] isKindOfClass:[NSString class]] ? snapshot[@"content"] : @"";
        messageStore[@"completed"] = @YES;
        messageStore[@"updatedAt"] = @([self currentTimestampMs]);
        if ([snapshot[@"createdAt"] isKindOfClass:[NSString class]]) {
            messageStore[@"createdAt"] = snapshot[@"createdAt"];
        }
        if ([snapshot[@"contentType"] isKindOfClass:[NSString class]]) {
            messageStore[@"contentType"] = snapshot[@"contentType"];
        } else {
            [messageStore removeObjectForKey:@"contentType"];
        }

        NSMutableDictionary *partsStore = [NSMutableDictionary dictionary];
        NSArray *rawParts = [snapshot[@"parts"] isKindOfClass:[NSArray class]] ? snapshot[@"parts"] : @[];
        for (NSDictionary *part in rawParts) {
            if (![part isKindOfClass:[NSDictionary class]]) {
                continue;
            }
            NSMutableDictionary *normalized = [self normalizedPartDictionaryFromRawPart:part];
            NSString *partId = [self partIdentifierFromPartDictionary:normalized];
            if (partId.length == 0) {
                continue;
            }
            partsStore[partId] = normalized;
        }
        messageStore[@"parts"] = partsStore;

        NSString *content = [messageStore[@"content"] isKindOfClass:[NSString class]] ? messageStore[@"content"] : nil;
        if (content == nil || content.length == 0) {
            [self recomputeContentForMessageStore:messageStore];
        }
    }
}

- (void)applyStreaming:(WLAgentSkillsStreamMessage *)message {
    if ((message.messageId == nil || message.messageId.length == 0) && message.messageSeq == nil) {
        return;
    }

    NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:message.welinkSessionId
                                                                                                                                messageId:message.messageId
                                                                                                                            messageSeq:message.messageSeq
                                                                                                                                        role:message.role];
    NSMutableDictionary *partsStore = [messageStore[@"parts"] isKindOfClass:[NSMutableDictionary class]]
            ? [messageStore[@"parts"] mutableCopy]
            : [NSMutableDictionary dictionary];

    NSArray *rawParts = [message.parts isKindOfClass:[NSArray class]] ? (NSArray *)message.parts : @[];
    for (NSDictionary *part in rawParts) {
        if (![part isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        NSMutableDictionary *normalized = [self normalizedPartDictionaryFromRawPart:part];
        NSString *partId = [self partIdentifierFromPartDictionary:normalized];
        if (partId.length == 0) {
            continue;
        }
        NSMutableDictionary *existing = [partsStore[partId] isKindOfClass:[NSDictionary class]]
                ? [partsStore[partId] mutableCopy]
                : [NSMutableDictionary dictionary];
        [existing addEntriesFromDictionary:normalized];
        partsStore[partId] = existing;
    }

    messageStore[@"parts"] = partsStore;
    messageStore[@"completed"] = @([message.sessionStatus isEqualToString:@"idle"]);
    messageStore[@"updatedAt"] = @([self currentTimestampMs]);
    if (message.messageId != nil && message.messageId.length > 0) {
        messageStore[@"messageId"] = message.messageId;
    }
    [self recomputeContentForMessageStore:messageStore];
}

- (WLAgentSkillsSessionMessage *)messageModelFromStore:(NSDictionary *)store sessionKey:(NSString *)sessionKey {
    NSDictionary *partsStore = [store[@"parts"] isKindOfClass:[NSDictionary class]] ? store[@"parts"] : @{};
    NSMutableArray<NSDictionary *> *partValues = [NSMutableArray array];
    for (id value in partsStore.allValues) {
        if ([value isKindOfClass:[NSDictionary class]]) {
            [partValues addObject:value];
        }
    }
    NSArray<NSDictionary *> *parts = [partValues sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *lhs, NSDictionary *rhs) {
        NSNumber *left = lhs[@"partSeq"] ?: @0;
        NSNumber *right = rhs[@"partSeq"] ?: @0;
        NSComparisonResult seqCompare = [left compare:right];
        if (seqCompare != NSOrderedSame) {
            return seqCompare;
        }
        NSString *leftId = [lhs[@"partId"] isKindOfClass:[NSString class]] ? lhs[@"partId"] : @"";
        NSString *rightId = [rhs[@"partId"] isKindOfClass:[NSString class]] ? rhs[@"partId"] : @"";
        return [leftId compare:rightId];
    }];

    NSMutableDictionary *dictionary = [NSMutableDictionary dictionary];
    dictionary[@"id"] = [self normalizedMessageIdValue:store[@"messageId"]];
    dictionary[@"seq"] = store[@"seq"] ?: [NSNull null];
    dictionary[@"welinkSessionId"] = sessionKey;
    dictionary[@"role"] = store[@"role"] ?: @"assistant";
    dictionary[@"content"] = store[@"content"] ?: @"";
    dictionary[@"messageSeq"] = store[@"messageSeq"] ?: [NSNull null];
    dictionary[@"parts"] = parts;
    dictionary[@"createdAt"] = store[@"createdAt"] ?: @"";
    if ([store[@"contentType"] isKindOfClass:[NSString class]]) {
        dictionary[@"contentType"] = store[@"contentType"];
    }
    return [[WLAgentSkillsSessionMessage alloc] initWithDictionary:dictionary];
}

- (NSComparisonResult)compareMessageStoreOrder:(NSDictionary *)leftStore other:(NSDictionary *)rightStore {
    NSNumber *leftSeq = [leftStore[@"seq"] isKindOfClass:[NSNumber class]] ? leftStore[@"seq"] : nil;
    NSNumber *rightSeq = [rightStore[@"seq"] isKindOfClass:[NSNumber class]] ? rightStore[@"seq"] : nil;
    NSComparisonResult seqCompare = [self compareNullableNumber:leftSeq right:rightSeq];
    if (seqCompare != NSOrderedSame) {
        return seqCompare;
    }

    NSNumber *leftMessageSeq = [leftStore[@"messageSeq"] isKindOfClass:[NSNumber class]] ? leftStore[@"messageSeq"] : nil;
    NSNumber *rightMessageSeq = [rightStore[@"messageSeq"] isKindOfClass:[NSNumber class]] ? rightStore[@"messageSeq"] : nil;
    NSComparisonResult messageSeqCompare = [self compareNullableNumber:leftMessageSeq right:rightMessageSeq];
    if (messageSeqCompare != NSOrderedSame) {
        return messageSeqCompare;
    }

    NSString *leftId = [self normalizedMessageIdValue:leftStore[@"messageId"]];
    NSString *rightId = [self normalizedMessageIdValue:rightStore[@"messageId"]];
    return [leftId compare:rightId];
}

- (NSComparisonResult)compareNullableNumber:(nullable NSNumber *)left right:(nullable NSNumber *)right {
    if (left != nil && right != nil) {
        return [left compare:right];
    }
    if (left != nil) {
        return NSOrderedAscending;
    }
    if (right != nil) {
        return NSOrderedDescending;
    }
    return NSOrderedSame;
}

- (BOOL)containsMessage:(WLAgentSkillsSessionMessage *)candidate
                                                            inServerMessages:(NSArray<WLAgentSkillsSessionMessage *> *)serverMessages {
    for (WLAgentSkillsSessionMessage *item in serverMessages) {
        if ([self isSameMessage:candidate other:item]) {
            return YES;
        }
    }
    return NO;
}

- (BOOL)isSameMessage:(WLAgentSkillsSessionMessage *)left other:(WLAgentSkillsSessionMessage *)right {
    NSString *leftId = [self normalizedMessageIdValue:left.id];
    NSString *rightId = [self normalizedMessageIdValue:right.id];
    if (leftId.length > 0 && rightId.length > 0 && [leftId isEqualToString:rightId]) {
        return YES;
    }

    if (left.messageSeq != nil && right.messageSeq != nil) {
        return [left.messageSeq compare:right.messageSeq] == NSOrderedSame;
    }
    return NO;
}

- (long long)currentTimestampMs {
    return (long long)([[NSDate date] timeIntervalSince1970] * 1000);
}

@end
