//
//  WLAgentSkillsHTTPClient.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsConfig.h"
@import AFNetworking;

@interface WLAgentSkillsHTTPClient ()

@property (nonatomic, strong) AFHTTPSessionManager *sessionManager;

@end

@implementation WLAgentSkillsHTTPClient

+ (instancetype)sharedClient {
    static WLAgentSkillsHTTPClient *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[WLAgentSkillsHTTPClient alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        WLAgentSkillsConfig *config = [WLAgentSkillsConfig sharedConfig];
        NSURL *baseURL = [NSURL URLWithString:config.baseURL];
        _sessionManager = [[AFHTTPSessionManager alloc] initWithBaseURL:baseURL];
        _sessionManager.requestSerializer = [AFJSONRequestSerializer serializer];
        _sessionManager.responseSerializer = [AFJSONResponseSerializer serializer];
        _sessionManager.requestSerializer.timeoutInterval = config.requestTimeout;
        [_sessionManager.requestSerializer setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
        [_sessionManager.requestSerializer setValue:@"application/json" forHTTPHeaderField:@"Accept"];
    }
    return self;
}

#pragma mark - Session Management

- (void)createSessionWithUserId:(NSString *)userId
            skillDefinitionId:(NSInteger)skillDefinitionId
                        agentId:(NSInteger)agentId
                          title:(nullable NSString *)title
                       imChatId:(nullable NSString *)imChatId
                        success:(WLAgentSkillsSuccessBlock)success
                        failure:(WLAgentSkillsFailureBlock)failure {
    
    NSMutableDictionary *params = [NSMutableDictionary dictionary];
    params[@"userId"] = @([userId integerValue]);
    params[@"skillDefinitionId"] = @(skillDefinitionId);
    
    if (agentId > 0) {
        params[@"agentId"] = @(agentId);
    }
    if (title.length > 0) {
        params[@"title"] = title;
    }
    if (imChatId.length > 0) {
        params[@"imChatId"] = imChatId;
    }
    
    [self.sessionManager POST:@"/api/skill/sessions"
                   parameters:params
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)getSessionListWithUserId:(NSString *)userId
                        statuses:(nullable NSArray<NSString *> *)statuses
                            page:(NSInteger)page
                            size:(NSInteger)size
                         success:(WLAgentSkillsSuccessBlock)success
                         failure:(WLAgentSkillsFailureBlock)failure {
    
    NSMutableDictionary *params = [NSMutableDictionary dictionary];
    params[@"userId"] = @([userId integerValue]);
    params[@"page"] = @(page);
    params[@"size"] = @(size);
    
    if (statuses.count > 0) {
        params[@"statuses"] = statuses;
    }
    
    [self.sessionManager GET:@"/api/skill/sessions"
                   parameters:params
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)getSessionDetailWithSessionId:(NSString *)sessionId
                             success:(WLAgentSkillsSuccessBlock)success
                             failure:(WLAgentSkillsFailureBlock)failure {
    
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@", sessionId];
    
    [self.sessionManager GET:path
                   parameters:nil
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)closeSessionWithSessionId:(NSString *)sessionId
                         success:(WLAgentSkillsSuccessBlock)success
                         failure:(WLAgentSkillsFailureBlock)failure {
    
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@", sessionId];
    
    [self.sessionManager DELETE:path
                     parameters:nil
                        headers:nil
                        success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

#pragma mark - Message Management

- (void)sendMessageWithSessionId:(NSString *)sessionId
                         content:(NSString *)content
                         success:(WLAgentSkillsSuccessBlock)success
                         failure:(WLAgentSkillsFailureBlock)failure {
    
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId];
    NSDictionary *params = @{@"content": content};
    
    [self.sessionManager POST:path
                   parameters:params
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)getMessageHistoryWithSessionId:(NSString *)sessionId
                                  page:(NSInteger)page
                                  size:(NSInteger)size
                               success:(WLAgentSkillsSuccessBlock)success
                               failure:(WLAgentSkillsFailureBlock)failure {
    
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId];
    NSDictionary *params = @{@"page": @(page), @"size": @(size)};
    
    [self.sessionManager GET:path
                   parameters:params
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)replyPermissionWithSessionId:(NSString *)sessionId
                       permissionId:(NSString *)permissionId
                           approved:(BOOL)approved
                            success:(WLAgentSkillsSuccessBlock)success
                            failure:(WLAgentSkillsFailureBlock)failure {
    
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/permissions/%@", sessionId, permissionId];
    NSDictionary *params = @{@"approved": @(approved)};
    
    [self.sessionManager POST:path
                   parameters:params
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (void)sendMessageToIMWithSessionId:(NSString *)sessionId
                             content:(NSString *)content
                             success:(WLAgentSkillsSuccessBlock)success
                             failure:(WLAgentSkillsFailureBlock)failure {
    
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/send-to-im", sessionId];
    NSDictionary *params = @{@"content": content};
    
    [self.sessionManager POST:path
                   parameters:params
                      headers:nil
                     progress:nil
                      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        if (success) {
            success(responseObject);
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

@end