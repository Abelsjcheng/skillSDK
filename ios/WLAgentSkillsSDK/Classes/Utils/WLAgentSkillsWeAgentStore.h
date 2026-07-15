//
//  WLAgentSkillsWeAgentStore.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsWeAgentStore : NSObject

+ (instancetype)sharedStore;

- (dispatch_queue_t)assistantGraySingleQueue;

- (void)saveCurrentWeAgentDetailDictionary:(nullable NSDictionary *)dictionary;
- (nullable NSDictionary *)loadCurrentWeAgentDetailDictionary;

- (void)saveWeAgentListDictionaries:(NSArray<NSDictionary *> *)dictionaries;
- (BOOL)hasWeAgentListCache;
- (NSArray<NSDictionary *> *)loadWeAgentListDictionaries;

- (void)saveWeAgentDetailDictionary:(nullable NSDictionary *)dictionary
                  forPartnerAccount:(NSString *)partnerAccount;
- (nullable NSDictionary *)loadWeAgentDetailDictionaryForPartnerAccount:(NSString *)partnerAccount;
/// 读取并校验完整助理详情缓存，供冷启动补偿和缓存更新逻辑复用。
- (NSDictionary<NSString *, NSDictionary *> *)loadWeAgentDetailsCacheDictionary;
/// 合并详情缓存键和当前助理账号，按首次出现顺序去重。
- (NSArray<NSString *> *)cachedWeAgentPartnerAccounts;
/// 仅覆盖已存在的详情缓存，并在命中当前助理时同步当前详情；不会创建新缓存。
- (void)replaceCachedWeAgentDetailIfPresent:(NSDictionary *)dictionary
                          forPartnerAccount:(NSString *)partnerAccount;
/// 按 partnerAccount 幂等删除详情缓存。
- (void)removeWeAgentDetailForPartnerAccount:(NSString *)partnerAccount;
/// 从已有列表缓存中移除指定账号的所有条目。
- (void)removeWeAgentFromListForPartnerAccount:(NSString *)partnerAccount;
- (void)updateCachedWeAgentDetailsWithPartnerAccount:(nullable NSString *)partnerAccount
                                                name:(NSString *)name
                                                icon:(NSString *)icon
                                         description:(NSString *)description;
- (nullable NSNumber *)loadAssistantGraySingleForPartnerAccount:(NSString *)partnerAccount;
- (void)saveAssistantGraySingle:(BOOL)value forPartnerAccount:(NSString *)partnerAccount;

@end

NS_ASSUME_NONNULL_END
