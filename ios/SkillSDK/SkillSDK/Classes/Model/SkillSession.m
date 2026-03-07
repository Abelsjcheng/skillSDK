//
//  SkillSDK.m
//  SkillSDK
//

#import "SkillSession.h"

@implementation SkillSession

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _sessionId = [dictionary[@"id"] integerValue];
        _userId = [dictionary[@"userId"] integerValue];
        _skillDefinitionId = [dictionary[@"skillDefinitionId"] integerValue];
        _agentId = [dictionary[@"agentId"] integerValue];
        _toolSessionId = dictionary[@"toolSessionId"];
        _title = dictionary[@"title"];
        _status = [SkillSession statusFromString:dictionary[@"status"]];
        _imChatId = dictionary[@"imChatId"];
        _createdAt = dictionary[@"createdAt"];
        _lastActiveAt = dictionary[@"lastActiveAt"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"id": @(self.sessionId),
        @"userId": @(self.userId),
        @"skillDefinitionId": @(self.skillDefinitionId),
        @"agentId": @(self.agentId),
        @"toolSessionId": self.toolSessionId ?: [NSNull null],
        @"title": self.title ?: [NSNull null],
        @"status": [SkillSession stringFromStatus:self.status],
        @"imChatId": self.imChatId ?: [NSNull null],
        @"createdAt": self.createdAt ?: [NSNull null],
        @"lastActiveAt": self.lastActiveAt ?: [NSNull null]
    };
}

+ (SessionStatus)statusFromString:(NSString *)statusString {
    if ([statusString isEqualToString:@"ACTIVE"]) {
        return SessionStatusActive;
    } else if ([statusString isEqualToString:@"IDLE"]) {
        return SessionStatusIdle;
    } else if ([statusString isEqualToString:@"CLOSED"]) {
        return SessionStatusClosed;
    } else if ([statusString isEqualToString:@"STOPPED"]) {
        return SessionStatusStopped;
    } else if ([statusString isEqualToString:@"EXECUTING"]) {
        return SessionStatusExecuting;
    }
    return SessionStatusActive;
}

+ (NSString *)stringFromStatus:(SessionStatus)status {
    switch (status) {
        case SessionStatusActive:
            return @"ACTIVE";
        case SessionStatusIdle:
            return @"IDLE";
        case SessionStatusClosed:
            return @"CLOSED";
        case SessionStatusStopped:
            return @"STOPPED";
        case SessionStatusExecuting:
            return @"EXECUTING";
        default:
            return @"UNKNOWN";
    }
}

@end
