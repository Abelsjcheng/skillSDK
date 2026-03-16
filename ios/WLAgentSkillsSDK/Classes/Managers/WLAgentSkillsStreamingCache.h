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
                                                            forSessionId:(NSString *)welinkSessionId;

- (nullable WLAgentSkillsSessionMessage *)latestLocalMessageNotInServerMessages:(NSArray<WLAgentSkillsSessionMessage *> *)serverMessages
                                                                                                                                                                                                                                                                    sessionId:(NSString *)welinkSessionId;

- (nullable NSString *)latestCompletedContentForSessionId:(NSString *)welinkSessionId
                                                                                                                                                                                                        messageId:(nullable NSString *)messageId;
- (BOOL)hasMessageForSessionId:(NSString *)welinkSessionId messageId:(NSString *)messageId;
- (BOOL)isMessageCompletedForSessionId:(NSString *)welinkSessionId messageId:(NSString *)messageId;

- (nullable NSString *)lastUserMessageContentForSessionId:(NSString *)welinkSessionId;

- (void)clearCacheForSessionId:(NSString *)welinkSessionId;
- (void)clearAllCache;

@end

NS_ASSUME_NONNULL_END
