//
//  WLAgentSkillsWebSocketManager.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

@protocol WLAgentSkillsWebSocketDelegate <NSObject>

@optional
- (void)webSocketDidConnect;
- (void)webSocketDidDisconnectWithError:(nullable NSError *)error;
- (void)webSocketDidReceiveMessage:(WLAgentSkillsStreamMessage *)message;

@end

@interface WLAgentSkillsWebSocketManager : NSObject

@property (nonatomic, weak, nullable) id<WLAgentSkillsWebSocketDelegate> delegate;
@property (nonatomic, assign, readonly) BOOL isConnected;

+ (instancetype)sharedManager;

- (void)connect;
- (void)disconnect;

- (void)subscribeToSession:(NSString *)sessionId
                  onMessage:(void (^)(WLAgentSkillsStreamMessage *message))onMessage
                    onError:(void (^)(WLAgentSkillsSessionError *error))onError
                    onClose:(void (^)(NSString *reason))onClose;

- (void)unsubscribeFromSession:(NSString *)sessionId;

- (BOOL)isSubscribedToSession:(NSString *)sessionId;

@end

NS_ASSUME_NONNULL_END