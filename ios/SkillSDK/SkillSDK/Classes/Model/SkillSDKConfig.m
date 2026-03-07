//
//  SkillSDKConfig.m
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import "SkillSDKConfig.h"

@implementation SkillSDKConfig {
    NSString *_baseURL;
    NSString *_wsURL;
    NSInteger _skillDefinitionId;
}

+ (instancetype)sharedConfig {
    static SkillSDKConfig *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SkillSDKConfig alloc] init];
    });
    return instance;
}

- (void)configureWithBaseURL:(NSString *)baseURL {
    [self configureWithBaseURL:baseURL wsURL:nil skillDefinitionId:0];
}

- (void)configureWithBaseURL:(NSString *)baseURL wsURL:(NSString *)wsURL {
    [self configureWithBaseURL:baseURL wsURL:wsURL skillDefinitionId:0];
}

- (void)configureWithBaseURL:(NSString *)baseURL skillDefinitionId:(NSInteger)skillDefinitionId {
    [self configureWithBaseURL:baseURL wsURL:nil skillDefinitionId:skillDefinitionId];
}

- (void)configureWithBaseURL:(NSString *)baseURL wsURL:(NSString *)wsURL skillDefinitionId:(NSInteger)skillDefinitionId {
    _baseURL = [baseURL copy];
    _wsURL = [wsURL copy];
    _skillDefinitionId = skillDefinitionId;
}

- (NSString *)baseURL {
    return _baseURL;
}

- (NSString *)wsURL {
    return _wsURL;
}

- (NSInteger)skillDefinitionId {
    return _skillDefinitionId;
}

@end
