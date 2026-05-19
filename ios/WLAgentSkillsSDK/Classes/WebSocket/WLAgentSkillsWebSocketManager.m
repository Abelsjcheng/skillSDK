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

@interface WLAgentSkillsSessionRoundBuffer : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, strong) NSMutableArray<WLAgentSkillsStreamMessage *> *events;
@property (nonatomic, assign) BOOL completed;
@property (nonatomic, strong) NSDate *createdAt;
@property (nonatomic, strong) NSDate *updatedAt;
@end

@implementation WLAgentSkillsSessionRoundBuffer
@end

@interface WLAgentSkillsReplayState : NSObject
@property (nonatomic, assign) BOOL replaying;
@property (nonatomic, strong) NSMutableArray<WLAgentSkillsStreamMessage *> *pendingLiveEvents;
@end

@implementation WLAgentSkillsReplayState
@end

@interface WLAgentSkillsWebSocketManager () <SRWebSocketDelegate>

@property (nonatomic, strong, nullable) SRWebSocket *webSocket;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSocketListener *> *listeners;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionRoundBuffer *> *roundBuffers;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsReplayState *> *replayStates;
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
    _roundBuffers = [NSMutableDictionary dictionary];
    _replayStates = [NSMutableDictionary dictionary];
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
    __block BOOL shouldReplay = NO;

    @synchronized(self) {
    if (self.listeners[key] != nil) {
        return NO;
    }
    WLAgentSkillsReplayState *state = [self replayStateForSessionIdLocked:key];
    WLAgentSkillsSessionRoundBuffer *buffer = self.roundBuffers[key];
    if (buffer != nil && !buffer.completed && !state.replaying) {
        // 在监听器真正接入实时分发前，先标记为“正在补发缓存”。
        // 这样可以兜住一个很小的并发窗口：若此时服务端正好又推来实时消息，
        // 该消息会先进入 pendingLiveEvents，等缓存补发完成后再顺序下发，避免乱序。
        state.replaying = YES;
        shouldReplay = YES;
    }
    self.listeners[key] = listener;
    if (shouldReplay) {
        // 真正的补发动作放到锁外执行，避免回调阻塞内部状态锁。
        // 但 replaying 需要在这里提前置为 YES，确保锁外开始补发前到达的实时消息也会被正确排队。
    }
    }

    [self connectIfNeeded];
    if (shouldReplay) {
    [self replayBufferedEventsIfNeededForSessionId:key];
    }
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

- (void)clearRoundBufferForSessionId:(NSString *)welinkSessionId {
    if (welinkSessionId == nil || welinkSessionId.length == 0) {
    return;
    }

    @synchronized(self) {
    [self.roundBuffers removeObjectForKey:welinkSessionId];
    [self.replayStates removeObjectForKey:welinkSessionId];
    }
}

