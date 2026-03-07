//
//  SkillMessage.m
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import "SkillMessage.h"

@implementation SkillMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _messageId = [dictionary[@"id"] integerValue];
        _sessionId = [dictionary[@"sessionId"] integerValue];
        _seq = [dictionary[@"seq"] integerValue];
        _role = [SkillMessage roleFromString:dictionary[@"role"]];
        _content = dictionary[@"content"];
        _contentType = [SkillMessage contentTypeFromString:dictionary[@"contentType"]];
        _createdAt = dictionary[@"createdAt"];
        _meta = dictionary[@"meta"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"id": @(self.messageId),
        @"sessionId": @(self.sessionId),
        @"seq": @(self.seq),
        @"role": [SkillMessage stringFromRole:self.role],
        @"content": self.content,
        @"contentType": [SkillMessage stringFromContentType:self.contentType],
        @"createdAt": self.createdAt ?: [NSNull null],
        @"meta": self.meta ?: [NSNull null]
    };
}

+ (MessageRole)roleFromString:(NSString *)roleString {
    if ([roleString isEqualToString:@"USER"]) {
        return MessageRoleUser;
    } else if ([roleString isEqualToString:@"ASSISTANT"]) {
        return MessageRoleAssistant;
    } else if ([roleString isEqualToString:@"SYSTEM"]) {
        return MessageRoleSystem;
    } else if ([roleString isEqualToString:@"TOOL"]) {
        return MessageRoleTool;
    }
    return MessageRoleUser;
}

+ (NSString *)stringFromRole:(MessageRole)role {
    switch (role) {
        case MessageRoleUser:
            return @"USER";
        case MessageRoleAssistant:
            return @"ASSISTANT";
        case MessageRoleSystem:
            return @"SYSTEM";
        case MessageRoleTool:
            return @"TOOL";
        default:
            return @"UNKNOWN";
    }
}

+ (ContentType)contentTypeFromString:(NSString *)contentTypeString {
    if ([contentTypeString isEqualToString:@"MARKDOWN"]) {
        return ContentTypeMarkdown;
    } else if ([contentTypeString isEqualToString:@"CODE"]) {
        return ContentTypeCode;
    } else if ([contentTypeString isEqualToString:@"PLAIN"]) {
        return ContentTypePlain;
    }
    return ContentTypeMarkdown;
}

+ (NSString *)stringFromContentType:(ContentType)contentType {
    switch (contentType) {
        case ContentTypeMarkdown:
            return @"MARKDOWN";
        case ContentTypeCode:
            return @"CODE";
        case ContentTypePlain:
            return @"PLAIN";
        default:
            return @"MARKDOWN";
    }
}

@end
