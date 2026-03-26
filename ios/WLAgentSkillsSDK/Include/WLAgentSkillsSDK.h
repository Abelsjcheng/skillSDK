//
//  WLAgentSkillsSDK.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsSDK : NSObject

+ (instancetype)sharedInstance;

+ (void)configureWithBaseURL:(NSString *)baseURL;
+ (void)configureWithBaseURL:(NSString *)baseURL webSocketURL:(nullable NSString *)webSocketURL;

#pragma mark - 1. createSession
- (void)createSession:(WLAgentSkillsCreateSessionParams *)params
                            success:(void (^)(WLAgentSkillsSkillSession *session))success
                            failure:(void (^)(NSError *error))failure;

#pragma mark - 2. closeSkill (local WebSocket only)
- (void)closeSkillWithSuccess:(void (^)(WLAgentSkillsCloseSkillResult *result))success
                                            failure:(void (^)(NSError *error))failure;

#pragma mark - 3. stopSkill
- (void)stopSkill:(WLAgentSkillsStopSkillParams *)params
                    success:(void (^)(WLAgentSkillsStopSkillResult *result))success
                    failure:(void (^)(NSError *error))failure;

#pragma mark - 4. onSessionStatusChange
- (void)onSessionStatusChange:(WLAgentSkillsOnSessionStatusChangeParams *)params;

#pragma mark - 5. onSkillWecodeStatusChange
- (void)onSkillWecodeStatusChange:(WLAgentSkillsOnSkillWecodeStatusChangeParams *)params;

#pragma mark - 6. regenerateAnswer
- (void)regenerateAnswer:(WLAgentSkillsRegenerateAnswerParams *)params
                                    success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                                    failure:(void (^)(NSError *error))failure;

#pragma mark - 7. sendMessageToIM
- (void)sendMessageToIM:(WLAgentSkillsSendMessageToIMParams *)params
                                success:(void (^)(WLAgentSkillsSendMessageToIMResult *result))success
                                failure:(void (^)(NSError *error))failure;

#pragma mark - 8. getSessionMessage
- (void)getSessionMessage:(WLAgentSkillsGetSessionMessageParams *)params
                                    success:(void (^)(WLAgentSkillsPageResult *result))success
                                    failure:(void (^)(NSError *error))failure;

#pragma mark - 9. registerSessionListener
- (WLAgentSkillsRegisterSessionListenerResult *)registerSessionListener:(WLAgentSkillsRegisterSessionListenerParams *)params;

#pragma mark - 10. unregisterSessionListener
- (WLAgentSkillsUnregisterSessionListenerResult *)unregisterSessionListener:(WLAgentSkillsUnregisterSessionListenerParams *)params;

#pragma mark - 11. sendMessage
- (void)sendMessage:(WLAgentSkillsSendMessageParams *)params
                        success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                        failure:(void (^)(NSError *error))failure;

#pragma mark - 12. replyPermission
- (void)replyPermission:(WLAgentSkillsReplyPermissionParams *)params
                                success:(void (^)(WLAgentSkillsReplyPermissionResult *result))success
                                failure:(void (^)(NSError *error))failure;

#pragma mark - 13. controlSkillWeCode
- (void)controlSkillWeCode:(WLAgentSkillsControlSkillWeCodeParams *)params
                                        success:(void (^)(WLAgentSkillsControlSkillWeCodeResult *result))success
                                        failure:(void (^)(NSError *error))failure;

#pragma mark - 14. createNewSession
- (void)createNewSession:(WLAgentSkillsCreateNewSessionParams *)params
                success:(void (^)(WLAgentSkillsSkillSession *session))success
                failure:(void (^)(NSError *error))failure;

#pragma mark - 15. getHistorySessionsList
- (void)getHistorySessionsList:(WLAgentSkillsHistorySessionsParams *)params
                        success:(void (^)(WLAgentSkillsSkillSessionPageResult *result))success
                        failure:(void (^)(NSError *error))failure;

#pragma mark - 16. createDigitalTwin
- (void)createDigitalTwin:(WLAgentSkillsCreateDigitalTwinParams *)params
                    success:(void (^)(WLAgentSkillsCreateDigitalTwinResult *result))success
                    failure:(void (^)(NSError *error))failure;

#pragma mark - 17. getAgentType
- (void)getAgentTypeWithSuccess:(void (^)(WLAgentSkillsAgentTypeListResult *result))success
                         failure:(void (^)(NSError *error))failure;

#pragma mark - 18. getWeAgentList
- (void)getWeAgentList:(WLAgentSkillsPageParams *)params
                success:(void (^)(WLAgentSkillsWeAgentListResult *result))success
                failure:(void (^)(NSError *error))failure;

#pragma mark - 19. getWeAgentDetails
- (void)getWeAgentDetails:(WLAgentSkillsQueryWeAgentParams *)params
                    success:(void (^)(WLAgentSkillsWeAgentDetailsArrayResult *result))success
                    failure:(void (^)(NSError *error))failure;

#pragma mark - 20. getWeAgentUri
- (WLAgentSkillsWeAgentUriResult *)getWeAgentUri;

@end

NS_ASSUME_NONNULL_END
