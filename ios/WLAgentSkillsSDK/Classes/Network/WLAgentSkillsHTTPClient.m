//
//  WLAgentSkillsHTTPClient.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsConfig.h"
#import "WLAgentSkillsTypes.h"
@import AFNetworking;

static NSString * const WLAgentSkillsHTTPErrorDomain = @"com.wlagentskills.sdk.http";

@interface WLAgentSkillsHTTPClient ()

@property (nonatomic, strong) AFHTTPSessionManager *sessionManager;
@property (nonatomic, copy) NSString *configuredBaseURL;

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
        [self rebuildSessionManager];
    }
    return self;
}

- (void)reloadConfiguration {
    [self rebuildSessionManager];
}

#pragma mark - Public APIs

- (void)createSessionWithAK:(nullable NSString *)ak
                                            title:(nullable NSString *)title
                                    imGroupId:(NSString *)imGroupId
                                        success:(WLAgentSkillsHTTPSuccessBlock)success
                                        failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSMutableDictionary *parameters = [@{ @"imGroupId" : imGroupId } mutableCopy];
    if (ak.length > 0) {
        parameters[@"ak"] = ak;
    }
    if (title.length > 0) {
        parameters[@"title"] = title;
    }

    [self POST:@"/api/skill/sessions" parameters:parameters success:success failure:failure];
}

- (void)getSessionsWithImGroupId:(nullable NSString *)imGroupId
                                                            ak:(nullable NSString *)ak
                                                        status:(nullable NSString *)status
                                                            page:(nullable NSNumber *)page
                                                            size:(nullable NSNumber *)size
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSMutableDictionary *parameters = [NSMutableDictionary dictionary];
    if (imGroupId.length > 0) {
        parameters[@"imGroupId"] = imGroupId;
    }
    if (ak.length > 0) {
        parameters[@"ak"] = ak;
    }
    if (status.length > 0) {
        parameters[@"status"] = status;
    }
    if (page != nil) {
        parameters[@"page"] = page;
    }
    if (size != nil) {
        parameters[@"size"] = size;
    }

    [self GET:@"/api/skill/sessions" parameters:parameters success:success failure:failure];
}

- (void)getSessionWithSessionId:(NSString *)welinkSessionId
                                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                                failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@", welinkSessionId];
    [self GET:path parameters:nil success:success failure:failure];
}

- (void)getMessagesWithSessionId:(NSString *)welinkSessionId
                                                        page:(NSNumber *)page
                                                        size:(NSNumber *)size
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages", welinkSessionId];
    NSDictionary *parameters = @{
        @"page" : page ?: @0,
        @"size" : size ?: @50
    };
    [self GET:path parameters:parameters success:success failure:failure];
}

- (void)sendMessageWithSessionId:(NSString *)welinkSessionId
                                                    content:(NSString *)content
                                            toolCallId:(nullable NSString *)toolCallId
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages", welinkSessionId];
    NSMutableDictionary *parameters = [@{ @"content" : content } mutableCopy];
    if (toolCallId.length > 0) {
        parameters[@"toolCallId"] = toolCallId;
    }
    [self POST:path parameters:parameters success:success failure:failure];
}

- (void)abortSessionWithSessionId:(NSString *)welinkSessionId
                                                    success:(WLAgentSkillsHTTPSuccessBlock)success
                                                    failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/abort", welinkSessionId];
    [self POST:path parameters:nil success:success failure:failure];
}

- (void)replyPermissionWithSessionId:(NSString *)welinkSessionId
                                                            permId:(NSString *)permId
                                                        response:(NSString *)response
                                                            success:(WLAgentSkillsHTTPSuccessBlock)success
                                                            failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/permissions/%@", welinkSessionId, permId];
    NSDictionary *parameters = @{ @"response" : response };
    [self POST:path parameters:parameters success:success failure:failure];
}

- (void)sendToIMWithSessionId:(NSString *)welinkSessionId
                                                content:(NSString *)content
                                                chatId:(nullable NSString *)chatId
                                                success:(WLAgentSkillsHTTPSuccessBlock)success
                                                failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSString *path = [NSString stringWithFormat:@"/api/skill/sessions/%@/send-to-im", welinkSessionId];
    NSMutableDictionary *parameters = [@{ @"content" : content } mutableCopy];
    if (chatId.length > 0) {
        parameters[@"chatId"] = chatId;
    }
    [self POST:path parameters:parameters success:success failure:failure];
}

#pragma mark - Internal HTTP

