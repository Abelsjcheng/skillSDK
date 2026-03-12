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
        _isConnected = NO;
        _isConnecting = NO;
    }
    return self;
}

- (void)connectIfNeeded {
    @synchronized(self) {
        if (self.isConnected || self.isConnecting) {
            return;
        }

        NSString *wsURL = [WLAgentSkillsConfig sharedConfig].webSocketURL;
        NSURL *url = [NSURL URLWithString:wsURL];
        if (url == nil) {
            return;
        }

        self.isConnecting = YES;
        self.webSocket = [[SRWebSocket alloc] initWithURLRequest:[NSURLRequest requestWithURL:url]];
        self.webSocket.delegate = self;
        [self.webSocket open];
    }
}

- (void)disconnect {
    @synchronized(self) {
        if (self.webSocket != nil) {
            [self.webSocket close];
        }
        self.webSocket.delegate = nil;
        self.webSocket = nil;
        self.isConnected = NO;
        self.isConnecting = NO;
    }
}

- (BOOL)addListenerForSessionId:(NSNumber *)welinkSessionId
                                            onMessage:(WLAgentSkillsSessionMessageCallback)onMessage
                                                onError:(nullable WLAgentSkillsSessionErrorCallback)onError
                                                onClose:(nullable WLAgentSkillsSessionCloseCallback)onClose {
    if (welinkSessionId == nil || onMessage == nil) {
        return NO;
    }

    NSString *key = welinkSessionId.stringValue;
    WLAgentSkillsSocketListener *listener = [[WLAgentSkillsSocketListener alloc] init];
    listener.onMessage = onMessage;
    listener.onError = onError;
    listener.onClose = onClose;

    @synchronized(self) {
        if (self.listeners[key] != nil) {
            return NO;
        }
        self.listeners[key] = listener;
    }

    [self connectIfNeeded];
    return YES;
}

- (BOOL)removeListenerForSessionId:(NSNumber *)welinkSessionId {
    if (welinkSessionId == nil) {
        return NO;
    }

    NSString *key = welinkSessionId.stringValue;
    @synchronized(self) {
        if (self.listeners[key] == nil) {
            return NO;
        }
        [self.listeners removeObjectForKey:key];
    }
    return YES;
}

- (void)removeAllListenersForSessionId:(NSNumber *)welinkSessionId {
    if (welinkSessionId == nil) {
        return;
    }

    @synchronized(self) {
        [self.listeners removeObjectForKey:welinkSessionId.stringValue];
    }
}

- (BOOL)hasListenerForSessionId:(NSNumber *)welinkSessionId {
    if (welinkSessionId == nil) {
        return NO;
    }
    @synchronized(self) {
        return self.listeners[welinkSessionId.stringValue] != nil;
    }
}

#pragma mark - SRWebSocketDelegate

- (void)webSocketDidOpen:(SRWebSocket *)webSocket {
    @synchronized(self) {
        self.isConnecting = NO;
        self.isConnected = YES;
    }
    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidConnect)]) {
        [self.delegate webSocketManagerDidConnect];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didFailWithError:(NSError *)error {
    @synchronized(self) {
        self.isConnecting = NO;
        self.isConnected = NO;
    }

    WLAgentSkillsSessionError *sessionError = [[WLAgentSkillsSessionError alloc] initWithCode:@"6000"
                                                                                                                                                                            message:error.localizedDescription ?: @"WebSocket connect failed"];
    [self notifyAllError:sessionError];

    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidDisconnectWithError:)]) {
        [self.delegate webSocketManagerDidDisconnectWithError:error];
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didCloseWithCode:(NSInteger)code reason:(NSString *)reason wasClean:(BOOL)wasClean {
    @synchronized(self) {
        self.isConnecting = NO;
        self.isConnected = NO;
    }

    NSString *closeReason = reason.length > 0 ? reason : @"WebSocket closed";
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

    if ([self.delegate respondsToSelector:@selector(webSocketManagerDidReceiveMessage:)]) {
        [self.delegate webSocketManagerDidReceiveMessage:streamMessage];
    }

    NSString *sessionKey = streamMessage.welinkSessionId;
    if (sessionKey.length == 0) {
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

@end
