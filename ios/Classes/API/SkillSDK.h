//
//  SkillSDK.h
//  SkillSDK
//
//  Skill SDK 主接口头文件
//

#import <Foundation/Foundation.h>
#import "SkillSDKTypes.h"

NS_ASSUME_NONNULL_BEGIN

/// SDK 配置
@interface SkillSDKConfig : NSObject

@property (nonatomic, strong) NSString *baseUrl;
@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, strong, nullable) NSString *webSocketHost;

- (instancetype)initWithBaseUrl:(NSString *)baseUrl
              skillDefinitionId:(NSInteger)skillDefinitionId;

@end

/// Skill SDK 主类
@interface SkillSDK : NSObject

+ (instancetype)sharedSDK;

/// 初始化 SDK
/// @param config SDK 配置
- (void)initWithConfig:(SkillSDKConfig *)config;

/// 执行技能
/// @param imChatId IM 聊天 ID
/// @param userId 用户 ID
/// @param skillContent 用户输入的 Skill 指令内容
/// @param agentId PCAgent ID（可选）
/// @param title 会话标题（可选）
/// @param handler 完成回调
- (void)executeSkillWithImChatId:(NSString *)imChatId
                          userId:(NSString *)userId
                    skillContent:(NSString *)skillContent
                         agentId:(nullable NSNumber *)agentId
                           title:(nullable NSString *)title
                       completionHandler:(void(^)(SkillExecuteSkillResult * _Nullable result, NSError * _Nullable error))handler;

/// 关闭技能
/// @param sessionId 会话 ID
/// @param handler 完成回调
- (void)closeSkillWithSessionId:(NSString *)sessionId
              completionHandler:(void(^)(SkillCloseSkillResult * _Nullable result, NSError * _Nullable error))handler;

/// 停止技能
/// @param sessionId 会话 ID
/// @param handler 完成回调
- (void)stopSkillWithSessionId:(NSString *)sessionId
             completionHandler:(void(^)(SkillStopSkillResult * _Nullable result, NSError * _Nullable error))handler;

/// 监听会话状态
/// @param sessionId 会话 ID
/// @param callback 状态回调
- (void)onSessionStatusWithSessionId:(NSString *)sessionId
                            callback:(SkillSessionStatusCallback)callback;

/// 监听小程序状态
/// @param callback 状态回调
- (void)onSkillWecodeStatusWithCallback:(SkillWecodeStatusCallback)callback;

/// 重新生成回答
/// @param sessionId 会话 ID
/// @param handler 完成回调
- (void)regenerateAnswerWithSessionId:(NSString *)sessionId
                    completionHandler:(void(^)(SkillAnswerResult * _Nullable result, NSError * _Nullable error))handler;

/// 发送消息到 IM
/// @param sessionId 会话 ID
/// @param content 消息内容
/// @param handler 完成回调
- (void)sendMessageToIMWithSessionId:(NSString *)sessionId
                             content:(NSString *)content
                   completionHandler:(void(^)(SkillSendMessageToIMResult * _Nullable result, NSError * _Nullable error))handler;

/// 获取会话消息列表
/// @param sessionId 会话 ID
/// @param page 页码（从 0 开始）
/// @param size 每页大小
/// @param handler 完成回调
- (void)getSessionMessageWithSessionId:(NSString *)sessionId
                                  page:(NSInteger)page
                                  size:(NSInteger)size
                     completionHandler:(void(^)(SkillPageResult<SkillChatMessage *> * _Nullable result, NSError * _Nullable error))handler;

/// 发送消息
/// @param sessionId 会话 ID
/// @param content 消息内容
/// @param onMessage 消息回调（可选）
/// @param handler 完成回调
- (void)sendMessageWithSessionId:(NSString *)sessionId
                         content:(NSString *)content
                       onMessage:(nullable SkillStreamMessageCallback)onMessage
               completionHandler:(void(^)(SkillSendMessageResult * _Nullable result, NSError * _Nullable error))handler;

/// 回复权限确认
/// @param sessionId 会话 ID
/// @param permissionId 权限请求 ID
/// @param approved 是否批准
/// @param handler 完成回调
- (void)replyPermissionWithSessionId:(NSString *)sessionId
                        permissionId:(NSString *)permissionId
                            approved:(BOOL)approved
                   completionHandler:(void(^)(SkillReplyPermissionResult * _Nullable result, NSError * _Nullable error))handler;

/// 控制小程序
/// @param action 操作类型
/// @param handler 完成回调
- (void)controlSkillWeCodeWithAction:(SkillWeCodeAction)action
                   completionHandler:(void(^)(SkillControlSkillWeCodeResult * _Nullable result, NSError * _Nullable error))handler;

@end

NS_ASSUME_NONNULL_END
