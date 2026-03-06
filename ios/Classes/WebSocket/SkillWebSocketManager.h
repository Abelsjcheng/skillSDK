//
//  SkillWebSocketManager.h
//  SkillSDK
//
//  WebSocket 管理类头文件
//

#import <Foundation/Foundation.h>
#import "SkillSDKTypes.h"

NS_ASSUME_NONNULL_BEGIN

@interface SkillWebSocketManager : NSObject

@property (nonatomic, strong, readonly) NSString *sessionId;
@property (nonatomic, assign, readonly, getter=isActive) BOOL active;

- (instancetype)init NS_UNAVAILABLE;

- (void)connectWithSessionId:(NSString *)sessionId
                        host:(NSString *)host
                 onMessage:(nullable SkillStreamMessageCallback)onMessage
                   onStatus:(nullable SkillSessionStatusCallback)onStatus
          completionHandler:(void(^)(BOOL success, NSError * _Nullable error))handler;

- (void)close;

- (void)setMessageCallback:(SkillStreamMessageCallback)callback;

- (void)setStatusCallback:(SkillSessionStatusCallback)callback;

@end

NS_ASSUME_NONNULL_END
