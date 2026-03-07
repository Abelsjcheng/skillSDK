//
//  WLAgentSkillsWebSocketManager.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsWebSocketManager.h"
#import "WLAgentSkillsConfig.h"
@import SocketRocket;

@interface WLAgentSkillsSessionListener : NSObject

@property (nonatomic, copy) void (^onMessage)(WLAgentSkillsStreamMessage *message);
@property (nonatomic, copy) void (^onError)(WLAgentSkillsSessionError *error);
@property (nonatomic, copy) void (^onClose)(NSString *reason);

@end

@implementation WLAgentSkillsSessionListener
@end

@interface WLAgentSkillsWebSocketManager () <SRWebSocketDelegate>

@property (nonatomic, strong, nullable) SRWebSocket *webSocket;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionListener *> *sessionListeners;
@property (nonatomic, strong) WLAgentSkillsSessionListener *internalCacheListener;
@property (nonatomic, assign) BOOL isConnected;

@end

@implementation WLAgentSkillsWebSocketManager

+ (instancetype)sharedManager {
    static WLAgentSkillsWebSocketManager *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[WLAgentSkillsWebSocketManager alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sessionListeners = [NSMutableDictionary dictionary];
        _isConnected = NO;
        [self setupInternalCacheListener];
    }
    return self;
}

- (void)setupInternalCacheListener {
    __weak typeof(self) weakSelf = self;
    _internalCacheListener = [[WLAgentSkillsSessionListener alloc] init];
    _internalCacheListener.onMessage = ^(WLAgentSkillsStreamMessage *message) {
        [[NSNotificationCenter defaultCenter] postNotificationName:@"WLAgentSkillsStreamMessageReceived"
                                                            object:weakSelf
                                                          userInfo:@{@"message": message}];
    };
}

#pragma mark - Connection Management

- (void)connect {
    if (self.webSocket && self.isConnected) {
        return;
    }
    
    WLAgentSkillsConfig *config = [WLAgentSkillsConfig sharedConfig];
    NSURL *url = [NSURL URLWithString:config.webSocketURL];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    
    self.webSocket = [[SRWebSocket alloc] initWithURLRequest:request];
    self.webSocket.delegate = self;
    [self.webSocket open];
}

- (void)disconnect {
    if (self.webSocket) {
        [self.webSocket close];
        self.webSocket = nil;
    }
    self.isConnected = NO;
}

#pragma mark - Session Subscription

- (void)subscribeToSession:(NSString *)sessionId
                  onMessage:(void (^)(WLAgentSkillsStreamMessage *message))onMessage
                    onError:(void (^)(WLAgentSkillsSessionError *error))onError
                    onClose:(void (^)(NSString *reason))onClose {
    
    if (!self.isConnected) {
        [self connect];
    }
    
    WLAgentSkillsSessionListener *listener = [[WLAgentSkillsSessionListener alloc] init];
    listener.onMessage = onMessage;
    listener.onError = onError;
    listener.onClose = onClose;
    
    self.sessionListeners[sessionId] = listener;
}

- (void)unsubscribeFromSession:(NSString *)sessionId {
    [self.sessionListeners removeObjectForKey:sessionId];
    
    if (self.sessionListeners.count == 0) {
        [self disconnect];
    }
}

- (BOOL)isSubscribedToSession:(NSString *)sessionId {
    return self.sessionListeners[sessionId] != nil;
}

#pragma mark - SRWebSocketDelegate

- (void)webSocketDidOpen:(SRWebSocket *)webSocket {
    self.isConnected = YES;
    
    if ([self.delegate respondsToSelector:@selector(webSocketDidConnect)]) {
        [self.delegate webSocketDidConnect];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didFailWithError:(NSError *)error {
    self.isConnected = NO;
    
    WLAgentSkillsSessionError *sessionError = [[WLAgentSkillsSessionError alloc] initWithDictionary:@{
        @"code": @"WebSocketError",
        @"message": error.localizedDescription ?: @"Connection failed"
    }];
    
    for (WLAgentSkillsSessionListener *listener in self.sessionListeners.allValues) {
        if (listener.onError) {
            listener.onError(sessionError);
        }
    }
    
    if ([self.delegate respondsToSelector:@selector(webSocketDidDisconnectWithError:)]) {
        [self.delegate webSocketDidDisconnectWithError:error];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didCloseWithCode:(NSInteger)code reason:(NSString *)reason wasClean:(BOOL)wasClean {
    self.isConnected = NO;
    
    NSString *closeReason = reason ?: @"Connection closed";
    
    for (WLAgentSkillsSessionListener *listener in self.sessionListeners.allValues) {
        if (listener.onClose) {
            listener.onClose(closeReason);
        }
    }
    
    if ([self.delegate respondsToSelector:@selector(webSocketDidDisconnectWithError:)]) {
        [self.delegate webSocketDidDisconnectWithError:nil];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessageWithString:(NSString *)string {
    NSData *data = [string dataUsingEncoding:NSUTF8StringEncoding];
    NSError *error;
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    
    if (error || !json) {
        return;
    }
    
    WLAgentSkillsStreamMessage *message = [[WLAgentSkillsStreamMessage alloc] initWithDictionary:json];
    
    if ([self.delegate respondsToSelector:@selector(webSocketDidReceiveMessage:)]) {
        [self.delegate webSocketDidReceiveMessage:message];
    }
    
    WLAgentSkillsSessionListener *listener = self.sessionListeners[message.sessionId];
    if (listener && listener.onMessage) {
        listener.onMessage(message);
    }
    
    if (_internalCacheListener.onMessage) {
        _internalCacheListener.onMessage(message);
    }
}

@end