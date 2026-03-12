//
//  WLAgentSkillsStreamingCache.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsStreamingCache : NSObject

+ (instancetype)sharedCache;

- (void)updateWithStreamMessage:(WLAgentSkillsStreamMessage *)message;
- (void)cacheSendMessageResult:(WLAgentSkillsSendMessageResult *)result;
- (void)cacheHistoryMessages:(NSArray<WLAgentSkillsSessionMessage *> *)messages
                                                            forSessionId:(NSNumber *)welinkSessionId;

- (NSArray<WLAgentSkillsSessionMessage *> *)mergedMessagesWithServerMessages:(NSArray<WLAgentSkillsSessionMessage *> *)serverMessages
                                                                                                                                                                                                                                                                    sessionId:(NSNumber *)welinkSessionId;

- (nullable NSString *)latestCompletedContentForSessionId:(NSNumber *)welinkSessionId
                                                                                                                                                                                                        messageId:(nullable NSString *)messageId;

- (nullable NSString *)lastUserMessageContentForSessionId:(NSNumber *)welinkSessionId;

- (void)clearCacheForSessionId:(NSNumber *)welinkSessionId;
- (void)clearAllCache;

@end

NS_ASSUME_NONNULL_END
