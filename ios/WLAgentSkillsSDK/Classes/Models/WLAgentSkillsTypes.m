//
//  WLAgentSkillsTypes.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsTypes.h"

#pragma mark - WLAgentSkillsSkillDefinition

@implementation WLAgentSkillsSkillDefinition

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _skillDefinitionId = [dictionary[@"id"] integerValue];
        _skillCode = dictionary[@"skillCode"];
        _skillName = dictionary[@"skillName"];
        _toolType = dictionary[@"toolType"];
        _skillDescription = dictionary[@"description"];
        _iconUrl = dictionary[@"iconUrl"];
        _status = dictionary[@"status"];
        _sortOrder = [dictionary[@"sortOrder"] integerValue];
        _createdAt = dictionary[@"createdAt"];
        _updatedAt = dictionary[@"updatedAt"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"id"] = @(self.skillDefinitionId);
    if (self.skillCode) dict[@"skillCode"] = self.skillCode;
    if (self.skillName) dict[@"skillName"] = self.skillName;
    if (self.toolType) dict[@"toolType"] = self.toolType;
    if (self.skillDescription) dict[@"description"] = self.skillDescription;
    if (self.iconUrl) dict[@"iconUrl"] = self.iconUrl;
    if (self.status) dict[@"status"] = self.status;
    dict[@"sortOrder"] = @(self.sortOrder);
    if (self.createdAt) dict[@"createdAt"] = self.createdAt;
    if (self.updatedAt) dict[@"updatedAt"] = self.updatedAt;
    return [dict copy];
}

@end

#pragma mark - WLAgentSkillsSession

@implementation WLAgentSkillsSession

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _sessionId = [dictionary[@"id"] integerValue];
        _userId = [dictionary[@"userId"] integerValue];
        _skillDefinitionId = [dictionary[@"skillDefinitionId"] integerValue];
        _agentId = [dictionary[@"agentId"] integerValue];
        _toolSessionId = dictionary[@"toolSessionId"];
        _title = dictionary[@"title"];
        
        NSString *statusStr = dictionary[@"status"];
        if ([statusStr isEqualToString:@"ACTIVE"]) {
            _status = WLAgentSkillsSessionStatusActive;
        } else if ([statusStr isEqualToString:@"IDLE"]) {
            _status = WLAgentSkillsSessionStatusIdle;
        } else {
            _status = WLAgentSkillsSessionStatusClosed;
        }
        
        _imChatId = dictionary[@"imChatId"];
        _createdAt = dictionary[@"createdAt"];
        _lastActiveAt = dictionary[@"lastActiveAt"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"id"] = @(self.sessionId);
    dict[@"userId"] = @(self.userId);
    dict[@"skillDefinitionId"] = @(self.skillDefinitionId);
    dict[@"agentId"] = @(self.agentId);
    if (self.toolSessionId) dict[@"toolSessionId"] = self.toolSessionId;
    if (self.title) dict[@"title"] = self.title;
    dict[@"status"] = [self statusString];
    if (self.imChatId) dict[@"imChatId"] = self.imChatId;
    if (self.createdAt) dict[@"createdAt"] = self.createdAt;
    if (self.lastActiveAt) dict[@"lastActiveAt"] = self.lastActiveAt;
    return [dict copy];
}

- (NSString *)statusString {
    switch (self.status) {
        case WLAgentSkillsSessionStatusActive:
            return @"ACTIVE";
        case WLAgentSkillsSessionStatusIdle:
            return @"IDLE";
        case WLAgentSkillsSessionStatusClosed:
            return @"CLOSED";
    }
}

@end

#pragma mark - WLAgentSkillsMessage

@implementation WLAgentSkillsMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _messageId = [dictionary[@"id"] integerValue];
        _sessionId = [dictionary[@"sessionId"] integerValue];
        _seq = [dictionary[@"seq"] integerValue];
        
        NSString *roleStr = dictionary[@"role"];
        if ([roleStr isEqualToString:@"USER"]) {
            _role = WLAgentSkillsMessageRoleUser;
        } else if ([roleStr isEqualToString:@"ASSISTANT"]) {
            _role = WLAgentSkillsMessageRoleAssistant;
        } else if ([roleStr isEqualToString:@"SYSTEM"]) {
            _role = WLAgentSkillsMessageRoleSystem;
        } else {
            _role = WLAgentSkillsMessageRoleTool;
        }
        
        _content = dictionary[@"content"];
        
        NSString *contentTypeStr = dictionary[@"contentType"];
        if ([contentTypeStr isEqualToString:@"CODE"]) {
            _contentType = WLAgentSkillsContentTypeCode;
        } else if ([contentTypeStr isEqualToString:@"PLAIN"]) {
            _contentType = WLAgentSkillsContentTypePlain;
        } else {
            _contentType = WLAgentSkillsContentTypeMarkdown;
        }
        
        _createdAt = dictionary[@"createdAt"];
        _meta = dictionary[@"meta"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"id"] = @(self.messageId);
    dict[@"sessionId"] = @(self.sessionId);
    dict[@"seq"] = @(self.seq);
    dict[@"role"] = [self roleString];
    if (self.content) dict[@"content"] = self.content;
    dict[@"contentType"] = [self contentTypeString];
    if (self.createdAt) dict[@"createdAt"] = self.createdAt;
    if (self.meta) dict[@"meta"] = self.meta;
    return [dict copy];
}

