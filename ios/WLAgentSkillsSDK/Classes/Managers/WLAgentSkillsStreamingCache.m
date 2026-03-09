//
//  WLAgentSkillsStreamingCache.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsStreamingCache.h"

@interface WLAgentSkillsStreamingCache ()

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary<NSString *, NSMutableDictionary *> *> *messagesBySession;

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
  }
  return self;
}

- (void)updateWithStreamMessage:(WLAgentSkillsStreamMessage *)message {
  if (message.welinkSessionId.length == 0) {
    return;
  }

  @synchronized(self) {
    if ([message.type isEqualToString:@"snapshot"]) {
      [self applySnapshot:message];
      return;
    }

    if ([message.type isEqualToString:@"streaming"]) {
      [self applyStreaming:message];
      return;
    }

    if ([message.type isEqualToString:@"session.status"] && message.messageId.length == 0) {
      [self markLatestMessageForSession:message.welinkSessionId
                              completed:[message.sessionStatus isEqualToString:@"idle"]];
      return;
    }

    if (message.messageId.length == 0) {
      return;
    }

    NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:message.welinkSessionId
                                                                 messageId:message.messageId
                                                                messageSeq:message.messageSeq
                                                                      role:message.role];

    NSMutableDictionary *partsStore = messageStore[@"parts"];
    NSString *partId = message.partId.length > 0 ? message.partId : [NSString stringWithFormat:@"meta_%@", message.type ?: @"unknown"];
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

    [self applyMessage:message toPartStore:partStore];
    [self recomputeContentForMessageStore:messageStore];
    [self applyCompletionStateWithMessage:message toMessageStore:messageStore];
  }
}

- (void)cacheSendMessageResult:(WLAgentSkillsSendMessageResult *)result {
  if (result.welinkSessionId == nil || result.messageId == nil) {
    return;
  }

  NSString *sessionKey = result.welinkSessionId.stringValue;
  NSString *messageKey = result.messageId.stringValue;
  @synchronized(self) {
    NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                 messageId:messageKey
                                                                messageSeq:result.messageSeq
                                                                      role:result.role];
    messageStore[@"welinkSessionId"] = result.welinkSessionId;
    messageStore[@"userId"] = result.userId ?: @"";
    messageStore[@"content"] = result.content ?: @"";
    messageStore[@"createdAt"] = result.createdAt ?: @"";
    messageStore[@"completed"] = @YES;
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
      NSString *messageKey = message.messageId.stringValue;
      NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:sessionKey
                                                                   messageId:messageKey
                                                                  messageSeq:message.messageSeq
                                                                        role:message.role];
      messageStore[@"welinkSessionId"] = welinkSessionId;
      messageStore[@"userId"] = message.userId ?: @"";
      messageStore[@"content"] = message.content ?: @"";
      messageStore[@"createdAt"] = message.createdAt ?: @"";
      messageStore[@"completed"] = @YES;

      NSMutableDictionary *parts = [NSMutableDictionary dictionary];
      for (WLAgentSkillsSessionMessagePart *part in message.parts) {
        NSString *partId = part.partId.length > 0 ? part.partId : [NSString stringWithFormat:@"p_%@", part.partSeq ?: @0];
        parts[partId] = [[part toDictionary] mutableCopy];
      }
      messageStore[@"parts"] = parts;
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
      return [leftSeq compare:rightSeq];
    }];

    for (NSDictionary *store in sortedStores) {
      [result addObject:[self messageModelFromStore:store sessionKey:sessionKey]];
    }
  }

  return result;
}

