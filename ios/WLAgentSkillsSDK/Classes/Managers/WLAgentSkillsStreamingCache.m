//
//  WLAgentSkillsStreamingCache.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsStreamingCache.h"

@interface WLAgentSkillsStreamingCache ()

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary<NSString *, NSMutableDictionary *> *> *messagesBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary<NSString *, NSString *> *> *messageIdIndexBySession;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *nextSyntheticIdBySession;

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
        }
        return self;
}

- (void)updateWithStreamMessage:(WLAgentSkillsStreamMessage *)message {
        if (message.welinkSessionId.length == 0) {
                return;
        }

        NSString *sessionKey = message.welinkSessionId;
        @synchronized(self) {
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

                if (message.messageId.length == 0 && message.messageSeq == nil) {
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
        }
}

- (void)cacheSendMessageResult:(WLAgentSkillsSendMessageResult *)result {
        if (result.welinkSessionId == nil || result.id == nil) {
                return;
        }

        NSString *sessionKey = result.welinkSessionId.stringValue;
        NSString *messageId = result.id.stringValue;
        @synchronized(self) {
                NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                                                                                                                                                                                                                    messageId:messageId
                                                                                                                                                                                                                                                                messageSeq:result.messageSeq
                                                                                                                                                                                                                                                                                        role:result.role];
                messageStore[@"welinkSessionId"] = result.welinkSessionId;
                messageStore[@"userId"] = result.userId ?: @"";
                messageStore[@"content"] = result.content ?: @"";
                messageStore[@"createdAt"] = result.createdAt ?: @"";
                messageStore[@"completed"] = @YES;
                messageStore[@"updatedAt"] = @([self currentTimestampMs]);
        }
}

- (void)cacheHistoryMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages
                                                            forSessionId:(NSNumber *)welinkSessionId {
        if (welinkSessionId == nil) {
                return;
        }

        NSString *sessionKey = welinkSessionId.stringValue;
        @synchronized(self) {
                for (WLAgentSkillsSessionMessage *message in messages) {
                        NSString *messageId = [self normalizedMessageIdValue:message.id];
                        NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                                                                                                                                                                                                                            messageId:messageId
                                                                                                                                                                                                                                                                        messageSeq:message.messageSeq
                                                                                                                                                                                                                                                                                                role:message.role];
                        messageStore[@"welinkSessionId"] = welinkSessionId;
                        messageStore[@"userId"] = message.userId ?: @"";
                        messageStore[@"content"] = message.content ?: @"";
                        messageStore[@"createdAt"] = message.createdAt ?: @"";
                        messageStore[@"completed"] = @YES;
                        if (message.contentType.length > 0) {
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
        }
}

- (NSArray<WLAgentSkillsSessionMessage *> *)mergedMessagesWithServerMessages:(NSArray<WLAgentSkillsSessionMessage *> *)serverMessages
                                                                                                                                                                                                                                                                    sessionId:(NSNumber *)welinkSessionId {
        if (welinkSessionId == nil) {
                return @[];
        }

        [self cacheHistoryMessages:serverMessages forSessionId:welinkSessionId];

        NSString *sessionKey = welinkSessionId.stringValue;
        NSMutableArray<WLAgentSkillsSessionMessage *> *result = [NSMutableArray array];
        @synchronized(self) {
                NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey] ?: @{};
                NSArray<NSMutableDictionary *> *sortedStores = [messages.allValues sortedArrayUsingComparator:^NSComparisonResult(NSMutableDictionary *lhs, NSMutableDictionary *rhs) {
                        NSNumber *leftSeq = lhs[@"messageSeq"] ?: @0;
                        NSNumber *rightSeq = rhs[@"messageSeq"] ?: @0;
                        NSComparisonResult seqCompare = [leftSeq compare:rightSeq];
                        if (seqCompare != NSOrderedSame) {
                                return seqCompare;
                        }
                        NSNumber *leftUpdated = lhs[@"updatedAt"] ?: @0;
                        NSNumber *rightUpdated = rhs[@"updatedAt"] ?: @0;
                        return [leftUpdated compare:rightUpdated];
                }];

                for (NSDictionary *store in sortedStores) {
                        [result addObject:[self messageModelFromStore:store sessionKey:sessionKey]];
                }
        }
        return result;
}

