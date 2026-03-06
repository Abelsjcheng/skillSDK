//
//  SkillHTTPClient.m
//  SkillSDK
//
//  HTTP 客户端实现
//

#import "SkillHTTPClient.h"

@implementation SkillHTTPClient {
    NSURLSession *_session;
}

@synthesize baseUrl = _baseUrl;

- (instancetype)initWithBaseUrl:(NSString *)baseUrl {
    self = [super init];
    if (self) {
        _baseUrl = baseUrl;
        
        NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
        configuration.HTTPAdditionalHeaders = @{
            @"Content-Type": @"application/json",
            @"Accept": @"application/json"
        };
        _session = [NSURLSession sessionWithConfiguration:configuration];
    }
    return self;
}

- (void)getWithURL:(NSString *)url
            params:(nullable NSDictionary<NSString *, id> *)params
 completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler {
    
    NSMutableString *fullUrl = [NSMutableString stringWithFormat:@"%@%@", self.baseUrl, url];
    
    if (params) {
        NSMutableArray *queryItems = [NSMutableArray array];
        for (NSString *key in params) {
            id value = params[key];
            NSString *encodedKey = [self urlEncode:key];
            NSString *encodedValue = [self urlEncode:[NSString stringWithFormat:@"%@", value]];
            [queryItems addObject:[NSString stringWithFormat:@"%@=%@", encodedKey, encodedValue]];
        }
        
        if (queryItems.count > 0) {
            [fullUrl appendFormat:@"?%@", [queryItems componentsJoinedByString:@"&"]];
        }
    }
    
    [self performRequestWithURL:fullUrl
                         method:@"GET"
                           body:nil
              completionHandler:handler];
}

- (void)postWithURL:(NSString *)url
               body:(nullable NSDictionary *)body
  completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler {
    
    NSString *fullUrl = [NSString stringWithFormat:@"%@%@", self.baseUrl, url];
    
    [self performRequestWithURL:fullUrl
                         method:@"POST"
                           body:body
              completionHandler:handler];
}

- (void)deleteWithURL:(NSString *)url
    completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler {
    
    NSString *fullUrl = [NSString stringWithFormat:@"%@%@", self.baseUrl, url];
    
    [self performRequestWithURL:fullUrl
                         method:@"DELETE"
                           body:nil
              completionHandler:handler];
}

- (void)performRequestWithURL:(NSString *)url
                       method:(NSString *)method
                         body:(nullable NSDictionary *)body
            completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler {
    
    NSURL *requestURL = [NSURL URLWithString:url];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:requestURL];
    [request setHTTPMethod:method];
    
    if (body) {
        NSError *jsonError = nil;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body
                                                           options:0
                                                             error:&jsonError];
        if (jsonError) {
            if (handler) {
                handler(nil, jsonError);
            }
            return;
        }
        [request setHTTPBody:jsonData];
    }
    
    NSURLSessionDataTask *task = [_session dataTaskWithRequest:request
                                             completionHandler:^(NSData * _Nullable data,
                                                                 NSURLResponse * _Nullable response,
                                                                 NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        NSInteger statusCode = httpResponse.statusCode;
        
        if (statusCode >= 200 && statusCode < 300) {
            NSError *jsonError = nil;
            id jsonObject = [NSJSONSerialization JSONObjectWithData:data
                                                            options:0
                                                              error:&jsonError];
            if (jsonError) {
                if (handler) {
                    handler(nil, jsonError);
                }
                return;
            }
            
            if (handler) {
                handler(jsonObject, nil);
            }
        } else {
            NSString *errorMessage = [NSString stringWithFormat:@"HTTP %ld", (long)statusCode];
            NSError *httpError = [NSError errorWithDomain:@"SkillSDKHTTPError"
                                                     code:statusCode
                                                 userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
            if (handler) {
                handler(nil, httpError);
            }
        }
    }];
    
    [task resume];
}

- (NSString *)urlEncode:(NSString *)string {
    NSString *encoded = CFBridgingRelease(CFURLCreateStringByAddingPercentEscapes(
        NULL,
        (CFStringRef)string,
        NULL,
        (CFStringRef)@"!*'();:@&=+$,/?%#[]",
        kCFStringEncodingUTF8
    ));
    return encoded ? encoded : string;
}

@end
