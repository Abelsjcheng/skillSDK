//
//  WLAgentSkillsHTTPClient.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^WLAgentSkillsHTTPSuccessBlock)(id _Nullable responseObject);
typedef void (^WLAgentSkillsHTTPFailureBlock)(NSError *error);

@interface WLAgentSkillsHTTPClient : NSObject

+ (instancetype)sharedClient;

- (void)reloadConfiguration;

- (void)createSessionWithAK:(nullable NSString *)ak
                                            title:(nullable NSString *)title
                                    imGroupId:(NSString *)imGroupId
                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)createNewSessionWithAK:(NSString *)ak
                                        title:(nullable NSString *)title
                            bussinessDomain:(NSString *)bussinessDomain
                                bussinessType:(NSString *)bussinessType
                                    bussinessId:(NSString *)bussinessId
                            assistantAccount:(NSString *)assistantAccount
                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)createDigitalTwinWithName:(NSString *)name
                                icon:(NSString *)icon
                        description:(NSString *)description
                        weCrewType:(NSNumber *)weCrewType
                        bizRobotId:(nullable NSString *)bizRobotId
                            success:(WLAgentSkillsHTTPSuccessBlock)success
                            failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getAgentTypeWithSuccess:(WLAgentSkillsHTTPSuccessBlock)success
                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getWeAgentListWithPageSize:(NSNumber *)pageSize
                        pageNumber:(NSNumber *)pageNumber
                            success:(WLAgentSkillsHTTPSuccessBlock)success
                            failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getWeAgentDetailsWithPartnerAccount:(NSString *)partnerAccount
                                     success:(WLAgentSkillsHTTPSuccessBlock)success
                                     failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getSessionsWithImGroupId:(nullable NSString *)imGroupId
                                                            ak:(nullable NSString *)ak
                                                        status:(nullable NSString *)status
                                                            page:(nullable NSNumber *)page
                                                            size:(nullable NSNumber *)size
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getHistorySessionsWithPage:(nullable NSNumber *)page
                                                size:(nullable NSNumber *)size
                                            status:(nullable NSString *)status
                                                ak:(nullable NSString *)ak
                                    bussinessId:(nullable NSString *)bussinessId
                            assistantAccount:(nullable NSString *)assistantAccount
                    businessSessionDomain:(nullable NSString *)businessSessionDomain
                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getSessionWithSessionId:(NSString *)welinkSessionId
                                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                                failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getMessagesWithSessionId:(NSString *)welinkSessionId
                                                        page:(NSNumber *)page
                                                        size:(NSNumber *)size
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getMessageHistoryWithSessionId:(NSString *)welinkSessionId
                                                     beforeSeq:(nullable NSNumber *)beforeSeq
                                                            size:(nullable NSNumber *)size
                                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)sendMessageWithSessionId:(NSString *)welinkSessionId
                                                    content:(NSString *)content
                                            toolCallId:(nullable NSString *)toolCallId
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)abortSessionWithSessionId:(NSString *)welinkSessionId
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)replyPermissionWithSessionId:(NSString *)welinkSessionId
                                                            permId:(NSString *)permId
                                                        response:(NSString *)response
                                                            success:(WLAgentSkillsHTTPSuccessBlock)success
                                                            failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)sendToIMWithSessionId:(NSString *)welinkSessionId
                                                content:(NSString *)content
                                                chatId:(nullable NSString *)chatId
                                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                                failure:(WLAgentSkillsHTTPFailureBlock)failure;

@end

NS_ASSUME_NONNULL_END
