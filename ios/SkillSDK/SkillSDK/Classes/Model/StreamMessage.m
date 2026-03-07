//
//  StreamMessage.m
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import "StreamMessage.h"

@implementation StreamMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _sessionId = dictionary[@"sessionId"];
        _type = [StreamMessage typeFromString:dictionary[@"type"]];
        _seq = [dictionary[@"seq"] integerValue];
        _content = dictionary[@"content"];
        _usage = dictionary[@"usage"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    
    if (self.sessionId) {
        dict[@"sessionId"] = self.sessionId;
    }
    dict[@"type"] = [StreamMessage stringFromType:self.type];
    dict[@"seq"] = @(self.seq);
    
    if ([self.content isKindOfClass:[NSString class]]) {
        dict[@"content"] = self.content;
    } else if ([self.content isKindOfClass:[NSDictionary class]]) {
        dict[@"content"] = self.content;
    }
    
    if (self.usage) {
        dict[@"usage"] = self.usage;
    }
    
    return [dict copy];
}

+ (StreamMessageType)typeFromString:(NSString *)typeString {
    if ([typeString isEqualToString:@"delta"]) {
        return StreamMessageTypeDelta;
    } else if ([typeString isEqualToString:@"done"]) {
        return StreamMessageTypeDone;
    } else if ([typeString isEqualToString:@"error"]) {
        return StreamMessageTypeError;
    } else if ([typeString isEqualToString:@"agent_offline"]) {
        return StreamMessageTypeAgentOffline;
    } else if ([typeString isEqualToString:@"agent_online"]) {
        return StreamMessageTypeAgentOnline;
    }
    return StreamMessageTypeDelta;
}

+ (NSString *)stringFromType:(StreamMessageType)type {
    switch (type) {
        case StreamMessageTypeDelta:
            return @"delta";
        case StreamMessageTypeDone:
            return @"done";
        case StreamMessageTypeError:
            return @"error";
        case StreamMessageTypeAgentOffline:
            return @"agent_offline";
        case StreamMessageTypeAgentOnline:
            return @"agent_online";
        default:
            return @"unknown";
    }
}

@end
