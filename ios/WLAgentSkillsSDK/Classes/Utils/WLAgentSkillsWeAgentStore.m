//
//  WLAgentSkillsWeAgentStore.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsWeAgentStore.h"

static NSString * const WLAgentSkillsMockUserId = @"mock_user_id";
static NSString * const WLAgentSkillsCurrentDetailKey = @"current_we_agent_detail";
static NSString * const WLAgentSkillsListCacheKey = @"we_agent_list_cache";
static NSString * const WLAgentSkillsDetailsCacheKey = @"we_agent_details";
static NSString * const WLAgentSkillsAssistantGraySingleCacheKey = @"assistant_gray_single_cache";

@interface WLAgentSkillsWeAgentStore ()

@property (nonatomic, copy) NSString *prefix;
@property (nonatomic, strong) dispatch_queue_t assistantGraySingleQueue;

@end

@implementation WLAgentSkillsWeAgentStore

+ (instancetype)sharedStore {
    static WLAgentSkillsWeAgentStore *sharedStore = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedStore = [[WLAgentSkillsWeAgentStore alloc] init];
    });
    return sharedStore;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _prefix = [NSString stringWithFormat:@"skill_sdk_we_agent_%@_", WLAgentSkillsMockUserId];
        _assistantGraySingleQueue = dispatch_queue_create("com.opencode.skill.assistantGraySingleQueue", DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

- (dispatch_queue_t)assistantGraySingleQueue {
    return _assistantGraySingleQueue;
}

- (void)saveCurrentWeAgentDetailDictionary:(nullable NSDictionary *)dictionary {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsCurrentDetailKey];
    if (dictionary == nil) {
        [defaults removeObjectForKey:key];
    } else {
        [defaults setObject:dictionary forKey:key];
    }
    [defaults synchronize];
}

- (nullable NSDictionary *)loadCurrentWeAgentDetailDictionary {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsCurrentDetailKey];
    id value = [defaults objectForKey:key];
    if (![value isKindOfClass:[NSDictionary class]]) {
        return nil;
    }
    return (NSDictionary *)value;
}

- (void)saveWeAgentListDictionaries:(NSArray<NSDictionary *> *)dictionaries {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsListCacheKey];
    [defaults setObject:dictionaries forKey:key];
    [defaults synchronize];
}

- (BOOL)hasWeAgentListCache {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsListCacheKey];
    id value = [defaults objectForKey:key];
    return [value isKindOfClass:[NSArray class]];
}

- (NSArray<NSDictionary *> *)loadWeAgentListDictionaries {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsListCacheKey];
    id value = [defaults objectForKey:key];
    if (![value isKindOfClass:[NSArray class]]) {
        return @[];
    }

    NSMutableArray<NSDictionary *> *result = [NSMutableArray array];
    for (id item in (NSArray *)value) {
        if ([item isKindOfClass:[NSDictionary class]]) {
            [result addObject:(NSDictionary *)item];
        }
    }
    return [result copy];
}

- (void)saveWeAgentDetailDictionary:(nullable NSDictionary *)dictionary
                  forPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0 || dictionary == nil) {
        return;
    }

    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsDetailsCacheKey];
    NSMutableDictionary *cache = [[self loadWeAgentDetailsCacheDictionary] mutableCopy];
    if (cache == nil) {
        cache = [NSMutableDictionary dictionary];
    }

    cache[partnerAccount] = dictionary;

    if (cache.count == 0) {
        [defaults removeObjectForKey:key];
    } else {
        [defaults setObject:cache forKey:key];
    }
    [defaults synchronize];
}

- (nullable NSDictionary *)loadWeAgentDetailDictionaryForPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0) {
        return nil;
    }

    NSDictionary *cache = [self loadWeAgentDetailsCacheDictionary];
    id value = cache[partnerAccount];
    if (![value isKindOfClass:[NSDictionary class]]) {
        return nil;
    }
    return (NSDictionary *)value;
}

