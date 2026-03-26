//
//  WLAgentSkillsWeAgentStore.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsWeAgentStore : NSObject

+ (instancetype)sharedStore;

- (void)saveCurrentWeAgentDetailDictionary:(nullable NSDictionary *)dictionary;
- (nullable NSDictionary *)loadCurrentWeAgentDetailDictionary;

- (void)saveWeAgentListDictionaries:(NSArray<NSDictionary *> *)dictionaries;
- (NSArray<NSDictionary *> *)loadWeAgentListDictionaries;

@end

NS_ASSUME_NONNULL_END