- (nullable NSString *)latestCompletedContentForSessionId:(NSNumber *)welinkSessionId
                                                                                                                                                                                                        messageId:(nullable NSString *)messageId {
        if (welinkSessionId == nil) {
                return nil;
        }

        NSString *sessionKey = welinkSessionId.stringValue;
        @synchronized(self) {
                NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey];
                if (messages.count == 0) {
                        return nil;
                }

                if (messageId.length > 0) {
                        NSString *messageKey = [self resolveMessageKeyForSession:sessionKey messageId:messageId messageSeq:nil createIfMissing:NO];
                        if (messageKey.length == 0) {
                                messageKey = messageId;
                        }
                        NSDictionary *store = messages[messageKey];
                        if (store == nil || ![store[@"completed"] boolValue]) {
                                return nil;
                        }
                        NSString *content = store[@"content"];
                        return content.length > 0 ? content : nil;
                }

                NSArray<NSMutableDictionary *> *sortedStores = [messages.allValues sortedArrayUsingComparator:^NSComparisonResult(NSMutableDictionary *lhs, NSMutableDictionary *rhs) {
                        NSNumber *leftSeq = lhs[@"messageSeq"] ?: @0;
                        NSNumber *rightSeq = rhs[@"messageSeq"] ?: @0;
                        NSComparisonResult seqCompare = [leftSeq compare:rightSeq];
                        if (seqCompare != NSOrderedSame) {
                                return seqCompare;
                        }
                        NSNumber *leftUpdated = lhs[@"updatedAt"] ?: @0;
                        NSNumber *rightUpdated = rhs[@"updatedAt"] ?: @0;
                        return [leftUpdated compare:rightUpdated];
                }];

                for (NSMutableDictionary *store in [sortedStores reverseObjectEnumerator]) {
                        if (![store[@"completed"] boolValue]) {
                                continue;
                        }
                        NSString *content = store[@"content"];
                        if (content.length > 0) {
                                return content;
                        }
                }
        }
        return nil;
}

- (nullable NSString *)lastUserMessageContentForSessionId:(NSNumber *)welinkSessionId {
        if (welinkSessionId == nil) {
                return nil;
        }

        NSString *sessionKey = welinkSessionId.stringValue;
        @synchronized(self) {
                NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey];
                if (messages.count == 0) {
                        return nil;
                }

                NSArray<NSMutableDictionary *> *sortedStores = [messages.allValues sortedArrayUsingComparator:^NSComparisonResult(NSMutableDictionary *lhs, NSMutableDictionary *rhs) {
                        NSNumber *leftSeq = lhs[@"messageSeq"] ?: @0;
                        NSNumber *rightSeq = rhs[@"messageSeq"] ?: @0;
                        return [leftSeq compare:rightSeq];
                }];

                for (NSMutableDictionary *store in [sortedStores reverseObjectEnumerator]) {
                        NSString *role = store[@"role"];
                        if (![role.lowercaseString isEqualToString:@"user"]) {
                                continue;
                        }
                        NSString *content = store[@"content"];
                        if (content.length > 0) {
                                return content;
                        }
                }
        }
        return nil;
}

- (void)clearCacheForSessionId:(NSNumber *)welinkSessionId {
        if (welinkSessionId == nil) {
                return;
        }
        NSString *sessionKey = welinkSessionId.stringValue;
        @synchronized(self) {
                [self.messagesBySession removeObjectForKey:sessionKey];
                [self.messageIdIndexBySession removeObjectForKey:sessionKey];
                [self.nextSyntheticIdBySession removeObjectForKey:sessionKey];
        }
}

- (void)clearAllCache {
        @synchronized(self) {
                [self.messagesBySession removeAllObjects];
                [self.messageIdIndexBySession removeAllObjects];
                [self.nextSyntheticIdBySession removeAllObjects];
        }
}