- (nullable NSString *)latestCompletedContentForSessionId:(NSNumber *)welinkSessionId
                                                 messageId:(nullable NSNumber *)messageId {
  if (welinkSessionId == nil) {
    return nil;
  }

  NSString *sessionKey = welinkSessionId.stringValue;
  @synchronized(self) {
    NSDictionary<NSString *, NSMutableDictionary *> *messages = self.messagesBySession[sessionKey];
    if (messages.count == 0) {
      return nil;
    }

    if (messageId != nil) {
      NSDictionary *store = messages[messageId.stringValue];
      if (store == nil || ![store[@"completed"] boolValue]) {
        return nil;
      }
      NSString *content = store[@"content"];
      return content.length > 0 ? content : nil;
    }

    NSArray<NSMutableDictionary *> *sortedStores = [messages.allValues sortedArrayUsingComparator:^NSComparisonResult(NSMutableDictionary *lhs, NSMutableDictionary *rhs) {
      return [lhs[@"messageSeq"] compare:rhs[@"messageSeq"]];
    }];

    for (NSMutableDictionary *store in [sortedStores reverseObjectEnumerator]) {
      if (![store[@"completed"] boolValue]) {
        continue;
      }
      NSString *content = store[@"content"];
      if (content.length == 0) {
        continue;
      }
      return content;
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
      return [lhs[@"messageSeq"] compare:rhs[@"messageSeq"]];
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

  @synchronized(self) {
    [self.messagesBySession removeObjectForKey:welinkSessionId.stringValue];
  }
}

- (void)clearAllCache {
  @synchronized(self) {
    [self.messagesBySession removeAllObjects];
  }
}

#pragma mark - Internal

- (NSMutableDictionary<NSString *, NSMutableDictionary *> *)ensureSessionMessages:(NSString *)sessionId {
  NSMutableDictionary<NSString *, NSMutableDictionary *> *sessionMessages = self.messagesBySession[sessionId];
  if (sessionMessages == nil) {
    sessionMessages = [NSMutableDictionary dictionary];
    self.messagesBySession[sessionId] = sessionMessages;
  }
  return sessionMessages;
}

- (NSMutableDictionary *)ensureMessageStoreForSession:(NSString *)sessionId
                                            messageId:(NSString *)messageId
                                           messageSeq:(nullable NSNumber *)messageSeq
                                                 role:(nullable NSString *)role {
  NSMutableDictionary<NSString *, NSMutableDictionary *> *sessionMessages = [self ensureSessionMessages:sessionId];
  NSMutableDictionary *messageStore = sessionMessages[messageId];
  if (messageStore == nil) {
    messageStore = [@{
      @"messageId" : messageId,
      @"messageSeq" : messageSeq ?: @0,
      @"role" : role ?: @"assistant",
      @"parts" : [NSMutableDictionary dictionary],
      @"content" : @"",
      @"completed" : @NO,
      @"createdAt" : @""
    } mutableCopy];
    sessionMessages[messageId] = messageStore;
  }

  if (messageSeq != nil && [messageSeq compare:messageStore[@"messageSeq"]] == NSOrderedDescending) {
    messageStore[@"messageSeq"] = messageSeq;
  }
  if (role.length > 0) {
    messageStore[@"role"] = role;
  }

  return messageStore;
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
    if (message.response.length > 0) {
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
    return [left compare:right];
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
      @"step.done", @"text.done", @"thinking.done", @"session.error", @"error", @"agent.offline"
    ]];
  });

  if ([executingTypes containsObject:message.type]) {
    messageStore[@"completed"] = @NO;
  }

  if ([completedTypes containsObject:message.type]) {
    messageStore[@"completed"] = @YES;
  }

  if ([message.type isEqualToString:@"session.status"]) {
    if ([message.sessionStatus isEqualToString:@"idle"]) {
      messageStore[@"completed"] = @YES;
    }
    if ([message.sessionStatus isEqualToString:@"busy"] || [message.sessionStatus isEqualToString:@"retry"]) {
      messageStore[@"completed"] = @NO;
    }
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
    if (latest == nil || [store[@"messageSeq"] compare:latest[@"messageSeq"]] == NSOrderedDescending) {
      latest = store;
    }
  }

  latest[@"completed"] = @(completed);
}

