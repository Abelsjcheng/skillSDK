//
//  SkillSession.h
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * 会话状态枚举
 */
typedef NS_ENUM(NSInteger, SessionStatus) {
    SessionStatusActive = 0,   // 活跃
    SessionStatusIdle = 1,     // 空闲
    SessionStatusClosed = 2,   // 已关闭
    SessionStatusStopped = 3,  // 已停止
    SessionStatusExecuting = 4 // 执行中
};

/**
 * 技能会话模型
 */
@interface SkillSession : NSObject

@property (nonatomic, assign) NSInteger sessionId;
@property (nonatomic, assign) NSInteger userId;
@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, assign) NSInteger agentId;
@property (nonatomic, copy, nullable) NSString *toolSessionId;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, assign) SessionStatus status;
@property (nonatomic, copy, nullable) NSString *imChatId;
@property (nonatomic, copy, nullable) NSString *createdAt;
@property (nonatomic, copy, nullable) NSString *lastActiveAt;

/**
 * 从字典初始化
 */
- (instancetype)initWithDictionary:(NSDictionary *)dictionary;

/**
 * 转换为字典
 */
- (NSDictionary *)toDictionary;

/**
 * 状态字符串转换
 */
+ (SessionStatus)statusFromString:(NSString *)statusString;
+ (NSString *)stringFromStatus:(SessionStatus)status;

@end

NS_ASSUME_NONNULL_END