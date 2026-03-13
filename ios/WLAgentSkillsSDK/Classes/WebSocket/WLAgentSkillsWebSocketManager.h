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

- (BOOL)addListenerForSessionId:(NSString *)welinkSessionId
                                            onMessage:(WLAgentSkillsSessionMessageCallback)onMessage
                                                onError:(nullable WLAgentSkillsSessionErrorCallback)onError
                                                onClose:(nullable WLAgentSkillsSessionCloseCallback)onClose;

- (BOOL)removeListenerForSessionId:(NSString *)welinkSessionId;

- (void)removeAllListenersForSessionId:(NSString *)welinkSessionId;
- (BOOL)hasListenerForSessionId:(NSString *)welinkSessionId;

@end

NS_ASSUME_NONNULL_END
