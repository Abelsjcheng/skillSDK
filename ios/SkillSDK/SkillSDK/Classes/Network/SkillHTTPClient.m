//
//  SkillHTTPClient.m
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import "SkillHTTPClient.h"
#import "SkillSDKConfig.h"
#import <AFNetworking/AFNetworking.h>

@implementation SkillHTTPClient {
    AFHTTPSessionManager *_manager;
}

+ (instancetype)sharedClient {
    static SkillHTTPClient *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SkillHTTPClient alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _manager = [AFHTTPSessionManager manager];
        _manager.requestSerializer = [AFJSONRequestSerializer serializer];
        _manager.responseSerializer = [AFHTTPResponseSerializer serializer];
        _manager.requestSerializer.timeoutInterval = 30.0;
    }
    return self;
}

- (void)GET:(NSString *)URLString parameters:(NSDictionary *)parameters success:(SkillHTTPSuccess)success failure:(SkillHTTPFailure)failure {
    NSString *fullURL = [self baseURL];
    if (fullURL == nil) {
        NSError *error = [NSError errorWithDomain:@"SkillSDK" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"SDK not configured. Call configureWithBaseURL first."}];
        if (failure) {
            failure(error);
        }
        return;
    }
    
    [_manager GET:[fullURL stringByAppendingString:URLString]
       parameters:parameters
         progress:nil
          success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
              if (success) {
                  NSError *error = nil;
                  id jsonObject = [NSJSONSerialization JSONObjectWithData:responseObject options:0 error:&error];
                  if (error) {
                      failure(error);
                  } else {
                      success(jsonObject);
                  }
              }
          }
          failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
              if (failure) {
                  failure(error);
              }
          }];
}

- (void)POST:(NSString *)URLString parameters:(NSDictionary *)parameters success:(SkillHTTPSuccess)success failure:(SkillHTTPFailure)failure {
    NSString *fullURL = [self baseURL];
    if (fullURL == nil) {
        NSError *error = [NSError errorWithDomain:@"SkillSDK" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"SDK not configured. Call configureWithBaseURL first."}];
        if (failure) {
            failure(error);
        }
        return;
    }
    
    [_manager POST:[fullURL stringByAppendingString:URLString]
        parameters:parameters
          progress:nil
           success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
               if (success) {
                   NSError *error = nil;
                   id jsonObject = [NSJSONSerialization JSONObjectWithData:responseObject options:0 error:&error];
                   if (error) {
                       failure(error);
                   } else {
                       success(jsonObject);
                   }
               }
           }
           failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
               if (failure) {
                   failure(error);
               }
           }];
}

- (void)DELETE:(NSString *)URLString parameters:(NSDictionary *)parameters success:(SkillHTTPSuccess)success failure:(SkillHTTPFailure)failure {
    NSString *fullURL = [self baseURL];
    if (fullURL == nil) {
        NSError *error = [NSError errorWithDomain:@"SkillSDK" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"SDK not configured. Call configureWithBaseURL first."}];
        if (failure) {
            failure(error);
        }
        return;
    }
    
    [_manager DELETE:[fullURL stringByAppendingString:URLString]
        parameters:parameters
          progress:nil
           success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
               if (success) {
                   NSError *error = nil;
                   id jsonObject = [NSJSONSerialization JSONObjectWithData:responseObject options:0 error:&error];
                   if (error) {
                       failure(error);
                   } else {
                       success(jsonObject);
                   }
               }
           }
           failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
               if (failure) {
                   failure(error);
               }
           }];
}

- (NSString *)baseURL {
    return [[SkillSDKConfig sharedConfig] baseURL];
}

@end