- (void)GET:(NSString *)path
    parameters:(nullable NSDictionary *)parameters
        success:(WLAgentSkillsHTTPSuccessBlock)success
        failure:(WLAgentSkillsHTTPFailureBlock)failure {
    [self ensureConfigurationUpToDate];
    [self.sessionManager GET:path
                                parameters:parameters
                                        headers:nil
                                    progress:nil
                                        success:^(__unused NSURLSessionDataTask *task, id responseObject) {
        [self handleResponseObject:responseObject success:success failure:failure];
    }
                                        failure:^(__unused NSURLSessionDataTask *task, NSError *error) {
        [self handleFailureError:error failure:failure];
    }];
}

- (void)POST:(NSString *)path
    parameters:(nullable NSDictionary *)parameters
            success:(WLAgentSkillsHTTPSuccessBlock)success
            failure:(WLAgentSkillsHTTPFailureBlock)failure {
    [self ensureConfigurationUpToDate];
    [self.sessionManager POST:path
                                    parameters:parameters
                                        headers:nil
                                        progress:nil
                                        success:^(__unused NSURLSessionDataTask *task, id responseObject) {
        [self handleResponseObject:responseObject success:success failure:failure];
    }
                                        failure:^(__unused NSURLSessionDataTask *task, NSError *error) {
        [self handleFailureError:error failure:failure];
    }];
}

- (void)handleResponseObject:(id)responseObject
                                            success:(WLAgentSkillsHTTPSuccessBlock)success
                                            failure:(WLAgentSkillsHTTPFailureBlock)failure {
    if (![responseObject isKindOfClass:[NSDictionary class]]) {
        if (success) {
            success(responseObject);
        }
        return;
    }

    NSDictionary *dict = (NSDictionary *)responseObject;
    NSNumber *code = dict[@"code"];
    if (code != nil) {
        if (code.integerValue == 0) {
            if (success) {
                id data = dict[@"data"];
                success(data);
            }
            return;
        }

        NSString *message = [dict[@"errormsg"] isKindOfClass:[NSString class]] ? dict[@"errormsg"] : @"Service error";
        NSError *error = [NSError errorWithDomain:WLAgentSkillsHTTPErrorDomain
                                                                                    code:code.integerValue
                                                                            userInfo:@{
            NSLocalizedDescriptionKey : message,
            WLAgentSkillsErrorCodeKey : code,
            WLAgentSkillsErrorMessageKey : message
        }];
        if (failure) {
            failure(error);
        }
        return;
    }

    if (success) {
        success(dict);
    }
}

- (void)handleFailureError:(NSError *)error failure:(WLAgentSkillsHTTPFailureBlock)failure {
    NSData *responseData = error.userInfo[AFNetworkingOperationFailingURLResponseDataErrorKey];
    if (responseData.length > 0) {
        NSDictionary *json = [NSJSONSerialization JSONObjectWithData:responseData options:0 error:nil];
        if ([json isKindOfClass:[NSDictionary class]]) {
            NSString *message = @"Network request failed";
            NSInteger code = error.code;

            if (json[@"errormsg"]) {
                message = [json[@"errormsg"] description];
            } else if (json[@"message"]) {
                message = [json[@"message"] description];
            }

            if (json[@"code"] != nil) {
                code = [json[@"code"] integerValue];
            }

            NSError *wrapped = [NSError errorWithDomain:error.domain
                                                                                            code:code
                                                                                    userInfo:@{
                NSLocalizedDescriptionKey : message,
                WLAgentSkillsErrorCodeKey : @(code),
                WLAgentSkillsErrorMessageKey : message
            }];
            if (failure) {
                failure(wrapped);
            }
            return;
        }
    }

    if (failure) {
        failure(error);
    }
}

- (void)ensureConfigurationUpToDate {
    NSString *baseURL = [WLAgentSkillsConfig sharedConfig].baseURL;
    if (![baseURL isEqualToString:self.configuredBaseURL]) {
        [self rebuildSessionManager];
    }
}

- (void)rebuildSessionManager {
    WLAgentSkillsConfig *config = [WLAgentSkillsConfig sharedConfig];
    NSURL *baseURL = [NSURL URLWithString:config.baseURL];
    self.sessionManager = [[AFHTTPSessionManager alloc] initWithBaseURL:baseURL];
    self.sessionManager.requestSerializer = [AFJSONRequestSerializer serializer];
    self.sessionManager.responseSerializer = [AFJSONResponseSerializer serializer];
    self.sessionManager.requestSerializer.timeoutInterval = config.requestTimeout;
    [self.sessionManager.requestSerializer setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [self.sessionManager.requestSerializer setValue:@"application/json" forHTTPHeaderField:@"Accept"];
    self.configuredBaseURL = config.baseURL;
}

@end
