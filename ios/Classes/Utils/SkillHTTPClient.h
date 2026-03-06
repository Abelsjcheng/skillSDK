//
//  SkillHTTPClient.h
//  SkillSDK
//
//  HTTP 客户端头文件
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SkillHTTPClient : NSObject

@property (nonatomic, strong, readonly) NSString *baseUrl;

- (instancetype)initWithBaseUrl:(NSString *)baseUrl;

- (void)getWithURL:(NSString *)url
            params:(nullable NSDictionary<NSString *, id> *)params
         completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler;

- (void)postWithURL:(NSString *)url
               body:(nullable NSDictionary *)body
  completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler;

- (void)deleteWithURL:(NSString *)url
    completionHandler:(void(^)(id _Nullable result, NSError * _Nullable error))handler;

@end

NS_ASSUME_NONNULL_END