/// 汇总详情缓存和当前详情中的账号，去重后用于冷启动批量补偿查询。
- (NSArray<NSString *> *)cachedWeAgentPartnerAccounts {
    NSMutableOrderedSet<NSString *> *accounts = [NSMutableOrderedSet orderedSet];
    for (NSString *key in [self loadWeAgentDetailsCacheDictionary].allKeys) {
        NSString *normalized = [self normalizedStringValue:key];
        if (normalized.length > 0) {
            [accounts addObject:normalized];
        }
    }
    NSString *currentPartnerAccount =
        [self normalizedStringValue:[self loadCurrentWeAgentDetailDictionary][@"partnerAccount"]];
    if (currentPartnerAccount.length > 0) {
        [accounts addObject:currentPartnerAccount];
    }
    return accounts.array;
}

/// 仅覆盖已存在的详情缓存；若目标是当前助理，也同步覆盖当前详情。
/// 不新增缓存，避免迟到更新恢复已经删除的助理。
- (void)replaceCachedWeAgentDetailIfPresent:(NSDictionary *)dictionary
                          forPartnerAccount:(NSString *)partnerAccount {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsDetailsCacheKey];
    NSMutableDictionary *cache = [[self loadWeAgentDetailsCacheDictionary] mutableCopy];
    if (cache[partnerAccount] != nil) {
        cache[partnerAccount] = dictionary;
        [defaults setObject:cache forKey:key];
        [defaults synchronize];
    }
    NSDictionary *currentDetail = [self loadCurrentWeAgentDetailDictionary];
    NSString *currentPartnerAccount = [self normalizedStringValue:currentDetail[@"partnerAccount"]];
    if ([currentPartnerAccount isEqualToString:partnerAccount]) {
        [self saveCurrentWeAgentDetailDictionary:dictionary];
    }
}

/// 按账号幂等删除详情缓存，账号为空或目标不存在时不写入持久化存储。
- (void)removeWeAgentDetailForPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0) {
        return;
    }
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsDetailsCacheKey];
    NSMutableDictionary *cache = [[self loadWeAgentDetailsCacheDictionary] mutableCopy];
    if (cache[partnerAccount] == nil) {
        return;
    }
    [cache removeObjectForKey:partnerAccount];
    if (cache.count == 0) {
        [defaults removeObjectForKey:key];
    } else {
        [defaults setObject:cache forKey:key];
    }
    [defaults synchronize];
}

/// 从已有列表缓存中过滤目标账号并回写；没有列表缓存时保持原状态。
- (void)removeWeAgentFromListForPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0 || ![self hasWeAgentListCache]) {
        return;
    }
    NSArray<NSDictionary *> *list = [self loadWeAgentListDictionaries];
    NSMutableArray<NSDictionary *> *nextList = [NSMutableArray array];
    for (NSDictionary *item in list) {
        NSString *itemPartnerAccount = [self normalizedStringValue:item[@"partnerAccount"]];
        if (![itemPartnerAccount isEqualToString:partnerAccount]) {
            [nextList addObject:item];
        }
    }
    [self saveWeAgentListDictionaries:nextList];
}

- (void)updateCachedWeAgentDetailsWithPartnerAccount:(nullable NSString *)partnerAccount
                                                name:(NSString *)name
                                                icon:(NSString *)icon
                                         description:(NSString *)description {
    NSDictionary *currentDetail = [self loadCurrentWeAgentDetailDictionary];
    NSDictionary *updatedCurrentDetail = [self updatedDetailDictionaryIfMatched:currentDetail
                                                                 partnerAccount:partnerAccount
                                                                           name:name
                                                                           icon:icon
                                                                    description:description];
    if (updatedCurrentDetail != nil) {
        [self saveCurrentWeAgentDetailDictionary:updatedCurrentDetail];
    }

    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsDetailsCacheKey];
    NSMutableDictionary<NSString *, NSDictionary *> *cache =
        [[self loadWeAgentDetailsCacheDictionary] mutableCopy];
    if (cache == nil || cache.count == 0) {
        return;
    }

    BOOL updated = NO;
    if (partnerAccount.length > 0) {
        NSDictionary *cachedDetail = cache[partnerAccount];
        NSDictionary *updatedDetail = [self updatedDetailDictionaryIfMatched:cachedDetail
                                                              partnerAccount:partnerAccount
                                                                        name:name
                                                                        icon:icon
                                                                 description:description];
        if (updatedDetail != nil) {
            cache[partnerAccount] = updatedDetail;
            updated = YES;
        }
    }

    if (!updated) {
        return;
    }
    [defaults setObject:cache forKey:key];
    [defaults synchronize];
}

