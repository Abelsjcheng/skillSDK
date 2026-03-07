//
//  SkillWebSocketManager.m
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import "SkillWebSocketManager.h"
#import "SkillSDKConfig.h"
#import <SocketRocket/SocketRocket.h>

@implementation SkillWebSocketManager {
    SRWebSocket *_webSocket;
    BOOL _isConnected;
    BOOL _isConnecting;
}

+ (instancetype)sharedManager {
    static SkillWebSocketManager *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SkillWebSocketManager alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _isConnected = NO;
        _isConnecting = NO;
    }
    return self;
}

- (BOOL)isConnected {
    return _isConnected;
}

- (void)connect {
    if (_isConnected || _isConnecting) {
        return;
    }
    
    NSString *wsURL = [[SkillSDKConfig sharedConfig] wsURL];
    if (wsURL == nil) {
        wsURL = [[SkillSDKConfig sharedConfig] baseURL];
        if (wsURL) {
            wsURL = [wsURL stringByReplacingOccurrencesOfString:@"http://" withString:@"ws://"];
            wsURL = [wsURL stringByReplacingOccurrencesOfString:@"https://" withString:@"wss://"];
        }
    }
    
    if (wsURL == nil) {
        NSError *error = [NSError errorWithDomain:@"SkillSDK" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"SDK not configured. Call configureWithBaseURL first."}];
        [self.webSocketDidFailWithError:error];
        return;
    }
    
    NSString *fullURL = [NSString stringWithFormat:@"%@/ws/skill/stream", wsURL];
    NSURL *url = [NSURL URLWithString:fullURL];
    
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    _webSocket = [[SRWebSocket alloc] initWithURLRequest:request];
    _webSocket.delegate = self;
    
    _isConnecting = YES;
    [_webSocket open];
}

- (void)disconnect {
    if (_webSocket) {
        [_webSocket close];
        _webSocket = nil;
    }
    _isConnected = NO;
    _isConnecting = NO;
}

- (void)sendMessage:(NSDictionary *)message {
    if (_webSocket && _isConnected) {
        NSError *error = nil;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:message options:0 error:&error];
        if (!error) {
            NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
            [_webSocket send:jsonString];
        }
    }
}

#pragma mark - SRWebSocketDelegate

- (void)webSocket:(SRWebSocket *)webSocket didOpen {
    _isConnected = YES;
    _isConnecting = NO;
    [self performSelectorOnMainThread:@selector(webSocketDidOpen) withObject:nil waitUntilDone:NO];
}

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessage:(id)message {
    if ([message isKindOfClass:[NSString class]]) {
        NSError *error = nil;
        NSData *jsonData = [message dataUsingEncoding:NSUTF8StringEncoding];
        NSDictionary *dictionary = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
        
        if (!error) {
            StreamMessage *streamMessage = [[StreamMessage alloc] initWithDictionary:dictionary];
            [self performSelectorOnMainThread:@selector(webSocketDidReceiveMessage:) withObject:streamMessage waitUntilDone:NO];
        }
    }
}

- (void)webSocket:(SRWebSocket *)webSocket didFailWithError:(NSError *)error {
    _isConnected = NO;
    _isConnecting = NO;
    [self performSelectorOnMainThread:@selector(webSocketDidFailWithError:) withObject:error waitUntilDone:NO];
}

- (void)webSocket:(SRWebSocket *)webSocket didCloseWithCode:(NSInteger)code reason:(NSString *)reason wasClean:(BOOL)wasClean {
    _isConnected = NO;
    _isConnecting = NO;
    NSString *closeReason = [NSString stringWithFormat:@"%ld: %@", (long)code, reason ?: @"Unknown"];
    [self performSelectorOnMainThread:@selector(webSocketDidCloseWithReason:) withObject:closeReason waitUntilDone:NO];
}

#pragma mark - Callback Methods (to be implemented by delegate)

- (void)webSocketDidOpen {
    // Override by delegate
}

- (void)webSocketDidReceiveMessage:(StreamMessage *)message {
    // Override by delegate
}

- (void)webSocketDidFailWithError:(NSError *)error {
    // Override by delegate
}

- (void)webSocketDidCloseWithReason:(NSString *)reason {
    // Override by delegate
}

@end