- (NSString *)roleString {
    switch (self.role) {
        case WLAgentSkillsMessageRoleUser:
            return @"USER";
        case WLAgentSkillsMessageRoleAssistant:
            return @"ASSISTANT";
        case WLAgentSkillsMessageRoleSystem:
            return @"SYSTEM";
        case WLAgentSkillsMessageRoleTool:
            return @"TOOL";
    }
}

- (NSString *)contentTypeString {
    switch (self.contentType) {
        case WLAgentSkillsContentTypeMarkdown:
            return @"MARKDOWN";
        case WLAgentSkillsContentTypeCode:
            return @"CODE";
        case WLAgentSkillsContentTypePlain:
            return @"PLAIN";
    }
}

@end

#pragma mark - WLAgentSkillsPageResult

@implementation WLAgentSkillsPageResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        NSArray *contentArray = dictionary[@"content"];
        NSMutableArray *messages = [NSMutableArray array];
        for (NSDictionary *msgDict in contentArray) {
            WLAgentSkillsMessage *msg = [[WLAgentSkillsMessage alloc] initWithDictionary:msgDict];
            [messages addObject:msg];
        }
        _content = [messages copy];
        
        _totalElements = [dictionary[@"totalElements"] integerValue];
        _totalPages = [dictionary[@"totalPages"] integerValue];
        _number = [dictionary[@"number"] integerValue];
        _size = [dictionary[@"size"] integerValue];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableArray *contentArray = [NSMutableArray array];
    for (WLAgentSkillsMessage *msg in self.content) {
        [contentArray addObject:[msg toDictionary]];
    }
    
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"content"] = contentArray;
    dict[@"totalElements"] = @(self.totalElements);
    dict[@"totalPages"] = @(self.totalPages);
    dict[@"number"] = @(self.number);
    dict[@"size"] = @(self.size);
    return [dict copy];
}

@end

#pragma mark - WLAgentSkillsStreamMessage

@implementation WLAgentSkillsStreamMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _sessionId = dictionary[@"sessionId"];
        
        NSString *typeStr = dictionary[@"type"];
        if ([typeStr isEqualToString:@"delta"]) {
            _type = WLAgentSkillsStreamMessageTypeDelta;
        } else if ([typeStr isEqualToString:@"done"]) {
            _type = WLAgentSkillsStreamMessageTypeDone;
        } else if ([typeStr isEqualToString:@"error"]) {
            _type = WLAgentSkillsStreamMessageTypeError;
        } else if ([typeStr isEqualToString:@"agent_offline"]) {
            _type = WLAgentSkillsStreamMessageTypeAgentOffline;
        } else if ([typeStr isEqualToString:@"agent_online"]) {
            _type = WLAgentSkillsStreamMessageTypeAgentOnline;
        } else {
            _type = WLAgentSkillsStreamMessageTypeDelta;
        }
        
        _seq = [dictionary[@"seq"] integerValue];
        _content = dictionary[@"content"];
        
        if ([dictionary[@"content"] isKindOfClass:[NSDictionary class]]) {
            _usage = dictionary[@"content"][@"usage"];
        }
    }
    return self;
}

- (NSString *)typeString {
    switch (self.type) {
        case WLAgentSkillsStreamMessageTypeDelta:
            return @"delta";
        case WLAgentSkillsStreamMessageTypeDone:
            return @"done";
        case WLAgentSkillsStreamMessageTypeError:
            return @"error";
        case WLAgentSkillsStreamMessageTypeAgentOffline:
            return @"agent_offline";
        case WLAgentSkillsStreamMessageTypeAgentOnline:
            return @"agent_online";
    }
}

@end

#pragma mark - WLAgentSkillsSessionError

@implementation WLAgentSkillsSessionError

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _code = dictionary[@"code"] ?: @"UNKNOWN";
        _message = dictionary[@"message"] ?: @"Unknown error";
        _timestamp = [[NSDate date] timeIntervalSince1970] * 1000;
    }
    return self;
}

@end

#pragma mark - Result Classes Implementation

#pragma mark CloseSkillResult

@implementation WLAgentSkillsCloseSkillResult
@end

#pragma mark StopSkillResult

@implementation WLAgentSkillsStopSkillResult
@end

#pragma mark RegenerateAnswerResult

@implementation WLAgentSkillsRegenerateAnswerResult
@end

#pragma mark SendMessageToIMResult

@implementation WLAgentSkillsSendMessageToIMResult
@end

#pragma mark SendMessageResult

@implementation WLAgentSkillsSendMessageResult
@end

#pragma mark ReplyPermissionResult

@implementation WLAgentSkillsReplyPermissionResult
@end

#pragma mark ControlSkillWeCodeResult

@implementation WLAgentSkillsControlSkillWeCodeResult
@end