//
//  WLAgentSkillsSDK.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"
#import "WLAgentSkillsConfig.h"

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsSDK : NSObject

#pragma mark - Configuration

+ (void)configureWithBaseURL:(NSString *)baseURL;

#pragma mark - 1. executeSkill - 执行技能

- (void)executeSkillWithParams:(WLAgentSkillsExecuteSkillParams *)params
                        success:(void (^)(WLAgentSkillsSession *session))success
                        failure:(void (^)(NSError *error))failure;

#pragma mark - 2. closeSkill - 关闭技能

- (void)closeSkillWithParams:(WLAgentSkillsCloseSkillParams *)params
                     success:(void (^)(WLAgentSkillsCloseSkillResult *result))success
                     failure:(void (^)(NSError *error))failure;

#pragma mark - 3. stopSkill - 停止技能

- (void)stopSkillWithParams:(WLAgentSkillsStopSkillParams *)params
                    success:(void (^)(WLAgentSkillsStopSkillResult *result))success
                    failure:(void (^)(NSError *error))failure;

#pragma mark - 4. onSessionStatusChange - 会话状态变更回调

- (void)onSessionStatusChangeWithParams:(WLAgentSkillsOnSessionStatusChangeParams *)params;

#pragma mark - 5. onSkillWecodeStatusChange - 小程序状态变更回调

- (void)onSkillWecodeStatusChangeWithParams:(WLAgentSkillsOnSkillWecodeStatusChangeParams *)params;

#pragma mark - 6. regenerateAnswer - 重新生成问答

- (void)regenerateAnswerWithParams:(WLAgentSkillsRegenerateAnswerParams *)params
                           success:(void (^)(WLAgentSkillsRegenerateAnswerResult *result))success
                           failure:(void (^)(NSError *error))failure;

#pragma mark - 7. sendMessageToIM - 发送AI生成消息到IM

- (void)sendMessageToIMWithParams:(WLAgentSkillsSendMessageToIMParams *)params
                          success:(void (^)(WLAgentSkillsSendMessageToIMResult *result))success
                          failure:(void (^)(NSError *error))failure;

#pragma mark - 8. getSessionMessage - 获取当前会话消息列表

- (void)getSessionMessageWithParams:(WLAgentSkillsGetSessionMessageParams *)params
                            success:(void (^)(WLAgentSkillsPageResult *result))success
                            failure:(void (^)(NSError *error))failure;

#pragma mark - 9. registerSessionListener - 注册会话监听器

- (void)registerSessionListenerWithParams:(WLAgentSkillsRegisterSessionListenerParams *)params;

#pragma mark - 10. unregisterSessionListener - 移除会话监听器

- (void)unregisterSessionListenerWithParams:(WLAgentSkillsUnregisterSessionListenerParams *)params;

#pragma mark - 11. sendMessage - 发送消息内容

- (void)sendMessageWithParams:(WLAgentSkillsSendMessageParams *)params
                     success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                     failure:(void (^)(NSError *error))failure;

#pragma mark - 12. replyPermission - 权限确认

- (void)replyPermissionWithParams:(WLAgentSkillsReplyPermissionParams *)params
                          success:(void (^)(WLAgentSkillsReplyPermissionResult *result))success
                          failure:(void (^)(NSError *error))failure;

#pragma mark - 13. controlSkillWeCode - 小程序控制

- (void)controlSkillWeCodeWithParams:(WLAgentSkillsControlSkillWeCodeParams *)params
                             success:(void (^)(WLAgentSkillsControlSkillWeCodeResult *result))success
                             failure:(void (^)(NSError *error))failure;

@end

NS_ASSUME_NONNULL_END