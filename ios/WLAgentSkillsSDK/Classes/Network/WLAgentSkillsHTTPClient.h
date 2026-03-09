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

- (void)createSessionWithAK:(NSString *)ak
                      title:(nullable NSString *)title
                  imGroupId:(NSString *)imGroupId
                    success:(WLAgentSkillsHTTPSuccessBlock)success
                    failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getSessionsWithImGroupId:(nullable NSString *)imGroupId
                          status:(nullable NSString *)status
                            page:(nullable NSNumber *)page
                            size:(nullable NSNumber *)size
                         success:(WLAgentSkillsHTTPSuccessBlock)success
                         failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)getMessagesWithSessionId:(NSNumber *)welinkSessionId
                            page:(NSNumber *)page
                            size:(NSNumber *)size
                         success:(WLAgentSkillsHTTPSuccessBlock)success
                         failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)sendMessageWithSessionId:(NSNumber *)welinkSessionId
                         content:(NSString *)content
                      toolCallId:(nullable NSString *)toolCallId
                         success:(WLAgentSkillsHTTPSuccessBlock)success
                         failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)abortSessionWithSessionId:(NSNumber *)welinkSessionId
                          success:(WLAgentSkillsHTTPSuccessBlock)success
                          failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)replyPermissionWithSessionId:(NSNumber *)welinkSessionId
                              permId:(NSString *)permId
                            response:(NSString *)response
                             success:(WLAgentSkillsHTTPSuccessBlock)success
                             failure:(WLAgentSkillsHTTPFailureBlock)failure;

- (void)sendToIMWithSessionId:(NSNumber *)welinkSessionId
                      content:(NSString *)content
                      success:(WLAgentSkillsHTTPSuccessBlock)success
                      failure:(WLAgentSkillsHTTPFailureBlock)failure;

@end

NS_ASSUME_NONNULL_END
