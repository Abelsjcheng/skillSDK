//
//  WLAgentSkillsConfig.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsConfig : NSObject

@property (nonatomic, copy) NSString *baseURL;
@property (nonatomic, copy) NSString *webSocketURL;
@property (nonatomic, assign) NSTimeInterval requestTimeout;
@property (nonatomic, assign) NSTimeInterval webSocketTimeout;
@property (nonatomic, assign) BOOL debugMode;

+ (instancetype)sharedConfig;

- (void)configureWithBaseURL:(NSString *)baseURL;
- (void)configureWithBaseURL:(NSString *)baseURL webSocketURL:(nullable NSString *)webSocketURL;

@end

NS_ASSUME_NONNULL_END
