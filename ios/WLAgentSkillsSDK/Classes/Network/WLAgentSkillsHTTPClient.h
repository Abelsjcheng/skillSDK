//
//  WLAgentSkillsHTTPClient.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

typedef void (^WLAgentSkillsSuccessBlock)(id _Nullable responseObject);
typedef void (^WLAgentSkillsFailureBlock)(NSError *error);

@interface WLAgentSkillsHTTPClient : NSObject

+ (instancetype)sharedClient;

- (void)createSessionWithUserId:(NSString *)userId
            skillDefinitionId:(NSInteger)skillDefinitionId
                        agentId:(NSInteger)agentId
                          title:(nullable NSString *)title
                       imChatId:(nullable NSString *)imChatId
                        success:(WLAgentSkillsSuccessBlock)success
                        failure:(WLAgentSkillsFailureBlock)failure;

- (void)getSessionListWithUserId:(NSString *)userId
                        statuses:(nullable NSArray<NSString *> *)statuses
                            page:(NSInteger)page
                            size:(NSInteger)size
                         success:(WLAgentSkillsSuccessBlock)success
                         failure:(WLAgentSkillsFailureBlock)failure;

- (void)getSessionDetailWithSessionId:(NSString *)sessionId
                             success:(WLAgentSkillsSuccessBlock)success
                             failure:(WLAgentSkillsFailureBlock)failure;

- (void)closeSessionWithSessionId:(NSString *)sessionId
                         success:(WLAgentSkillsSuccessBlock)success
                         failure:(WLAgentSkillsFailureBlock)failure;

- (void)sendMessageWithSessionId:(NSString *)sessionId
                         content:(NSString *)content
                         success:(WLAgentSkillsSuccessBlock)success
                         failure:(WLAgentSkillsFailureBlock)failure;

- (void)getMessageHistoryWithSessionId:(NSString *)sessionId
                                  page:(NSInteger)page
                                  size:(NSInteger)size
                               success:(WLAgentSkillsSuccessBlock)success
                               failure:(WLAgentSkillsFailureBlock)failure;

- (void)replyPermissionWithSessionId:(NSString *)sessionId
                       permissionId:(NSString *)permissionId
                           approved:(BOOL)approved
                            success:(WLAgentSkillsSuccessBlock)success
                            failure:(WLAgentSkillsFailureBlock)failure;

- (void)sendMessageToIMWithSessionId:(NSString *)sessionId
                             content:(NSString *)content
                             success:(WLAgentSkillsSuccessBlock)success
                             failure:(WLAgentSkillsFailureBlock)failure;

@end

NS_ASSUME_NONNULL_END