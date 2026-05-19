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
                            bussinessDomain:(nullable NSString *)bussinessDomain
                                bussinessType:(nullable NSString *)bussinessType
                                    bussinessId:(NSString *)bussinessId
                            assistantAccount:(nullable NSString *)assistantAccount
                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)createNewSessionWithAK:(nullable NSString *)ak
                                        title:(nullable NSString *)title
                            bussinessDomain:(nullable NSString *)bussinessDomain
                                bussinessType:(nullable NSString *)bussinessType
                                    bussinessId:(NSString *)bussinessId
                            assistantAccount:(nullable NSString *)assistantAccount
                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                        failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)createDigitalTwinWithName:(NSString *)name
                             icon:(NSString *)icon
                      description:(NSString *)description
                       weCrewType:(nullable NSNumber *)weCrewType
                       bizRobotId:(nullable NSString *)bizRobotId
                            qrcode:(nullable NSString *)qrcode
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

- (void)updateWeAgentWithPartnerAccount:(nullable NSString *)partnerAccount
                                robotId:(nullable NSString *)robotId
                                   name:(NSString *)name
                                   icon:(NSString *)icon
                            description:(NSString *)description
                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)deleteWeAgentWithPartnerAccount:(nullable NSString *)partnerAccount
                                robotId:(nullable NSString *)robotId
                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)queryQrcodeInfoWithQrcode:(NSString *)qrcode
                          success:(WLAgentSkillsHTTPSuccessBlock)success
                          failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)updateQrcodeInfoWithQrcode:(NSString *)qrcode
                             robotId:(nullable NSString *)robotId
                             status:(NSNumber *)status
                            success:(WLAgentSkillsHTTPSuccessBlock)success
                            failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)queryAssistantGraySingleWithPartnerAccount:(NSString *)partnerAccount
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
                                    subagentSessionId:(nullable NSString *)subagentSessionId
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)abortSessionWithSessionId:(NSString *)welinkSessionId
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)replyPermissionWithSessionId:(NSString *)welinkSessionId
                                                            permId:(NSString *)permId
                                                        response:(NSString *)response
                                            subagentSessionId:(nullable NSString *)subagentSessionId
                                                            success:(WLAgentSkillsHTTPSuccessBlock)success
                                                            failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)sendToIMWithSessionId:(NSString *)welinkSessionId
                                                content:(NSString *)content
                                                chatId:(nullable NSString *)chatId
                                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                                failure:(WLAgentSkillsHTTPFailureBlock)failure;

@end

NS_ASSUME_NONNULL_END
