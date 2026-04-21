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

- (void)saveWeAgentDetailDictionary:(nullable NSDictionary *)dictionary
                  forPartnerAccount:(NSString *)partnerAccount;
- (nullable NSDictionary *)loadWeAgentDetailDictionaryForPartnerAccount:(NSString *)partnerAccount;

@end

NS_ASSUME_NONNULL_END
