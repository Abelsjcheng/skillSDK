//
//  WLAgentSkillsWeAgentStore.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsWeAgentStore.h"

static NSString * const WLAgentSkillsMockUserId = @"mock_user_id";
static NSString * const WLAgentSkillsCurrentDetailKey = @"current_we_agent_detail";
static NSString * const WLAgentSkillsListCacheKey = @"we_agent_list_cache";

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

@end
