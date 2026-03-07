//
//  SkillHTTPClient.h
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^SkillHTTPSuccess)(id responseObject);
typedef void (^SkillHTTPFailure)(NSError *error);

@interface SkillHTTPClient : NSObject

+ (instancetype)sharedClient;

- (void)GET:(NSString *)URLString parameters:(nullable NSDictionary *)parameters success:(SkillHTTPSuccess)success failure:(SkillHTTPFailure)failure;
- (void)POST:(NSString *)URLString parameters:(nullable NSDictionary *)parameters success:(SkillHTTPSuccess)success failure:(SkillHTTPFailure)failure;
- (void)DELETE:(NSString *)URLString parameters:(nullable NSDictionary *)parameters success:(SkillHTTPSuccess)success failure:(SkillHTTPFailure)failure;

@end

NS_ASSUME_NONNULL_END
