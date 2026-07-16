//
//  WLAgentSkillsWebSocketManager.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsWebSocketManager.h"
#import "WLAgentSkillsConfig.h"
@import SocketRocket;

@interface WLAgentSkillsSocketListener : NSObject
@property (nonatomic, copy) WLAgentSkillsSessionMessageCallback onMessage;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionErrorCallback onError;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionCloseCallback onClose;
@end

@implementation WLAgentSkillsSocketListener
@end

@interface WLAgentSkillsWebSocketManager () <SRWebSocketDelegate>

@property (nonatomic, strong, nullable) SRWebSocket *webSocket;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSocketListener *> *listeners;
@property (nonatomic, copy, nullable) WLAgentSkillsWebSocketConnectCompletion connectCompletion;
@property (nonatomic, assign, readwrite) BOOL isConnected;
@property (nonatomic, assign) BOOL isConnecting;

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
    _listeners = [NSMutableDictionary dictionary];
    _connectCompletion = nil;
    _isConnected = NO;
    _isConnecting = NO;
    }
    return self;
}

- (void)connectIfNeeded {
    [self ensureConnectedWithCompletion:nil];
}

- (void)ensureConnectedWithCompletion:(nullable WLAgentSkillsWebSocketConnectCompletion)completion {
    NSError *connectError = nil;
    BOOL shouldCompleteImmediately = NO;
    BOOL shouldReturnImmediately = NO;
    @synchronized(self) {
    if (self.isConnected) {
        shouldCompleteImmediately = YES;
    } else {
        if (completion != nil) {
            self.connectCompletion = [completion copy];
        }
        if (self.isConnecting) {
            shouldReturnImmediately = YES;
        } else {
            NSString *wsURL = [WLAgentSkillsConfig sharedConfig].webSocketURL;
            NSURL *url = [NSURL URLWithString:wsURL];
            if (url == nil) {
                connectError = [self webSocketErrorWithMessage:@"WebSocket URL is invalid."];
                self.connectCompletion = nil;
            } else {
                self.isConnecting = YES;
                self.webSocket = [[SRWebSocket alloc] initWithURLRequest:[NSURLRequest requestWithURL:url]];
                self.webSocket.delegate = self;
                [self.webSocket open];
            }
        }
    }
    }

    if (shouldReturnImmediately) {
    return;
    }

    if (shouldCompleteImmediately && completion != nil) {
    completion(nil);
    }
    if (connectError != nil && completion != nil) {
    completion(connectError);
    }
}

- (void)disconnect {
    WLAgentSkillsWebSocketConnectCompletion connectCompletion = nil;
    @synchronized(self) {
    connectCompletion = [self consumeConnectCompletion];
    if (self.webSocket != nil) {
        [self.webSocket close];
    }
    self.webSocket.delegate = nil;
    self.webSocket = nil;
    self.isConnected = NO;
    self.isConnecting = NO;
    }
    if (connectCompletion != nil) {
    connectCompletion([self webSocketErrorWithMessage:@"WebSocket is disconnected."]);
    }
}

- (BOOL)addListenerForSessionId:(NSString *)welinkSessionId
                        onMessage:(WLAgentSkillsSessionMessageCallback)onMessage
                        onError:(nullable WLAgentSkillsSessionErrorCallback)onError
                        onClose:(nullable WLAgentSkillsSessionCloseCallback)onClose {
    if (welinkSessionId == nil || welinkSessionId.length == 0 || onMessage == nil) {
    return NO;
    }

    NSString *key = welinkSessionId;
    WLAgentSkillsSocketListener *listener = [[WLAgentSkillsSocketListener alloc] init];
    listener.onMessage = onMessage;
    listener.onError = onError;
    listener.onClose = onClose;

    @synchronized(self) {
    self.listeners[key] = listener;
    }

    [self connectIfNeeded];
    return YES;
}

- (BOOL)removeListenerForSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
    return NO;
    }

    NSString *key = welinkSessionId;
    @synchronized(self) {
    if (self.listeners[key] == nil) {
        return NO;
    }
    [self.listeners removeObjectForKey:key];
    }
    return YES;
}

- (void)removeAllListenersForSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
    return;
    }

    @synchronized(self) {
    [self.listeners removeObjectForKey:welinkSessionId];
    }
}

- (BOOL)hasListenerForSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
    return NO;
    }
    @synchronized(self) {
    return self.listeners[welinkSessionId] != nil;
    }
}