#pragma mark - Internal

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
        if (messageId.length > 0) {
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

        if (messageId.length > 0) {
                NSString *existing = sessionIndex[messageId];
                if (existing.length > 0) {
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
                if (existing.length > 0) {
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
                        @"messageId" : messageId.length > 0 ? messageId : messageKey,
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
        if (role.length > 0) {
                messageStore[@"role"] = role;
        }
        if (messageId.length > 0) {
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
                if (message.toolCallId.length > 0) {
                        partStore[@"toolCallId"] = message.toolCallId;
                }
                if (message.status.length > 0) {
                        partStore[@"toolStatus"] = message.status;
                }
                if (message.input.count > 0) {
                        partStore[@"toolInput"] = message.input;
                }
                if (message.output.length > 0) {
                        partStore[@"toolOutput"] = message.output;
                }
                if (message.error.length > 0) {
                        partStore[@"toolOutput"] = message.error;
                }
                return;
        }

        if ([message.type isEqualToString:@"question"]) {
                partStore[@"toolName"] = message.toolName ?: @"question";
                if (message.toolCallId.length > 0) {
                        partStore[@"toolCallId"] = message.toolCallId;
                }
                if (message.status.length > 0) {
                        partStore[@"toolStatus"] = message.status;
                }
                if (message.header.length > 0) {
                        partStore[@"header"] = message.header;
                }
                if (message.question.length > 0) {
                        partStore[@"question"] = message.question;
                        partStore[@"content"] = message.question;
                }
                if (message.options.count > 0) {
                        partStore[@"options"] = message.options;
                }
                return;
        }

        if ([message.type isEqualToString:@"file"]) {
                if (message.fileName.length > 0) {
                        partStore[@"fileName"] = message.fileName;
                }
                if (message.fileUrl.length > 0) {
                        partStore[@"fileUrl"] = message.fileUrl;
                        partStore[@"content"] = message.fileUrl;
                }
                if (message.fileMime.length > 0) {
                        partStore[@"fileMime"] = message.fileMime;
                }
                return;
        }

        if ([message.type isEqualToString:@"permission.ask"] || [message.type isEqualToString:@"permission.reply"]) {
                if (message.permissionId.length > 0) {
                        partStore[@"permissionId"] = message.permissionId;
                }
                if (message.permType.length > 0) {
                        partStore[@"toolName"] = message.permType;
                }
                if (message.title.length > 0) {
                        partStore[@"content"] = message.title;
                }
                if ([message.type isEqualToString:@"permission.reply"] && message.response.length > 0) {
                        partStore[@"content"] = message.response;
                }
                return;
        }

        if (message.content.length > 0) {
                partStore[@"content"] = message.content;
        }
}

- (NSString *)partTypeFromMessageType:(NSString *)messageType explicitType:(nullable NSString *)explicitType {
        if (explicitType.length > 0) {
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
        NSDictionary<NSString *, NSDictionary *> *partsStore = messageStore[@"parts"];
        NSArray<NSDictionary *> *parts = [partsStore.allValues sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *lhs, NSDictionary *rhs) {
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
                NSString *content = part[@"content"];
                if (content.length == 0) {
                        content = part[@"toolOutput"];
                }
                if (content.length > 0) {
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
                NSNumber *latestSeq = latest[@"messageSeq"] ?: @0;
                NSNumber *currentSeq = store[@"messageSeq"] ?: @0;
                NSComparisonResult seqCompare = [currentSeq compare:latestSeq];
                if (seqCompare == NSOrderedDescending) {
                        latest = store;
                        continue;
                }
                if (seqCompare == NSOrderedSame) {
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
        if ([part[@"toolStatus"] isKindOfClass:[NSString class]]) {
                normalized[@"toolStatus"] = part[@"toolStatus"];
        } else if ([part[@"status"] isKindOfClass:[NSString class]]) {
                normalized[@"toolStatus"] = part[@"status"];
        }
        if ([part[@"toolInput"] isKindOfClass:[NSDictionary class]]) {
                normalized[@"toolInput"] = part[@"toolInput"];
        } else if ([part[@"input"] isKindOfClass:[NSDictionary class]]) {
                normalized[@"toolInput"] = part[@"input"];
        }
        if ([part[@"toolOutput"] isKindOfClass:[NSString class]]) {
                normalized[@"toolOutput"] = part[@"toolOutput"];
        } else if ([part[@"output"] isKindOfClass:[NSString class]]) {
                normalized[@"toolOutput"] = part[@"output"];
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
                NSNumber *messageSeq = [snapshot[@"seq"] isKindOfClass:[NSNumber class]] ? snapshot[@"seq"] : @0;
                NSString *role = [snapshot[@"role"] isKindOfClass:[NSString class]] ? snapshot[@"role"] : @"assistant";

                NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionId
                                                                                                                                                                                                                                                                    messageId:messageId
                                                                                                                                                                                                                                                                messageSeq:messageSeq
                                                                                                                                                                                                                                                                                        role:role];
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

                NSString *content = messageStore[@"content"];
                if (content.length == 0) {
                        [self recomputeContentForMessageStore:messageStore];
                }
        }
}

- (void)applyStreaming:(WLAgentSkillsStreamMessage *)message {
        if (message.messageId.length == 0 && message.messageSeq == nil) {
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
        if (message.messageId.length > 0) {
                messageStore[@"messageId"] = message.messageId;
        }
        [self recomputeContentForMessageStore:messageStore];
}

- (WLAgentSkillsSessionMessage *)messageModelFromStore:(NSDictionary *)store sessionKey:(NSString *)sessionKey {
        NSArray<NSDictionary *> *parts = [((NSDictionary *)store[@"parts"]).allValues sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *lhs, NSDictionary *rhs) {
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
        dictionary[@"welinkSessionId"] = @([sessionKey longLongValue]);
        dictionary[@"userId"] = store[@"userId"] ?: [NSNull null];
        dictionary[@"role"] = store[@"role"] ?: @"assistant";
        dictionary[@"content"] = store[@"content"] ?: @"";
        dictionary[@"messageSeq"] = store[@"messageSeq"] ?: @0;
        dictionary[@"parts"] = parts;
        dictionary[@"createdAt"] = store[@"createdAt"] ?: @"";
        if ([store[@"contentType"] isKindOfClass:[NSString class]]) {
                dictionary[@"contentType"] = store[@"contentType"];
        }
        return [[WLAgentSkillsSessionMessage alloc] initWithDictionary:dictionary];
}

- (long long)currentTimestampMs {
        return (long long)([[NSDate date] timeIntervalSince1970] * 1000);
}

@end
