//
//  SkillSDK.h
//  SkillSDK
//
//  Skill SDK 主接口头文件
//  提供技能执行、会话管理、消息发送等核心功能
//  采用单例模式设计，确保全局唯一实例
//
//  @author OpenCode Team
//  @version 1.0.0
//  @since 2026-03-06
//

#import <Foundation/Foundation.h>
#import "SkillSDKTypes.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * SDK 配置类
 * 包含SDK初始化所需的配置信息
 */
@interface SkillSDKConfig : NSObject

/** 服务端基础URL */
@property (nonatomic, strong) NSString *baseUrl;
/** 技能定义ID */
@property (nonatomic, assign) NSInteger skillDefinitionId;
/** WebSocket连接主机地址，可选 */
@property (nonatomic, strong, nullable) NSString *webSocketHost;

/**
 * 初始化SDK配置
 * 
 * @param baseUrl 服务端基础URL
 * @param skillDefinitionId 技能定义ID
 * @return SkillSDKConfig实例
 */
- (instancetype)initWithBaseUrl:(NSString *)baseUrl
              skillDefinitionId:(NSInteger)skillDefinitionId;

@end

/**
 * Skill SDK 主类
 * 提供SDK初始化、技能执行、会话管理等核心功能
 */
@interface SkillSDK : NSObject

/**
 * 获取SkillSDK单例实例
 * 采用GCD dispatch_once确保线程安全
 * 
 * @return SkillSDK单例实例
 */
+ (instancetype)sharedSDK;

/**
 * 初始化 SDK
 * 必须在使用其他功能前调用此方法
 * 
 * @param config SDK 配置对象
 */
- (void)initWithConfig:(SkillSDKConfig *)config;

/**
 * 执行技能
 * 创建会话并发送用户消息，触发AI生成回答
 * 
 * @param imChatId IM 聊天 ID
 * @param userId 用户 ID
 * @param skillContent 用户输入的 Skill 指令内容
 * @param agentId PCAgent ID（可选），提供时将触发 AI-Gateway 创建 OpenCode 会话
 * @param title 会话标题（可选）
 * @param handler 完成回调，返回执行结果或错误信息
 */
- (void)executeSkillWithImChatId:(NSString *)imChatId
                          userId:(NSString *)userId
                    skillContent:(NSString *)skillContent
                         agentId:(nullable NSNumber *)agentId
                           title:(nullable NSString *)title
                       completionHandler:(void(^)(SkillExecuteSkillResult * _Nullable result, NSError * _Nullable error))handler;

/**
 * 关闭技能会话
 * 调用服务端API关闭会话，并断开WebSocket连接
 * 
 * @param sessionId 会话 ID
 * @param handler 完成回调，返回关闭结果或错误信息
 */
- (void)closeSkillWithSessionId:(NSString *)sessionId
              completionHandler:(void(^)(SkillCloseSkillResult * _Nullable result, NSError * _Nullable error))handler;

/**
 * 停止技能生成
 * 断开WebSocket连接，停止接收消息，但不关闭会话
 * 
 * @param sessionId 会话 ID
 * @param handler 完成回调，返回停止结果或错误信息
 */
- (void)stopSkillWithSessionId:(NSString *)sessionId
             completionHandler:(void(^)(SkillStopSkillResult * _Nullable result, NSError * _Nullable error))handler;

/**
 * 注册会话状态回调
 * 监听会话状态变化，如执行中、已完成、已停止等
 * 
 * @param sessionId 会话 ID
 * @param callback 状态回调函数，接收会话状态变化
 */
- (void)onSessionStatusWithSessionId:(NSString *)sessionId
                            callback:(SkillSessionStatusCallback)callback;

/**
 * 注册小程序状态回调
 * 监听小程序状态变化，如已关闭、已最小化等
 * 
 * @param callback 小程序状态回调函数，接收小程序状态变化
 */
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