- (void)clearAllRoundBuffers {
    @synchronized(self) {
    [self.roundBuffers removeAllObjects];
    [self.replayStates removeAllObjects];
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

    NSString *closeReason = (reason != nil && reason.length > 0) ? reason : @"WebSocket closed";
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
    if (sessionKey == nil || sessionKey.length == 0) {
    return;
    }

    [self appendToRoundBufferForSessionId:sessionKey message:streamMessage];
    if ([self isRoundTerminationMessage:streamMessage]) {
    [self markRoundCompletedForSessionId:sessionKey];
    }

    WLAgentSkillsSocketListener *listener = nil;
    @synchronized(self) {
    listener = self.listeners[sessionKey];
    }

    if ([self enqueueLiveEventDuringReplayForSessionId:sessionKey message:streamMessage]) {
    return;
    }

    if (listener.onMessage != nil) {
    listener.onMessage(streamMessage);
    }
}

- (void)replayBufferedEventsIfNeededForSessionId:(NSString *)welinkSessionId {
    WLAgentSkillsSessionRoundBuffer *buffer = nil;
    WLAgentSkillsReplayState *state = nil;
    WLAgentSkillsSocketListener *listener = nil;
    NSArray<WLAgentSkillsStreamMessage *> *snapshot = nil;

    @synchronized(self) {
    buffer = self.roundBuffers[welinkSessionId];
    if (buffer == nil || buffer.completed) {
        WLAgentSkillsReplayState *latestState = self.replayStates[welinkSessionId];
        latestState.replaying = NO;
        return;
    }

    state = [self replayStateForSessionIdLocked:welinkSessionId];
    if (!state.replaying) {
        return;
    }

    listener = self.listeners[welinkSessionId];
    if (listener == nil) {
        state.replaying = NO;
        return;
    }
    // 这里复制一份快照来补发，避免补发过程中实时消息继续写入原始 events，
    // 导致当前补发序列被动态改写，影响顺序稳定性。
    snapshot = [buffer.events copy];
    }

    for (WLAgentSkillsStreamMessage *message in snapshot) {
        if (listener.onMessage != nil) {
        listener.onMessage(message);
        }
    }
    [self flushPendingLiveEventsForSessionId:welinkSessionId];
}

- (void)flushPendingLiveEventsForSessionId:(NSString *)welinkSessionId {
    while (YES) {
    NSArray<WLAgentSkillsStreamMessage *> *pendingMessages = nil;
    WLAgentSkillsSocketListener *listener = nil;

    @synchronized(self) {
        WLAgentSkillsReplayState *state = self.replayStates[welinkSessionId];
        listener = self.listeners[welinkSessionId];
        if (state == nil || listener == nil || state.pendingLiveEvents.count == 0) {
        if (state != nil) {
            state.replaying = NO;
        }
        return;
        }
        pendingMessages = [state.pendingLiveEvents copy];
        [state.pendingLiveEvents removeAllObjects];
    }

    for (WLAgentSkillsStreamMessage *message in pendingMessages) {
        if (listener.onMessage != nil) {
        listener.onMessage(message);
        }
    }
    }

}

- (BOOL)enqueueLiveEventDuringReplayForSessionId:(NSString *)welinkSessionId
                                         message:(WLAgentSkillsStreamMessage *)message {
    @synchronized(self) {
    WLAgentSkillsReplayState *state = self.replayStates[welinkSessionId];
    if (state == nil || !state.replaying) {
        return NO;
    }
    // 页面层期望拿到一条连续且有序的事件流。
    // 因此补发期间到达的实时消息不能直接透传，而是先排队，补发结束后立即继续下发。
    [state.pendingLiveEvents addObject:message];
    return YES;
    }
}

- (void)appendToRoundBufferForSessionId:(NSString *)welinkSessionId
                                message:(WLAgentSkillsStreamMessage *)message {
    @synchronized(self) {
    WLAgentSkillsSessionRoundBuffer *buffer = self.roundBuffers[welinkSessionId];
    if (buffer == nil || buffer.completed) {
        buffer = [[WLAgentSkillsSessionRoundBuffer alloc] init];
        buffer.welinkSessionId = welinkSessionId;
        buffer.events = [NSMutableArray array];
        buffer.completed = NO;
        buffer.createdAt = [NSDate date];
        buffer.updatedAt = buffer.createdAt;
        self.roundBuffers[welinkSessionId] = buffer;
    }
    // SDK 层只缓存服务端原始 onmessage 事件，不在这里做消息聚合。
    // 这样页面重新注册监听时，可以先补发原始事件，再继续消费实时事件，
    // 复用现有页面侧的拼装与渲染逻辑，避免三端重复维护一套聚合代码。
    [buffer.events addObject:message];
    buffer.updatedAt = [NSDate date];
    }
}

- (void)markRoundCompletedForSessionId:(NSString *)welinkSessionId {
    @synchronized(self) {
    WLAgentSkillsSessionRoundBuffer *buffer = self.roundBuffers[welinkSessionId];
    if (buffer == nil) {
        return;
    }
    // 当前轮次一旦结束，只记录完成态，不再对后续 registerSessionListener 补发这轮缓存。
    // 如果页面在轮次结束后才打开，应走历史消息接口获取完整消息结果。
    buffer.completed = YES;
    buffer.updatedAt = [NSDate date];
    }
}

- (BOOL)isRoundTerminationMessage:(WLAgentSkillsStreamMessage *)message {
    if ([message.type isEqualToString:@"session.status"]) {
    return [message.sessionStatus isEqualToString:@"idle"];
    }
    return [message.type isEqualToString:@"session.error"]
        || [message.type isEqualToString:@"error"]
        || [message.type isEqualToString:@"agent.offline"];
}

- (WLAgentSkillsReplayState *)replayStateForSessionIdLocked:(NSString *)welinkSessionId {
    WLAgentSkillsReplayState *state = self.replayStates[welinkSessionId];
    if (state == nil) {
    state = [[WLAgentSkillsReplayState alloc] init];
    state.replaying = NO;
    state.pendingLiveEvents = [NSMutableArray array];
    self.replayStates[welinkSessionId] = state;
    }
    return state;
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
