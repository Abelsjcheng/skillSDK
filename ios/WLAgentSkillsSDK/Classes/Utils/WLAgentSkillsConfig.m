//
//  WLAgentSkillsConfig.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsConfig.h"

@implementation WLAgentSkillsConfig

+ (instancetype)sharedConfig {
    static WLAgentSkillsConfig *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[WLAgentSkillsConfig alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _baseURL = @"http://localhost:8082";
        _assistantBaseURL = @"http://localhost:8082";
        _webSocketURL = @"ws://localhost:8082/ws/skill/stream";
        _requestTimeout = 30.0;
        _webSocketTimeout = 60.0;
        _debugMode = NO;
    }
    return self;
}

- (void)configureWithBaseURL:(NSString *)baseURL {
    [self configureWithBaseURL:baseURL assistantBaseURL:nil webSocketURL:nil];
}

- (void)configureWithBaseURL:(NSString *)baseURL assistantBaseURL:(nullable NSString *)assistantBaseURL {
    [self configureWithBaseURL:baseURL assistantBaseURL:assistantBaseURL webSocketURL:nil];
}

- (void)configureWithBaseURL:(NSString *)baseURL webSocketURL:(nullable NSString *)webSocketURL {
    [self configureWithBaseURL:baseURL assistantBaseURL:nil webSocketURL:webSocketURL];
}

- (void)configureWithBaseURL:(NSString *)baseURL
            assistantBaseURL:(nullable NSString *)assistantBaseURL
                webSocketURL:(nullable NSString *)webSocketURL {
    if (baseURL == nil || baseURL.length == 0) {
        return;
    }

    NSString *trimmedBaseURL = [baseURL stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (trimmedBaseURL.length == 0) {
        return;
    }
    self.baseURL = trimmedBaseURL;
    if (assistantBaseURL != nil) {
        NSString *trimmedAssistantBaseURL =
            [assistantBaseURL stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        self.assistantBaseURL = trimmedAssistantBaseURL.length == 0 ? trimmedBaseURL : trimmedAssistantBaseURL;
    } else if (self.assistantBaseURL == nil || self.assistantBaseURL.length == 0) {
        self.assistantBaseURL = trimmedBaseURL;
    }

    if (webSocketURL != nil && webSocketURL.length > 0) {
        self.webSocketURL = webSocketURL;
        return;
    }

    NSURLComponents *components = [NSURLComponents componentsWithString:self.baseURL];
    if (components == nil || components.scheme == nil) {
        self.webSocketURL = @"ws://localhost:8082/ws/skill/stream";
        return;
    }

    NSString *scheme = components.scheme.lowercaseString;
    if ([scheme isEqualToString:@"https"]) {
        components.scheme = @"wss";
    } else {
        components.scheme = @"ws";
    }

    NSString *path = components.path ?: @"";
    if (path.length > 0 && [path hasSuffix:@"/"]) {
        path = [path substringToIndex:path.length - 1];
    }
    components.path = [path stringByAppendingString:@"/ws/skill/stream"];
    self.webSocketURL = components.string ?: @"ws://localhost:8082/ws/skill/stream";
}

@end
