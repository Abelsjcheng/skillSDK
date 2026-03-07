//
//  WLAgentSkillsStreamingCache.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsStreamingCache : NSObject

+ (instancetype)sharedCache;

- (void)cacheMessage:(WLAgentSkillsStreamMessage *)message forSessionId:(NSString *)sessionId;
- (NSString *)getCachedContentForSessionId:(NSString *)sessionId;
- (BOOL)isStreamingForSessionId:(NSString *)sessionId;
- (void)clearCacheForSessionId:(NSString *)sessionId;
- (void)clearAllCache;

@end

NS_ASSUME_NONNULL_END