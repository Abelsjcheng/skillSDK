//
//  WLAgentSkillsStreamingCache.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsStreamingCache.h"

@interface WLAgentSkillsStreamingCache ()

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableString *> *contentCache;
@property (nonatomic, strong) NSMutableSet<NSString *> *streamingSessions;

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
        _contentCache = [NSMutableDictionary dictionary];
        _streamingSessions = [NSMutableSet set];
    }
    return self;
}

- (void)cacheMessage:(WLAgentSkillsStreamMessage *)message forSessionId:(NSString *)sessionId {
    if (!sessionId || !message) {
        return;
    }
    
    switch (message.type) {
        case WLAgentSkillsStreamMessageTypeDelta: {
            NSMutableString *cachedContent = self.contentCache[sessionId];
            if (!cachedContent) {
                cachedContent = [NSMutableString string];
                self.contentCache[sessionId] = cachedContent;
            }
            [cachedContent appendString:message.content];
            [self.streamingSessions addObject:sessionId];
            break;
        }
        case WLAgentSkillsStreamMessageTypeDone:
        case WLAgentSkillsStreamMessageTypeError:
        case WLAgentSkillsStreamMessageTypeAgentOffline:
        case WLAgentSkillsStreamMessageTypeAgentOnline:
            [self.streamingSessions removeObject:sessionId];
            break;
    }
}

- (NSString *)getCachedContentForSessionId:(NSString *)sessionId {
    return self.contentCache[sessionId];
}

- (BOOL)isStreamingForSessionId:(NSString *)sessionId {
    return [self.streamingSessions containsObject:sessionId];
}

- (void)clearCacheForSessionId:(NSString *)sessionId {
    [self.contentCache removeObjectForKey:sessionId];
    [self.streamingSessions removeObject:sessionId];
}

- (void)clearAllCache {
    [self.contentCache removeAllObjects];
    [self.streamingSessions removeAllObjects];
}

@end