- (void)applySnapshot:(WLAgentSkillsStreamMessage *)message {
  NSArray<NSDictionary *> *snapshotMessages = [message.messages isKindOfClass:[NSArray class]] ? (NSArray *)message.messages : @[];
  for (NSDictionary *snapshot in snapshotMessages) {
    NSString *messageId = [snapshot[@"id"] respondsToSelector:@selector(stringValue)] ? [snapshot[@"id"] stringValue] : @"";
    if (messageId.length == 0) {
      continue;
    }

    NSNumber *messageSeq = [snapshot[@"seq"] isKindOfClass:[NSNumber class]] ? snapshot[@"seq"] : @0;
    NSString *role = [snapshot[@"role"] isKindOfClass:[NSString class]] ? snapshot[@"role"] : @"assistant";

    NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:message.welinkSessionId
                                                                 messageId:messageId
                                                                messageSeq:messageSeq
                                                                      role:role];
    messageStore[@"content"] = [snapshot[@"content"] isKindOfClass:[NSString class]] ? snapshot[@"content"] : @"";
    messageStore[@"completed"] = @YES;
    if ([snapshot[@"createdAt"] isKindOfClass:[NSString class]]) {
      messageStore[@"createdAt"] = snapshot[@"createdAt"];
    }

    NSMutableDictionary *partsStore = [NSMutableDictionary dictionary];
    for (NSDictionary *part in [snapshot[@"parts"] isKindOfClass:[NSArray class]] ? snapshot[@"parts"] : @[]) {
      NSString *partId = [part[@"partId"] isKindOfClass:[NSString class]] ? part[@"partId"] : nil;
      if (partId.length == 0) {
        continue;
      }
      partsStore[partId] = [part mutableCopy];
    }
    messageStore[@"parts"] = partsStore;
  }
}

- (void)applyStreaming:(WLAgentSkillsStreamMessage *)message {
  if (message.messageId.length == 0) {
    return;
  }

  NSMutableDictionary *messageStore = [self ensureMessageStoreForSession:message.welinkSessionId
                                                               messageId:message.messageId
                                                              messageSeq:message.messageSeq
                                                                    role:message.role];
  NSMutableDictionary *partsStore = [NSMutableDictionary dictionary];
  for (NSDictionary *part in [message.parts isKindOfClass:[NSArray class]] ? (NSArray *)message.parts : @[]) {
    NSString *partId = [part[@"partId"] isKindOfClass:[NSString class]] ? part[@"partId"] : nil;
    if (partId.length == 0) {
      continue;
    }
    partsStore[partId] = [part mutableCopy];
  }

  messageStore[@"parts"] = partsStore;
  messageStore[@"completed"] = @([message.sessionStatus isEqualToString:@"idle"]);
  [self recomputeContentForMessageStore:messageStore];
}

- (WLAgentSkillsSessionMessage *)messageModelFromStore:(NSDictionary *)store sessionKey:(NSString *)sessionKey {
  NSArray<NSDictionary *> *parts = [((NSDictionary *)store[@"parts"]).allValues sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *lhs, NSDictionary *rhs) {
    NSNumber *left = lhs[@"partSeq"] ?: @0;
    NSNumber *right = rhs[@"partSeq"] ?: @0;
    return [left compare:right];
  }];

  NSMutableDictionary *dictionary = [NSMutableDictionary dictionary];
  dictionary[@"id"] = [self numericMessageIdFromKey:store[@"messageId"]];
  dictionary[@"welinkSessionId"] = @([sessionKey longLongValue]);
  dictionary[@"userId"] = store[@"userId"] ?: [NSNull null];
  dictionary[@"role"] = store[@"role"] ?: @"assistant";
  dictionary[@"content"] = store[@"content"] ?: @"";
  dictionary[@"messageSeq"] = store[@"messageSeq"] ?: @0;
  dictionary[@"parts"] = parts;
  dictionary[@"createdAt"] = store[@"createdAt"] ?: @"";

  return [[WLAgentSkillsSessionMessage alloc] initWithDictionary:dictionary];
}

- (NSNumber *)numericMessageIdFromKey:(NSString *)messageKey {
  if (messageKey.length == 0) {
    return @0;
  }

  NSScanner *scanner = [NSScanner scannerWithString:messageKey];
  long long value = 0;
  BOOL isNumeric = [scanner scanLongLong:&value] && scanner.isAtEnd;
  if (isNumeric) {
    return @(value);
  }

  return @(-labs((long)messageKey.hash));
}

@end
