//
//  WLAgentSkillsWeAgentStore.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsWeAgentStore.h"

static NSString * const WLAgentSkillsMockUserId = @"mock_user_id";
static NSString * const WLAgentSkillsCurrentDetailKey = @"current_we_agent_detail";
static NSString * const WLAgentSkillsListCacheKey = @"we_agent_list_cache";
static NSString * const WLAgentSkillsDetailsCacheKey = @"we_agent_details";

@interface WLAgentSkillsWeAgentStore ()

@property (nonatomic, copy) NSString *prefix;

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
    }
    return self;
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

@end
