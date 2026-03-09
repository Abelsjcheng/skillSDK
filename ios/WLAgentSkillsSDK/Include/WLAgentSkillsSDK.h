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

#pragma mark - 1. 创建会话
- (void)createSession:(WLAgentSkillsCreateSessionParams *)params
              success:(void (^)(WLAgentSkillsSkillSession *session))success
              failure:(void (^)(NSError *error))failure;

#pragma mark - 2. 关闭技能（仅关闭本地WebSocket）
- (void)closeSkillWithSuccess:(void (^)(WLAgentSkillsCloseSkillResult *result))success
                      failure:(void (^)(NSError *error))failure;

#pragma mark - 3. 停止技能
- (void)stopSkill:(WLAgentSkillsStopSkillParams *)params
          success:(void (^)(WLAgentSkillsStopSkillResult *result))success
          failure:(void (^)(NSError *error))failure;

#pragma mark - 4. 会话状态变更回调
- (void)onSessionStatusChange:(WLAgentSkillsOnSessionStatusChangeParams *)params;

#pragma mark - 5. 小程序状态变更回调
- (void)onSkillWecodeStatusChange:(WLAgentSkillsOnSkillWecodeStatusChangeParams *)params;

#pragma mark - 6. 重新生成问答
- (void)regenerateAnswer:(WLAgentSkillsRegenerateAnswerParams *)params
                 success:(void (^)(WLAgentSkillsSendMessageResult *result))success
                 failure:(void (^)(NSError *error))failure;

#pragma mark - 7. 发送AI结果到IM
- (void)sendMessageToIM:(WLAgentSkillsSendMessageToIMParams *)params
                success:(void (^)(WLAgentSkillsSendMessageToIMResult *result))success
                failure:(void (^)(NSError *error))failure;

#pragma mark - 8. 获取会话消息
- (void)getSessionMessage:(WLAgentSkillsGetSessionMessageParams *)params
                  success:(void (^)(WLAgentSkillsPageResult *result))success
                  failure:(void (^)(NSError *error))failure;

#pragma mark - 9. 注册会话监听器
- (void)registerSessionListener:(WLAgentSkillsRegisterSessionListenerParams *)params;

#pragma mark - 10. 移除会话监听器
- (void)unregisterSessionListener:(WLAgentSkillsUnregisterSessionListenerParams *)params;

#pragma mark - 11. 发送消息
- (void)sendMessage:(WLAgentSkillsSendMessageParams *)params
            success:(void (^)(WLAgentSkillsSendMessageResult *result))success
            failure:(void (^)(NSError *error))failure;

#pragma mark - 12. 权限确认
- (void)replyPermission:(WLAgentSkillsReplyPermissionParams *)params
                success:(void (^)(WLAgentSkillsReplyPermissionResult *result))success
                failure:(void (^)(NSError *error))failure;

#pragma mark - 13. 小程序控制
- (void)controlSkillWeCode:(WLAgentSkillsControlSkillWeCodeParams *)params
                   success:(void (^)(WLAgentSkillsControlSkillWeCodeResult *result))success
                   failure:(void (^)(NSError *error))failure;

@end

NS_ASSUME_NONNULL_END