- (nullable NSNumber *)loadAssistantGraySingleForPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0) {
        return nil;
    }
    __block NSNumber *result = nil;
    dispatch_sync(self.assistantGraySingleQueue, ^{
        NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
        NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsAssistantGraySingleCacheKey];
        id value = [defaults objectForKey:key];
        if (![value isKindOfClass:[NSDictionary class]]) {
            return;
        }
        id grayValue = ((NSDictionary *)value)[partnerAccount];
        if ([grayValue isKindOfClass:[NSNumber class]]) {
            result = (NSNumber *)grayValue;
        }
    });
    return result;
}

- (void)saveAssistantGraySingle:(BOOL)value forPartnerAccount:(NSString *)partnerAccount {
    if (partnerAccount.length == 0) {
        return;
    }
    dispatch_sync(self.assistantGraySingleQueue, ^{
        NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
        NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsAssistantGraySingleCacheKey];
        NSMutableDictionary *cache = [NSMutableDictionary dictionary];
        id rawValue = [defaults objectForKey:key];
        if ([rawValue isKindOfClass:[NSDictionary class]]) {
            [cache addEntriesFromDictionary:(NSDictionary *)rawValue];
        }
        cache[partnerAccount] = @(value);
        [defaults setObject:cache forKey:key];
        [defaults synchronize];
    });
}

/// 读取持久化的完整助理详情缓存，并过滤非法键值后返回。
- (NSDictionary<NSString *, NSDictionary *> *)loadWeAgentDetailsCacheDictionary {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self.prefix stringByAppendingString:WLAgentSkillsDetailsCacheKey];
    id value = [defaults objectForKey:key];
    if (![value isKindOfClass:[NSDictionary class]]) {
        return @{};
    }

    NSMutableDictionary<NSString *, NSDictionary *> *result = [NSMutableDictionary dictionary];
    NSDictionary *rawDictionary = (NSDictionary *)value;
    for (id rawKey in rawDictionary) {
        if (![rawKey isKindOfClass:[NSString class]]) {
            continue;
        }
        id item = rawDictionary[rawKey];
        if ([item isKindOfClass:[NSDictionary class]]) {
            result[(NSString *)rawKey] = (NSDictionary *)item;
        }
    }
    return [result copy];
}

- (nullable NSDictionary *)updatedDetailDictionaryIfMatched:(nullable NSDictionary *)dictionary
                                             partnerAccount:(nullable NSString *)partnerAccount
                                                       name:(NSString *)name
                                                       icon:(NSString *)icon
                                                description:(NSString *)description {
    if (![dictionary isKindOfClass:[NSDictionary class]]) {
        return nil;
    }

    NSString *normalizedPartnerAccount = [self normalizedStringValue:partnerAccount];
    if (normalizedPartnerAccount != nil) {
        NSString *cachedPartnerAccount = [self normalizedStringValue:dictionary[@"partnerAccount"]];
        if (![normalizedPartnerAccount isEqualToString:cachedPartnerAccount]) {
            return nil;
        }
    } else {
        return nil;
    }

    NSMutableDictionary *updatedDictionary = [dictionary mutableCopy];
    updatedDictionary[@"name"] = name;
    updatedDictionary[@"icon"] = icon;
    updatedDictionary[@"desc"] = description;
    updatedDictionary[@"description"] = description;
    return [updatedDictionary copy];
}

- (nullable NSString *)normalizedStringValue:(nullable id)value {
    if (![value isKindOfClass:[NSString class]]) {
        return nil;
    }
    NSString *trimmed = [(NSString *)value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    return trimmed.length > 0 ? trimmed : nil;
}

@end
