//
//  WLAgentSkillsWebSocketManager.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>
#import "WLAgentSkillsTypes.h"

NS_ASSUME_NONNULL_BEGIN

@protocol WLAgentSkillsWebSocketManagerDelegate <NSObject>
@optional
- (void)webSocketManagerDidConnect;
- (void)webSocketManagerDidDisconnectWithError:(nullable NSError *)error;
- (void)webSocketManagerDidReceiveMessage:(WLAgentSkillsStreamMessage *)message;
@end

@interface WLAgentSkillsWebSocketManager : NSObject

@property (nonatomic, weak, nullable) id<WLAgentSkillsWebSocketManagerDelegate> delegate;
@property (nonatomic, assign, readonly) BOOL isConnected;

+ (instancetype)sharedManager;

- (void)connectIfNeeded;
- (void)disconnect;

- (void)addListenerForSessionId:(NSNumber *)welinkSessionId
                      onMessage:(WLAgentSkillsSessionMessageCallback)onMessage
                        onError:(nullable WLAgentSkillsSessionErrorCallback)onError
                        onClose:(nullable WLAgentSkillsSessionCloseCallback)onClose;

- (void)removeListenerForSessionId:(NSNumber *)welinkSessionId
                         onMessage:(WLAgentSkillsSessionMessageCallback)onMessage
                           onError:(nullable WLAgentSkillsSessionErrorCallback)onError
                           onClose:(nullable WLAgentSkillsSessionCloseCallback)onClose;

- (void)removeAllListenersForSessionId:(NSNumber *)welinkSessionId;
- (BOOL)hasListenerForSessionId:(NSNumber *)welinkSessionId;

@end

NS_ASSUME_NONNULL_END
