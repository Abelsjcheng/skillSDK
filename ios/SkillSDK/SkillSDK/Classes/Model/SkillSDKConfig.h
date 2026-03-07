//
//  SkillSDKConfig.h
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SkillSDKConfig : NSObject

@property (nonatomic, copy, readonly) NSString *baseURL;
@property (nonatomic, copy, readonly) NSString *wsURL;
@property (nonatomic, assign, readonly) NSInteger skillDefinitionId;

+ (instancetype)sharedConfig;

- (void)configureWithBaseURL:(NSString *)baseURL;
- (void)configureWithBaseURL:(NSString *)baseURL wsURL:(NSString *)wsURL;
- (void)configureWithBaseURL:(NSString *)baseURL skillDefinitionId:(NSInteger)skillDefinitionId;
- (void)configureWithBaseURL:(NSString *)baseURL wsURL:(NSString *)wsURL skillDefinitionId:(NSInteger)skillDefinitionId;

@end

NS_ASSUME_NONNULL_END
