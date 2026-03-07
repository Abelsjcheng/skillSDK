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
        _webSocketURL = @"ws://localhost:8082/ws/skill/stream";
        _requestTimeout = 30.0;
        _webSocketTimeout = 60.0;
        _debugMode = NO;
    }
    return self;
}

- (void)configureWithBaseURL:(NSString *)baseURL {
    self.baseURL = baseURL;
    self.webSocketURL = [NSString stringWithFormat:@"%@/ws/skill/stream", baseURL];
}

@end