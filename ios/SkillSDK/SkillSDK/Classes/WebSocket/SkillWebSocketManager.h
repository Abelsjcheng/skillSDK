//
//  SkillWebSocketManager.h
//  SkillSDK
//

#import <Foundation/Foundation.h>
#import "StreamMessage.h"

NS_ASSUME_NONNULL_BEGIN

@protocol SkillWebSocketDelegate <NSObject>

@optional
- (void)webSocketDidOpen;
- (void)webSocketDidReceiveMessage:(StreamMessage *)message;
- (void)webSocketDidFailWithError:(NSError *)error;
- (void)webSocketDidCloseWithReason:(NSString *)reason;

@end

@interface SkillWebSocketManager : NSObject

@property (nonatomic, weak) id<SkillWebSocketDelegate> delegate;
@property (nonatomic, readonly) BOOL isConnected;

+ (instancetype)sharedManager;

- (void)connect;
- (void)disconnect;
- (void)sendMessage:(NSDictionary *)message;

@end

NS_ASSUME_NONNULL_END