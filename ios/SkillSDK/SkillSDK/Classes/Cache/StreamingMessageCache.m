//
//  StreamingMessageCache.m
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import "StreamingMessageCache.h"

@interface StreamingMessageCacheItem : NSObject
@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) NSMutableString *content;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, assign) BOOL isStreaming;
@property (nonatomic, copy, nullable) NSDictionary *usage;
@end

@implementation StreamingMessageCacheItem
@end

@implementation StreamingMessageCache {
    NSMutableDictionary<NSString *, StreamingMessageCacheItem *> *_cache;
}

+ (instancetype)sharedCache {
    static StreamingMessageCache *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[StreamingMessageCache alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _cache = [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)appendDeltaMessage:(StreamMessage *)message forSessionId:(NSString *)sessionId {
    if (!sessionId) {
        return;
    }
    
    StreamingMessageCacheItem *item = _cache[sessionId];
    if (!item) {
        item = [[StreamingMessageCacheItem alloc] init];
        item.sessionId = sessionId;
        item.content = [NSMutableString string];
        item.isStreaming = YES;
        _cache[sessionId] = item;
    }
    
    if ([message.content isKindOfClass:[NSString class]]) {
        [item.content appendString:message.content];
    }
    
    item.seq = message.seq;
}

- (void)markStreamingCompleteForSessionId:(NSString *)sessionId {
    StreamingMessageCacheItem *item = _cache[sessionId];
    if (item) {
        item.isStreaming = NO;
    }
}

- (void)clearCacheForSessionId:(NSString *)sessionId {
    [_cache removeObjectForKey:sessionId];
}

- (nullable SkillMessage *)getStreamingMessageForSessionId:(NSString *)sessionId {
    StreamingMessageCacheItem *item = _cache[sessionId];
    if (!item || !item.isStreaming) {
        return nil;
    }
    
    SkillMessage *message = [[SkillMessage alloc] init];
    message.messageId = -1;
    message.sessionId = [sessionId integerValue];
    message.seq = item.seq;
    message.role = MessageRoleAssistant;
    message.content = [item.content copy];
    message.contentType = ContentTypeMarkdown;
    message.createdAt = [self currentISOString];
    message.meta = [NSString stringWithFormat:@"{\"isStreaming\":%@}", item.isStreaming ? @"true" : @"false"];
    
    return message;
}

- (BOOL)hasStreamingMessageForSessionId:(NSString *)sessionId {
    StreamingMessageCacheItem *item = _cache[sessionId];
    return item != nil && item.isStreaming;
}

- (NSString *)currentISOString {
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss.SSSZ";
    formatter.timeZone = [NSTimeZone timeZoneWithAbbreviation:@"UTC"];
    return [formatter stringFromDate:[NSDate date]];
}

@end
