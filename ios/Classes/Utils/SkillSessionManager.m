//
//  SkillSessionManager.m
//  SkillSDK
//
//  会话管理类实现
//

#import "SkillSessionManager.h"

@interface SkillSessionManager ()

@property (nonatomic, strong) SkillHTTPClient *httpClient;
@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, strong) NSString *baseUrl;
@property (nonatomic, strong, nullable) NSString *webSocketHost;
@property (nonatomic, strong) NSMutableDictionary<NSString *, SkillSessionInfo *> *sessions;

@end

@implementation SkillSessionManager

+ (instancetype)sharedInstance {
    static SkillSessionManager *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SkillSessionManager alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sessions = [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)initWithBaseUrl:(NSString *)baseUrl
      skillDefinitionId:(NSInteger)skillDefinitionId
        webSocketHost:(nullable NSString *)webSocketHost {
    _baseUrl = baseUrl;
    _skillDefinitionId = skillDefinitionId;
    _webSocketHost = webSocketHost;
    _httpClient = [[SkillHTTPClient alloc] initWithBaseUrl:baseUrl];
}

- (NSString *)getWebSocketHost {
    if (self.webSocketHost) {
        return self.webSocketHost;
    }
    
    NSString *host = self.baseUrl;
    host = [host stringByReplacingOccurrencesOfString:@"http://" withString:@""];
    host = [host stringByReplacingOccurrencesOfString:@"https://" withString:@""];
    
    NSRange portRange = [host rangeOfString:@":"];
    if (portRange.location != NSNotFound) {
        host = [host substringToIndex:portRange.location];
    }
    
    return host;
}

- (void)addSession:(NSString *)sessionId wsManager:(SkillWebSocketManager *)wsManager {
    SkillSessionInfo *info = [[SkillSessionInfo alloc] init];
    info.sessionId = sessionId;
    info.wsManager = wsManager;
    info.state = SkillSessionStateActive;
    
    self.sessions[sessionId] = info;
}

- (void)removeSession:(NSString *)sessionId {
    SkillSessionInfo *info = self.sessions[sessionId];
    if (info) {
        [info.wsManager close];
        [self.sessions removeObjectForKey:sessionId];
    }
}

- (nullable SkillSessionInfo *)getSession:(NSString *)sessionId {
    return self.sessions[sessionId];
}

- (NSDictionary<NSString *, SkillSessionInfo *> *)getAllSessions {
    return [self.sessions copy];
}

- (void)updateSessionState:(NSString *)sessionId state:(SkillSessionState)state {
    SkillSessionInfo *info = self.sessions[sessionId];
    if (info) {
        info.state = state;
    }
}

@end

@implementation SkillSessionInfo

@end
