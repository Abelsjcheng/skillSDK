//
//  SkillWebSocketManager.m
//  SkillSDK
//
//  WebSocket 管理类实现
//

#import "SkillWebSocketManager.h"

@interface SkillWebSocketManager () <NSURLSessionWebSocketDelegate>

@property (nonatomic, strong) NSURLSessionWebSocketTask *webSocketTask;
@property (nonatomic, strong) NSURLSession *session;
@property (nonatomic, strong) NSString *sessionId;
@property (nonatomic, assign) BOOL active;
@property (nonatomic, copy) SkillStreamMessageCallback messageCallback;
@property (nonatomic, copy) SkillSessionStatusCallback statusCallback;
@property (nonatomic, assign) BOOL isClosing;

@end

@implementation SkillWebSocketManager

- (instancetype)init {
    self = [super init];
    if (self) {
        NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
        _session = [NSURLSession sessionWithConfiguration:configuration
                                                 delegate:self
                                            delegateQueue:[NSOperationQueue new]];
    }
    return self;
}

- (void)connectWithSessionId:(NSString *)sessionId
                        host:(NSString *)host
                   onMessage:(nullable SkillStreamMessageCallback)onMessage
                      onStatus:(nullable SkillSessionStatusCallback)onStatus
             completionHandler:(void(^)(BOOL success, NSError * _Nullable error))handler {
    
    _sessionId = sessionId;
    _messageCallback = onMessage;
    _statusCallback = onStatus;
    _active = NO;
    _isClosing = NO;
    
    NSString *urlString = [NSString stringWithFormat:@"ws://%@/ws/skill/stream/%@", host, sessionId];
    NSURL *url = [NSURL URLWithString:urlString];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    
    _webSocketTask = [self.session webSocketTaskWithRequest:request];
    [_webSocketTask resume];
    
    __weak typeof(self) weakSelf = self;
    [self receiveMessageWithHandler:^(BOOL success, NSError *error) {
        if (handler) {
            handler(success, error);
        }
    }];
}

- (void)receiveMessageWithHandler:(void(^)(BOOL success, NSError *error))handler {
    __weak typeof(self) weakSelf = self;
    [self.webSocketTask receiveMessageWithCompletionHandler:^(NSURLSessionWebSocketMessage * _Nullable message, NSError * _Nullable error) {
        __strong typeof(self) strongSelf = weakSelf;
        if (!strongSelf) {
            return;
        }
        
        if (error) {
            strongSelf.active = NO;
            if (!strongSelf.isClosing && strongSelf.statusCallback) {
                strongSelf.statusCallback(SkillSessionStatusStopped);
            }
            if (handler) {
                handler(NO, error);
            }
            return;
        }
        
        strongSelf.active = YES;
        
        if (message.string) {
            [strongSelf handleStringMessage:message.string];
        }
        
        if (handler) {
            handler(YES, nil);
        }
        
        [strongSelf receiveMessageWithHandler:nil];
    }];
}

- (void)handleStringMessage:(NSString *)string {
    NSError *jsonError = nil;
    NSData *jsonData = [string dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *jsonDict = [NSJSONSerialization JSONObjectWithData:jsonData
                                                             options:0
                                                               error:&jsonError];
    if (jsonError) {
        return;
    }
    
    SkillStreamMessage *streamMessage = [[SkillStreamMessage alloc] init];
    
    NSString *typeStr = jsonDict[@"type"];
    if ([typeStr isEqualToString:@"delta"]) {
        streamMessage.type = SkillStreamMessageTypeDelta;
    } else if ([typeStr isEqualToString:@"done"]) {
        streamMessage.type = SkillStreamMessageTypeDone;
    } else if ([typeStr isEqualToString:@"error"]) {
        streamMessage.type = SkillStreamMessageTypeError;
    } else if ([typeStr isEqualToString:@"agent_offline"]) {
        streamMessage.type = SkillStreamMessageTypeAgentOffline;
    } else if ([typeStr isEqualToString:@"agent_online"]) {
        streamMessage.type = SkillStreamMessageTypeAgentOnline;
    }
    
    streamMessage.seq = [jsonDict[@"seq"] integerValue];
    
    id contentObj = jsonDict[@"content"];
    if ([contentObj isKindOfClass:[NSString class]]) {
        streamMessage.content = contentObj;
    }
    
    NSDictionary *usageDict = jsonDict[@"usage"];
    if (usageDict) {
        SkillStreamMessageContent *usage = [[SkillStreamMessageContent alloc] init];
        usage.inputTokens = [usageDict[@"inputTokens"] integerValue];
        usage.outputTokens = [usageDict[@"outputTokens"] integerValue];
        streamMessage.usage = usage;
    }
    
    if (self.messageCallback) {
        self.messageCallback(streamMessage);
    }
    
    if (self.statusCallback) {
        switch (streamMessage.type) {
            case SkillStreamMessageTypeDelta:
            case SkillStreamMessageTypeAgentOnline:
                self.statusCallback(SkillSessionStatusExecuting);
                break;
            case SkillStreamMessageTypeDone:
                self.statusCallback(SkillSessionStatusCompleted);
                break;
            case SkillStreamMessageTypeError:
            case SkillStreamMessageTypeAgentOffline:
                self.statusCallback(SkillSessionStatusStopped);
                break;
        }
    }
}

- (void)close {
    self.isClosing = YES;
    if (self.webSocketTask) {
        [self.webSocketTask cancel];
        self.webSocketTask = nil;
    }
    self.active = NO;
}

- (void)setMessageCallback:(SkillStreamMessageCallback)callback {
    _messageCallback = callback;
}

- (void)setStatusCallback:(SkillSessionStatusCallback)callback {
    _statusCallback = callback;
}

#pragma mark - NSURLSessionWebSocketDelegate

- (void)URLSession:(NSURLSession *)session
      webSocketTask:(NSURLSessionWebSocketTask *)webSocketTask
didOpenWithProtocol:(nullable NSString *)protocol {
    // WebSocket 已打开
}

- (void)URLSession:(NSURLSession *)session
      webSocketTask:(NSURLSessionWebSocketTask *)webSocketTask
didCloseWithCode:(NSInteger)code
            reason:(nullable NSData *)reason {
    self.active = NO;
    if (!self.isClosing && self.statusCallback) {
        self.statusCallback(SkillSessionStatusStopped);
    }
}

@end
