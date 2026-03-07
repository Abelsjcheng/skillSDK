//
//  StreamingMessageCache.h
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import <Foundation/Foundation.h>
#import "SkillMessage.h"
#import "StreamMessage.h"

NS_ASSUME_NONNULL_BEGIN

@interface StreamingMessageCache : NSObject

+ (instancetype)sharedCache;

- (void)appendDeltaMessage:(StreamMessage *)message forSessionId:(NSString *)sessionId;
- (void)markStreamingCompleteForSessionId:(NSString *)sessionId;
- (void)clearCacheForSessionId:(NSString *)sessionId;
- (nullable SkillMessage *)getStreamingMessageForSessionId:(NSString *)sessionId;
- (BOOL)hasStreamingMessageForSessionId:(NSString *)sessionId;

@end

NS_ASSUME_NONNULL_END
