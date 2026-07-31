#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsUnReadManager : NSObject
+ (instancetype)sharedManager;
- (void)initUnReadState;
- (BOOL)isAgentTabNotifyEnabled;
- (void)getWeAgentUnreadMessage:(WLAgentSkillsGetWeAgentUnreadMessageParams *)params
                         success:(void (^)(WLAgentSkillsGetWeAgentUnreadMessageResult *result))success
                         failure:(void (^)(NSError *error))failure;
- (void)reportWeAgentSessionRead:(WLAgentSkillsReportWeAgentSessionReadParams *)params
                          success:(void (^)(void))success
                          failure:(void (^)(NSError *error))failure;
- (void)onSessionViewing:(WLAgentSkillsOnSessionViewingParams *)params;
- (void)onSessionViewingEnd:(WLAgentSkillsOnSessionViewingEndParams *)params;
- (void)onSessionDeleted:(nullable NSString *)sessionId;
- (void)onAssistantChanged:(nullable WLAgentSkillsWeAgentDetails *)assistantDetail;
- (void)onNetworkReconnected;
- (BOOL)handleImUnreadNotifyData:(NSDictionary *)notifyData;
- (BOOL)handleEmployeeAssistantImUnreadNotifyData:(NSDictionary *)notifyData;
- (BOOL)handleCuiImUnreadNotifyData:(NSDictionary *)notifyData;
@end

NS_ASSUME_NONNULL_END
