//
//  SkillSDKTypes.h
//  SkillSDK
//
//  iOS SDK 数据类型定义
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#pragma mark - 枚举类型

/// 会话状态
typedef NS_ENUM(NSInteger, SkillSessionStatus) {
    SkillSessionStatusExecuting = 0,  // 执行中
    SkillSessionStatusStopped = 1,    // 已停止
    SkillSessionStatusCompleted = 2   // 已完成
};

/// 小程序状态
typedef NS_ENUM(NSInteger, SkillWecodeStatus) {
    SkillWecodeStatusClosed = 0,     // 小程序已关闭
    SkillWecodeStatusMinimized = 1   // 小程序已缩小到后台
};

/// 小程序操作
typedef NS_ENUM(NSInteger, SkillWeCodeAction) {
    SkillWeCodeActionClose = 0,      // 关闭小程序
    SkillWeCodeActionMinimize = 1    // 最小化小程序
};

/// 消息角色
typedef NS_ENUM(NSInteger, SkillMessageRole) {
    SkillMessageRoleUser = 0,       // USER
    SkillMessageRoleAssistant = 1,  // ASSISTANT
    SkillMessageRoleSystem = 2,     // SYSTEM
    SkillMessageRoleTool = 3        // TOOL
};

/// 内容类型
typedef NS_ENUM(NSInteger, SkillContentType) {
    SkillContentTypeMarkdown = 0,   // MARKDOWN
    SkillContentTypeCode = 1,       // CODE
    SkillContentTypePlain = 2       // PLAIN
};

/// 会话状态
typedef NS_ENUM(NSInteger, SkillSessionState) {
    SkillSessionStateActive = 0,    // ACTIVE
    SkillSessionStateIdle = 1,      // IDLE
    SkillSessionStateClosed = 2     // CLOSED
};

/// WebSocket 消息类型
typedef NS_ENUM(NSInteger, SkillStreamMessageType) {
    SkillStreamMessageTypeDelta = 0,         // 增量内容
    SkillStreamMessageTypeDone = 1,          // 完成
    SkillStreamMessageTypeError = 2,         // 错误
    SkillStreamMessageTypeAgentOffline = 3,  // Agent 离线
    SkillStreamMessageTypeAgentOnline = 4    // Agent 上线
};

#pragma mark - 数据模型

/// 流式消息内容
@interface SkillStreamMessageContent : NSObject
@property (nonatomic, assign) NSInteger inputTokens;
@property (nonatomic, assign) NSInteger outputTokens;
@end

/// 流式消息
@interface SkillStreamMessage : NSObject
@property (nonatomic, assign) SkillStreamMessageType type;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, strong, nullable) NSString *content;
@property (nonatomic, strong, nullable) SkillStreamMessageContent *usage;
@end

/// 聊天消息
@interface SkillChatMessage : NSObject
@property (nonatomic, assign) NSInteger id;
@property (nonatomic, assign) NSInteger sessionId;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, assign) SkillMessageRole role;
@property (nonatomic, strong) NSString *content;
@property (nonatomic, assign) SkillContentType contentType;
@property (nonatomic, strong) NSString *createdAt;
@property (nonatomic, strong, nullable) NSString *meta;
@end

/// 技能会话
@interface SkillSession : NSObject
@property (nonatomic, assign) NSInteger id;
@property (nonatomic, assign) NSInteger userId;
@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, strong, nullable) NSNumber *agentId;
@property (nonatomic, strong, nullable) NSString *toolSessionId;
@property (nonatomic, strong, nullable) NSString *title;
@property (nonatomic, assign) SkillSessionState status;
@property (nonatomic, strong, nullable) NSString *imChatId;
@property (nonatomic, strong) NSString *createdAt;
@property (nonatomic, strong) NSString *lastActiveAt;
@end

/// 执行技能结果
@interface SkillExecuteSkillResult : NSObject
@property (nonatomic, strong) NSString *sessionId;
@property (nonatomic, assign) SkillSessionStatus status;
@property (nonatomic, strong, nullable) NSString *toolSessionId;
@property (nonatomic, assign) NSTimeInterval createdAt;
@end

/// 关闭技能结果
@interface SkillCloseSkillResult : NSObject
@property (nonatomic, assign) BOOL success;
@end

/// 停止技能结果
@interface SkillStopSkillResult : NSObject
@property (nonatomic, assign) BOOL success;
@end

/// 重新生成回答结果
@interface SkillAnswerResult : NSObject
@property (nonatomic, strong) NSString *messageId;
@property (nonatomic, assign) BOOL success;
@end

/// 发送消息到 IM 结果
@interface SkillSendMessageToIMResult : NSObject
@property (nonatomic, assign) BOOL success;
@end

/// 发送消息结果
@interface SkillSendMessageResult : NSObject
@property (nonatomic, assign) BOOL success;
@end

/// 回复权限结果
@interface SkillReplyPermissionResult : NSObject
@property (nonatomic, assign) BOOL success;
@end

/// 控制小程序结果
@interface SkillControlSkillWeCodeResult : NSObject
@property (nonatomic, assign) BOOL success;
@end

/// 分页结果
@interface SkillPageResult<T> : NSObject
@property (nonatomic, strong) NSArray<T> *content;
@property (nonatomic, assign) NSInteger totalElements;
@property (nonatomic, assign) NSInteger totalPages;
@property (nonatomic, assign) NSInteger number;
@property (nonatomic, assign) NSInteger size;
@end

/// 权限响应
@interface SkillPermissionResponse : NSObject
@property (nonatomic, assign) BOOL success;
@property (nonatomic, strong) NSString *permissionId;
@property (nonatomic, assign) BOOL approved;
@end

#pragma mark - 回调类型

/// 会话状态回调
typedef void (^SkillSessionStatusCallback)(SkillSessionStatus status);

/// 小程序状态回调
typedef void (^SkillWecodeStatusCallback)(SkillWecodeStatus status);

/// 流式消息回调
typedef void (^SkillStreamMessageCallback)(SkillStreamMessage *message);

NS_ASSUME_NONNULL_END