- (void)sendResumeMessageForSessionId:(NSString *)sessionId {
    if (sessionId == nil || sessionId.length == 0) {
    return;
    }

    SRWebSocket *socket = nil;
    @synchronized(self) {
    if (!self.isConnected || self.webSocket == nil) {
        return;
    }
    socket = self.webSocket;
    }

    NSDictionary *payload = @{
        @"action": @"resume",
        @"sessionId": sessionId
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    if (data == nil) {
    return;
    }
    NSString *jsonString = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (jsonString == nil || jsonString.length == 0) {
    return;
    }

    @try {
    [socket send:jsonString];
    } @catch (__unused NSException *exception) {
    // 恢复订阅属于尽力而为能力，不向上抛错打断历史消息正常返回。
    }
}

#pragma mark - SRWebSocketDelegate

- (void)webSocketDidOpen:(SRWebSocket *)webSocket {
    WLAgentSkillsWebSocketConnectCompletion connectCompletion = nil;
    @synchronized(self) {
    self.isConnecting = NO;
    self.isConnected = YES;
    connectCompletion = [self consumeConnectCompletion];
    }
    if (connectCompletion != nil) {
    connectCompletion(nil);
    }
    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidConnect)]) {
    [self.delegate webSocketManagerDidConnect];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didFailWithError:(NSError *)error {
    WLAgentSkillsWebSocketConnectCompletion connectCompletion = nil;
    @synchronized(self) {
    self.isConnecting = NO;
    self.isConnected = NO;
    connectCompletion = [self consumeConnectCompletion];
    }
    if (connectCompletion != nil) {
    connectCompletion(error ?: [self webSocketErrorWithMessage:@"WebSocket connect failed"]);
    }

    WLAgentSkillsSessionError *sessionError = [[WLAgentSkillsSessionError alloc] initWithCode:@"6000"
                                                                                        message:error.localizedDescription ?: @"WebSocket connect failed"];
    [self notifyAllError:sessionError];

    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidDisconnectWithError:)]) {
    [self.delegate webSocketManagerDidDisconnectWithError:error];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didCloseWithCode:(NSInteger)code reason:(NSString *)reason wasClean:(BOOL)wasClean {
    WLAgentSkillsWebSocketConnectCompletion connectCompletion = nil;
    @synchronized(self) {
    self.isConnecting = NO;
    self.isConnected = NO;
    connectCompletion = [self consumeConnectCompletion];
    }

    NSString *closeReason = (reason != nil && reason.length > 0) ? reason : @"WebSocket closed";
    if (connectCompletion != nil) {
    connectCompletion([self webSocketErrorWithMessage:closeReason]);
    }
    [self notifyAllClose:closeReason];

    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidDisconnectWithError:)]) {
    [self.delegate webSocketManagerDidDisconnectWithError:nil];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessage:(id)message {
    [self handleRawMessage:message];
}

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessageWithString:(NSString *)string {
    [self handleRawMessage:string];
}

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessageWithData:(NSData *)data {
    [self handleRawMessage:data];
}

- (void)handleRawMessage:(id)message {
    NSDictionary *json = nil;

    if ([message isKindOfClass:[NSString class]]) {
    NSData *data = [(NSString *)message dataUsingEncoding:NSUTF8StringEncoding];
    if (data != nil) {
        json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    }
    } else if ([message isKindOfClass:[NSData class]]) {
    json = [NSJSONSerialization JSONObjectWithData:(NSData *)message options:0 error:nil];
    } else if ([message isKindOfClass:[NSDictionary class]]) {
    json = message;
    }

    if (![json isKindOfClass:[NSDictionary class]]) {
    return;
    }

    WLAgentSkillsStreamMessage *streamMessage = [[WLAgentSkillsStreamMessage alloc] initWithDictionary:json];
    streamMessage.raw = json;

    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidReceiveMessage:)]) {
    [self.delegate webSocketManagerDidReceiveMessage:streamMessage];
    }

    // 这三类事件不关联具体会话，直接通过基座全局广播分发。
    if ([self isGlobalBroadcastEventType:streamMessage.type]) {
    [self broadcastGlobalWebSocketEvent:streamMessage];
    return;
    }

    NSString *sessionKey = streamMessage.welinkSessionId;
    if (sessionKey == nil || sessionKey.length == 0) {
    return;
    }

    WLAgentSkillsSocketListener *listener = nil;
    @synchronized(self) {
    listener = self.listeners[sessionKey];
    }

    if (listener.onMessage != nil) {
    listener.onMessage(streamMessage);
    }
}

- (BOOL)isGlobalBroadcastEventType:(NSString *)type {
    return [type isEqualToString:@"session.deleted"]
        || [type isEqualToString:@"agent.online"]
        || [type isEqualToString:@"agent.offline"];
}

- (void)broadcastGlobalWebSocketEvent:(WLAgentSkillsStreamMessage *)message {
    (void)message;
    // 待接入：调用基座广播能力分发与会话无关的 WebSocket 事件。
}

#pragma mark - Notify Helpers

- (void)notifyAllError:(WLAgentSkillsSessionError *)error {
    NSArray<WLAgentSkillsSocketListener *> *allListeners = [self flattenedListeners];
    for (WLAgentSkillsSocketListener *listener in allListeners) {
    if (listener.onError != nil) {
        listener.onError(error);
    }
    }
}

- (void)notifyAllClose:(NSString *)reason {
    NSArray<WLAgentSkillsSocketListener *> *allListeners = [self flattenedListeners];
    for (WLAgentSkillsSocketListener *listener in allListeners) {
    if (listener.onClose != nil) {
        listener.onClose(reason);
    }
    }
}

- (NSArray<WLAgentSkillsSocketListener *> *)flattenedListeners {
    NSMutableArray<WLAgentSkillsSocketListener *> *result = [NSMutableArray array];
    @synchronized(self) {
    for (WLAgentSkillsSocketListener *value in self.listeners.allValues) {
        [result addObject:value];
    }
    }
    return result;
}

- (nullable WLAgentSkillsWebSocketConnectCompletion)consumeConnectCompletion {
    WLAgentSkillsWebSocketConnectCompletion completion = self.connectCompletion;
    self.connectCompletion = nil;
    return completion;
}

- (NSError *)webSocketErrorWithMessage:(NSString *)message {
    return [NSError errorWithDomain:NSURLErrorDomain
                               code:6000
                           userInfo:@{
        NSLocalizedDescriptionKey : message ?: @"WebSocket connect failed"
    }];
}

@end
