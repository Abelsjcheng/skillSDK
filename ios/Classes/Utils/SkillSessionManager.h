//
//  SkillSessionManager.h
//  SkillSDK
//
//  会话管理类头文件
//

#import <Foundation/Foundation.h>
#import "SkillSDKTypes.h"
#import "SkillHTTPClient.h"
#import "SkillWebSocketManager.h"

NS_ASSUME_NONNULL_BEGIN

@interface SkillSessionInfo : NSObject
@property (nonatomic, strong) NSString *sessionId;
@property (nonatomic, strong) SkillWebSocketManager *wsManager;
@property (nonatomic, assign) SkillSessionState state;
@end

@interface SkillSessionManager : NSObject

@property (nonatomic, strong, readonly) SkillHTTPClient *httpClient;
@property (nonatomic, assign, readonly) NSInteger skillDefinitionId;

+ (instancetype)sharedManager NS_UNAVAILABLE;
+ (instancetype)initWithConfig:(nullable id)config NS_UNAVAILABLE;

- (instancetype)init NS_UNAVAILABLE;

- (void)initWithBaseUrl:(NSString *)baseUrl
      skillDefinitionId:(NSInteger)skillDefinitionId
         webSocketHost:(nullable NSString *)webSocketHost;

- (NSString *)getWebSocketHost;

- (void)addSession:(NSString *)sessionId wsManager:(SkillWebSocketManager *)wsManager;

- (void)removeSession:(NSString *)sessionId;

- (nullable SkillSessionInfo *)getSession:(NSString *)sessionId;

- (NSDictionary<NSString *, SkillSessionInfo *> *)getAllSessions;

- (void)updateSessionState:(NSString *)sessionId state:(SkillSessionState)state;

@end

NS_ASSUME_NONNULL_END
