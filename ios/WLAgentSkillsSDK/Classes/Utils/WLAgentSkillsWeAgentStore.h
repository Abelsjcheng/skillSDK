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
- (void)updateCachedWeAgentDetailsWithPartnerAccount:(nullable NSString *)partnerAccount
                                             robotId:(nullable NSString *)robotId
                                                name:(NSString *)name
                                                icon:(NSString *)icon
                                         description:(NSString *)description;

@end

NS_ASSUME_NONNULL_END
