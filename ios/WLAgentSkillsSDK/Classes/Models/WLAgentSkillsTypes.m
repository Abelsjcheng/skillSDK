//
//  WLAgentSkillsTypes.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsTypes.h"

NSString * const WLAgentSkillsErrorCodeKey = @"errorCode";
NSString * const WLAgentSkillsErrorMessageKey = @"errorMessage";

static NSString *WLAgentSkillsStringValue(id value, NSString *fallback) {
    if ([value isKindOfClass:[NSString class]]) {
    return (NSString *)value;
    }
    if ([value respondsToSelector:@selector(stringValue)]) {
    return [value stringValue];
    }
    return fallback;
}

static NSNumber *WLAgentSkillsNumberValue(id value, NSNumber *fallback) {
    if ([value isKindOfClass:[NSNumber class]]) {
    return (NSNumber *)value;
    }
    if ([value isKindOfClass:[NSString class]]) {
    NSDecimalNumber *decimal = [NSDecimalNumber decimalNumberWithString:(NSString *)value];
    if (![decimal isEqualToNumber:[NSDecimalNumber notANumber]]) {
        return decimal;
    }
    }
    return fallback;
}

static NSDictionary *WLAgentSkillsDictionaryValue(id value) {
    if ([value isKindOfClass:[NSDictionary class]]) {
    return (NSDictionary *)value;
    }
    return @{};
}

static NSArray *WLAgentSkillsArrayValue(id value) {
    if ([value isKindOfClass:[NSArray class]]) {
    return (NSArray *)value;
    }
    return @[];
}

static id WLAgentSkillsNullObject(id value) {
    return value ?: [NSNull null];
}

static NSArray *WLAgentSkillsSerializeModelArray(NSArray *array) {
    NSMutableArray *result = [NSMutableArray array];
    for (id item in WLAgentSkillsArrayValue(array)) {
        if ([item respondsToSelector:@selector(toDictionary)]) {
            NSDictionary *dictionary = [item toDictionary];
            if ([dictionary isKindOfClass:[NSDictionary class]]) {
                [result addObject:dictionary];
                continue;
            }
        }
        if ([item isKindOfClass:[NSDictionary class]]) {
            [result addObject:item];
            continue;
        }
        if (item != nil && item != [NSNull null]) {
            [result addObject:item];
        }
    }
    return [result copy];
}

#pragma mark - Param Models

@implementation WLAgentSkillsCreateSessionParams
@end

@implementation WLAgentSkillsCreateNewSessionParams
@end

@implementation WLAgentSkillsHistorySessionsParams

- (instancetype)init {
    self = [super init];
    if (self) {
        _page = @0;
        _size = @50;
    }
    return self;
}

@end

@implementation WLAgentSkillsStopSkillParams
@end

@implementation WLAgentSkillsOnSessionStatusChangeParams
@end

@implementation WLAgentSkillsOnSkillWecodeStatusChangeParams
@end

@implementation WLAgentSkillsRegenerateAnswerParams
@end

@implementation WLAgentSkillsSendMessageToIMParams
@end

@implementation WLAgentSkillsGetSessionMessageParams

- (instancetype)init {
    self = [super init];
    if (self) {
    _page = @0;
    _size = @50;
    _isFirst = NO;
    }
    return self;
}

@end

@implementation WLAgentSkillsGetSessionMessageHistoryParams

- (instancetype)init {
    self = [super init];
    if (self) {
        _size = @50;
    }
    return self;
}

@end

@implementation WLAgentSkillsRegisterSessionListenerParams
@end

@implementation WLAgentSkillsUnregisterSessionListenerParams
@end

@implementation WLAgentSkillsSendMessageParams
@end

@implementation WLAgentSkillsReplyPermissionParams
@end

@implementation WLAgentSkillsControlSkillWeCodeParams
@end

@implementation WLAgentSkillsCreateDigitalTwinParams

- (void)setDescription:(id)description {
    self.descriptionValue = description;
}

@end

@implementation WLAgentSkillsPageParams

- (instancetype)init {
    self = [super init];
    if (self) {
        _pageSize = @10;
        _pageNumber = @1;
    }
    return self;
}

@end

@implementation WLAgentSkillsQueryWeAgentParams
@end

#pragma mark - Data Models

@implementation WLAgentSkillsSkillSession

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
        _userId = WLAgentSkillsStringValue(dictionary[@"userId"], @"");
        _ak = WLAgentSkillsStringValue(dictionary[@"ak"], nil);
        _title = WLAgentSkillsStringValue(dictionary[@"title"], nil);
        _imGroupId = WLAgentSkillsStringValue(dictionary[@"imGroupId"], nil);
        _bussinessDomain = WLAgentSkillsStringValue(dictionary[@"bussinessDomain"], nil);
        _bussinessType = WLAgentSkillsStringValue(dictionary[@"bussinessType"], nil);
        _bussinessId = WLAgentSkillsStringValue(dictionary[@"bussinessId"], nil);
        _assistantAccount = WLAgentSkillsStringValue(dictionary[@"assistantAccount"], nil);
        _status = WLAgentSkillsStringValue(dictionary[@"status"], @"");
        _toolSessionId = WLAgentSkillsStringValue(dictionary[@"toolSessionId"], nil);
        _createdAt = WLAgentSkillsStringValue(dictionary[@"createdAt"], @"");
        _updatedAt = WLAgentSkillsStringValue(dictionary[@"updatedAt"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"welinkSessionId" : self.welinkSessionId ?: @"",
        @"userId" : self.userId ?: @"",
        @"ak" : WLAgentSkillsNullObject(self.ak),
        @"title" : WLAgentSkillsNullObject(self.title),
        @"imGroupId" : WLAgentSkillsNullObject(self.imGroupId),
        @"bussinessDomain" : WLAgentSkillsNullObject(self.bussinessDomain),
        @"bussinessType" : WLAgentSkillsNullObject(self.bussinessType),
        @"bussinessId" : WLAgentSkillsNullObject(self.bussinessId),
        @"assistantAccount" : WLAgentSkillsNullObject(self.assistantAccount),
        @"status" : self.status ?: @"",
        @"toolSessionId" : WLAgentSkillsNullObject(self.toolSessionId),
        @"createdAt" : self.createdAt ?: @"",
        @"updatedAt" : self.updatedAt ?: @""
    };
}

@end

@implementation WLAgentSkillsAgentType

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _name = WLAgentSkillsStringValue(dictionary[@"name"], @"");
        _icon = WLAgentSkillsStringValue(dictionary[@"icon"], @"");
        _bizRobotId = WLAgentSkillsStringValue(dictionary[@"bizRobotId"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"name" : self.name ?: @"",
        @"icon" : self.icon ?: @"",
        @"bizRobotId" : self.bizRobotId ?: @""
    };
}

@end

@implementation WLAgentSkillsWeAgent

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _name = WLAgentSkillsStringValue(dictionary[@"name"], @"");
        _icon = WLAgentSkillsStringValue(dictionary[@"icon"], @"");
        _desc = WLAgentSkillsStringValue(dictionary[@"description"], WLAgentSkillsStringValue(dictionary[@"desc"], @""));
        _partnerAccount = WLAgentSkillsStringValue(dictionary[@"partnerAccount"], @"");
        _bizRobotName = WLAgentSkillsStringValue(dictionary[@"bizRobotName"], @"");
        _bizRobotNameEn = WLAgentSkillsStringValue(dictionary[@"bizRobotNameEn"], @"");
        _robotId = WLAgentSkillsStringValue(dictionary[@"robotId"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"name" : self.name ?: @"",
        @"icon" : self.icon ?: @"",
        @"description" : self.desc ?: @"",
        @"partnerAccount" : self.partnerAccount ?: @"",
        @"bizRobotName" : self.bizRobotName ?: @"",
        @"bizRobotNameEn" : self.bizRobotNameEn ?: @"",
        @"robotId" : self.robotId ?: @""
    };
}

@end

@implementation WLAgentSkillsWeAgentDetails

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _name = WLAgentSkillsStringValue(dictionary[@"name"], @"");
        _icon = WLAgentSkillsStringValue(dictionary[@"icon"], @"");
        _desc = WLAgentSkillsStringValue(dictionary[@"desc"], WLAgentSkillsStringValue(dictionary[@"description"], @""));
        _moduleId = WLAgentSkillsStringValue(dictionary[@"moduleId"], @"");
        _appKey = WLAgentSkillsStringValue(dictionary[@"appKey"], @"");
        _appSecret = WLAgentSkillsStringValue(dictionary[@"appSecret"], @"");
        _partnerAccount = WLAgentSkillsStringValue(dictionary[@"partnerAccount"], @"");
        _createdBy = WLAgentSkillsStringValue(dictionary[@"createdBy"], @"");
        _creatorName = WLAgentSkillsStringValue(dictionary[@"creatorName"], @"");
        _creatorNameEn = WLAgentSkillsStringValue(dictionary[@"creatorNameEn"], @"");
        _ownerWelinkId = WLAgentSkillsStringValue(dictionary[@"ownerWelinkId"], @"");
        _ownerName = WLAgentSkillsStringValue(dictionary[@"ownerName"], @"");
        _ownerNameEn = WLAgentSkillsStringValue(dictionary[@"ownerNameEn"], @"");
        _ownerDeptName = WLAgentSkillsStringValue(dictionary[@"ownerDeptName"], @"");
        _ownerDeptNameEn = WLAgentSkillsStringValue(dictionary[@"ownerDeptNameEn"], @"");
        _id = WLAgentSkillsStringValue(dictionary[@"id"], WLAgentSkillsStringValue(dictionary[@"robotId"], @""));
        _bizRobotName = WLAgentSkillsStringValue(dictionary[@"bizRobotName"], @"");
        _bizRobotNameEn = WLAgentSkillsStringValue(dictionary[@"bizRobotNameEn"], @"");
        _bizRobotId = WLAgentSkillsStringValue(dictionary[@"bizRobotId"], @"");
        _weCodeUrl = WLAgentSkillsStringValue(dictionary[@"weCodeUrl"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"name" : self.name ?: @"",
        @"icon" : self.icon ?: @"",
        @"desc" : self.desc ?: @"",
        @"moduleId" : self.moduleId ?: @"",
        @"appKey" : self.appKey ?: @"",
        @"appSecret" : self.appSecret ?: @"",
        @"partnerAccount" : self.partnerAccount ?: @"",
        @"createdBy" : self.createdBy ?: @"",
        @"creatorName" : self.creatorName ?: @"",
        @"creatorNameEn" : self.creatorNameEn ?: @"",
        @"ownerWelinkId" : self.ownerWelinkId ?: @"",
        @"ownerName" : self.ownerName ?: @"",
        @"ownerNameEn" : self.ownerNameEn ?: @"",
        @"ownerDeptName" : self.ownerDeptName ?: @"",
        @"ownerDeptNameEn" : self.ownerDeptNameEn ?: @"",
        @"id" : self.id ?: @"",
        @"bizRobotName" : self.bizRobotName ?: @"",
        @"bizRobotNameEn" : self.bizRobotNameEn ?: @"",
        @"bizRobotId" : self.bizRobotId ?: @"",
        @"weCodeUrl" : self.weCodeUrl ?: @""
    };
}

@end

@implementation WLAgentSkillsWeAgentUriResult

- (NSDictionary *)toDictionary {
    return @{
        @"weAgentUri" : self.weAgentUri ?: @"",
        @"assistantDetailUri" : self.assistantDetailUri ?: @"",
        @"switchAssistantUri" : self.switchAssistantUri ?: @""
    };
}

@end

@implementation WLAgentSkillsSessionMessagePart

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
    _partId = WLAgentSkillsStringValue(dictionary[@"partId"], nil);
    _partSeq = WLAgentSkillsNumberValue(dictionary[@"partSeq"], nil);
    _type = WLAgentSkillsStringValue(dictionary[@"type"], nil);
    _content = WLAgentSkillsStringValue(dictionary[@"content"], nil);
    _toolName = WLAgentSkillsStringValue(dictionary[@"toolName"], nil);
    _toolCallId = WLAgentSkillsStringValue(dictionary[@"toolCallId"], nil);
    _status = WLAgentSkillsStringValue(dictionary[@"status"], nil);
    if (_status == nil || _status.length == 0) {
        _status = WLAgentSkillsStringValue(dictionary[@"toolStatus"], nil);
    }
    _input = [dictionary[@"input"] isKindOfClass:[NSDictionary class]] ? dictionary[@"input"] : nil;
    if (_input == nil || _input.count == 0) {
        _input = [dictionary[@"toolInput"] isKindOfClass:[NSDictionary class]] ? dictionary[@"toolInput"] : nil;
    }
    _output = WLAgentSkillsStringValue(dictionary[@"output"], nil);
    if (_output == nil || _output.length == 0) {
        _output = WLAgentSkillsStringValue(dictionary[@"toolOutput"], nil);
    }
    _error = WLAgentSkillsStringValue(dictionary[@"error"], nil);
    _title = WLAgentSkillsStringValue(dictionary[@"title"], nil);
    _header = WLAgentSkillsStringValue(dictionary[@"header"], nil);
    _question = WLAgentSkillsStringValue(dictionary[@"question"], nil);
    _options = [dictionary[@"options"] isKindOfClass:[NSArray class]] ? dictionary[@"options"] : nil;
    _permissionId = WLAgentSkillsStringValue(dictionary[@"permissionId"], nil);
    _permType = WLAgentSkillsStringValue(dictionary[@"permType"], nil);
    _metadata = [dictionary[@"metadata"] isKindOfClass:[NSDictionary class]] ? dictionary[@"metadata"] : nil;
    _response = WLAgentSkillsStringValue(dictionary[@"response"], nil);
    _fileName = WLAgentSkillsStringValue(dictionary[@"fileName"], nil);
    _fileUrl = WLAgentSkillsStringValue(dictionary[@"fileUrl"], nil);
    _fileMime = WLAgentSkillsStringValue(dictionary[@"fileMime"], nil);
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dictionary = [NSMutableDictionary dictionary];
    if (self.partId != nil && self.partId.length > 0) {
    dictionary[@"partId"] = self.partId;
    }
    if (self.partSeq != nil) {
    dictionary[@"partSeq"] = self.partSeq;
    }
    if (self.type != nil && self.type.length > 0) {
    dictionary[@"type"] = self.type;
    }
    if (self.content != nil && self.content.length > 0) {
    dictionary[@"content"] = self.content;
    }
    if (self.toolName != nil && self.toolName.length > 0) {
    dictionary[@"toolName"] = self.toolName;
    }
    if (self.toolCallId != nil && self.toolCallId.length > 0) {
    dictionary[@"toolCallId"] = self.toolCallId;
    }
    if (self.status != nil && self.status.length > 0) {
    dictionary[@"status"] = self.status;
    }
    if (self.input != nil && self.input.count > 0) {
    dictionary[@"input"] = self.input;
    }
    if (self.output != nil && self.output.length > 0) {
    dictionary[@"output"] = self.output;
    }
    if (self.error != nil && self.error.length > 0) {
    dictionary[@"error"] = self.error;
    }
    if (self.title != nil && self.title.length > 0) {
    dictionary[@"title"] = self.title;
    }
    if (self.header != nil && self.header.length > 0) {
    dictionary[@"header"] = self.header;
    }
    if (self.question != nil && self.question.length > 0) {
    dictionary[@"question"] = self.question;
    }
    if (self.options != nil && self.options.count > 0) {
    dictionary[@"options"] = self.options;
    }
    if (self.permissionId != nil && self.permissionId.length > 0) {
    dictionary[@"permissionId"] = self.permissionId;
    }
    if (self.permType != nil && self.permType.length > 0) {
    dictionary[@"permType"] = self.permType;
    }
    if (self.metadata != nil && self.metadata.count > 0) {
    dictionary[@"metadata"] = self.metadata;
    }
    if (self.response != nil && self.response.length > 0) {
    dictionary[@"response"] = self.response;
    }
    if (self.fileName != nil && self.fileName.length > 0) {
    dictionary[@"fileName"] = self.fileName;
    }
    if (self.fileUrl != nil && self.fileUrl.length > 0) {
    dictionary[@"fileUrl"] = self.fileUrl;
    }
    if (self.fileMime != nil && self.fileMime.length > 0) {
    dictionary[@"fileMime"] = self.fileMime;
    }
    return dictionary;
}

@end

@implementation WLAgentSkillsSessionMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
    NSString *resolvedId = WLAgentSkillsStringValue(dictionary[@"id"], nil);
    if (resolvedId == nil || resolvedId.length == 0) {
        resolvedId = WLAgentSkillsStringValue(dictionary[@"messageId"], @"");
    }
    _id = resolvedId ?: @"";
    _seq = WLAgentSkillsNumberValue(dictionary[@"seq"], nil);
    _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
    if (_welinkSessionId == nil || _welinkSessionId.length == 0) {
        _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"sessionId"], @"");
    }
    _role = WLAgentSkillsStringValue(dictionary[@"role"], @"");
    _content = WLAgentSkillsStringValue(dictionary[@"content"], nil);
    _contentType = WLAgentSkillsStringValue(dictionary[@"contentType"], nil);
    _meta = [dictionary[@"meta"] isKindOfClass:[NSDictionary class]] ? dictionary[@"meta"] : nil;
    _messageSeq = WLAgentSkillsNumberValue(dictionary[@"messageSeq"], nil);
    _createdAt = WLAgentSkillsStringValue(dictionary[@"createdAt"], @"");

    NSMutableArray<WLAgentSkillsSessionMessagePart *> *parts = [NSMutableArray array];
    for (NSDictionary *part in WLAgentSkillsArrayValue(dictionary[@"parts"])) {
        if (![part isKindOfClass:[NSDictionary class]]) {
        continue;
        }
        [parts addObject:[[WLAgentSkillsSessionMessagePart alloc] initWithDictionary:part]];
    }
    _parts = [parts copy];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableArray *parts = [NSMutableArray array];
    for (WLAgentSkillsSessionMessagePart *part in self.parts) {
    [parts addObject:[part toDictionary]];
    }
    return @{
    @"id" : self.id ?: @"",
    @"seq" : self.seq ?: [NSNull null],
    @"welinkSessionId" : self.welinkSessionId ?: @"",
    @"role" : self.role ?: @"",
    @"content" : self.content ?: [NSNull null],
    @"contentType" : self.contentType ?: [NSNull null],
    @"meta" : self.meta ?: [NSNull null],
    @"messageSeq" : self.messageSeq ?: [NSNull null],
    @"parts" : self.parts != nil ? parts : [NSNull null],
    @"createdAt" : self.createdAt ?: @""
    };
}

@end

@implementation WLAgentSkillsPageResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
    NSMutableArray<WLAgentSkillsSessionMessage *> *messages = [NSMutableArray array];
    for (NSDictionary *item in WLAgentSkillsArrayValue(dictionary[@"content"])) {
        if (![item isKindOfClass:[NSDictionary class]]) {
        continue;
        }
        [messages addObject:[[WLAgentSkillsSessionMessage alloc] initWithDictionary:item]];
    }
    _content = [messages copy];
    _page = WLAgentSkillsNumberValue(dictionary[@"page"], WLAgentSkillsNumberValue(dictionary[@"number"], @0));
    _size = WLAgentSkillsNumberValue(dictionary[@"size"], @50);
    _total = WLAgentSkillsNumberValue(
        dictionary[@"total"],
        WLAgentSkillsNumberValue(
            dictionary[@"totalElements"],
            WLAgentSkillsNumberValue(dictionary[@"totalCount"], @((NSInteger)messages.count))
        )
    );
    NSInteger computedTotalPages = 0;
    if (_size.integerValue > 0 && _total.longLongValue > 0) {
        computedTotalPages = (NSInteger)((_total.longLongValue + _size.integerValue - 1) / _size.integerValue);
    }
    _totalPages = WLAgentSkillsNumberValue(dictionary[@"totalPages"], @(computedTotalPages));
    _number = _page;
    _totalElements = _total;
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"content" : WLAgentSkillsSerializeModelArray(self.content),
        @"page" : self.page ?: @0,
        @"size" : self.size ?: @0,
        @"total" : self.total ?: @0,
        @"totalPages" : self.totalPages ?: @0,
        @"number" : self.number ?: @0,
        @"totalElements" : self.totalElements ?: @0
    };
}

@end

@implementation WLAgentSkillsCursorResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        NSMutableArray<WLAgentSkillsSessionMessage *> *messages = [NSMutableArray array];
        for (NSDictionary *item in WLAgentSkillsArrayValue(dictionary[@"content"])) {
            if (![item isKindOfClass:[NSDictionary class]]) {
                continue;
            }
            [messages addObject:[[WLAgentSkillsSessionMessage alloc] initWithDictionary:item]];
        }
        _content = [messages copy];
        _size = WLAgentSkillsNumberValue(dictionary[@"size"], @50);
        id hasMoreValue = dictionary[@"hasMore"];
        if ([hasMoreValue isKindOfClass:[NSNumber class]]) {
            _hasMore = [(NSNumber *)hasMoreValue boolValue];
        } else if ([hasMoreValue isKindOfClass:[NSString class]]) {
            NSString *normalized = [((NSString *)hasMoreValue) lowercaseString];
            _hasMore = [normalized isEqualToString:@"true"] || [normalized isEqualToString:@"1"];
        } else {
            _hasMore = NO;
        }
        _nextBeforeSeq = WLAgentSkillsNumberValue(dictionary[@"nextBeforeSeq"], nil);
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"content" : WLAgentSkillsSerializeModelArray(self.content),
        @"size" : self.size ?: @0,
        @"hasMore" : @(self.hasMore),
        @"nextBeforeSeq" : WLAgentSkillsNullObject(self.nextBeforeSeq)
    };
}

@end

@implementation WLAgentSkillsSkillSessionPageResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        NSMutableArray<WLAgentSkillsSkillSession *> *sessions = [NSMutableArray array];
        for (NSDictionary *item in WLAgentSkillsArrayValue(dictionary[@"content"])) {
            if (![item isKindOfClass:[NSDictionary class]]) {
                continue;
            }
            [sessions addObject:[[WLAgentSkillsSkillSession alloc] initWithDictionary:item]];
        }
        _content = [sessions copy];
        _page = WLAgentSkillsNumberValue(dictionary[@"page"], WLAgentSkillsNumberValue(dictionary[@"number"], @0));
        _size = WLAgentSkillsNumberValue(dictionary[@"size"], @50);
        _total = WLAgentSkillsNumberValue(
            dictionary[@"total"],
            WLAgentSkillsNumberValue(
                dictionary[@"totalElements"],
                WLAgentSkillsNumberValue(dictionary[@"totalCount"], @((NSInteger)sessions.count))
            )
        );
        NSInteger computedTotalPages = 0;
        if (_size.integerValue > 0 && _total.longLongValue > 0) {
            computedTotalPages = (NSInteger)((_total.longLongValue + _size.integerValue - 1) / _size.integerValue);
        }
        _totalPages = WLAgentSkillsNumberValue(dictionary[@"totalPages"], @(computedTotalPages));
        _number = _page;
        _totalElements = _total;
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"content" : WLAgentSkillsSerializeModelArray(self.content),
        @"page" : self.page ?: @0,
        @"size" : self.size ?: @0,
        @"total" : self.total ?: @0,
        @"totalPages" : self.totalPages ?: @0,
        @"number" : self.number ?: @0,
        @"totalElements" : self.totalElements ?: @0
    };
}

@end

@implementation WLAgentSkillsSessionError

- (instancetype)initWithCode:(NSString *)code message:(NSString *)message {
    self = [super init];
    if (self) {
    _code = (code != nil && code.length > 0) ? code : @"UNKNOWN";
    _message = (message != nil && message.length > 0) ? message : @"Unknown error";
    _timestamp = @((long long)([[NSDate date] timeIntervalSince1970] * 1000));
    }
    return self;
}

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    return [self initWithCode:WLAgentSkillsStringValue(dictionary[@"code"], @"UNKNOWN")
                    message:WLAgentSkillsStringValue(dictionary[@"message"], @"Unknown error")];
}

- (NSDictionary *)toDictionary {
    return @{
        @"code" : self.code ?: @"UNKNOWN",
        @"message" : self.message ?: @"Unknown error",
        @"timestamp" : self.timestamp ?: @0
    };
}

@end

@implementation WLAgentSkillsStreamMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
    _type = WLAgentSkillsStringValue(dictionary[@"type"], @"");
    _seq = WLAgentSkillsNumberValue(dictionary[@"seq"], nil);
    _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
    if (_welinkSessionId == nil || _welinkSessionId.length == 0) {
        _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"sessionId"], @"");
    }
    _emittedAt = WLAgentSkillsStringValue(dictionary[@"emittedAt"], @"");
    _raw = [dictionary[@"raw"] isKindOfClass:[NSDictionary class]] ? dictionary[@"raw"] : nil;

    _messageId = WLAgentSkillsStringValue(dictionary[@"messageId"], nil);
    _sourceMessageId = WLAgentSkillsStringValue(dictionary[@"sourceMessageId"], nil);
    _messageSeq = WLAgentSkillsNumberValue(dictionary[@"messageSeq"], nil);
    _role = WLAgentSkillsStringValue(dictionary[@"role"], nil);

    _partId = WLAgentSkillsStringValue(dictionary[@"partId"], nil);
    _partSeq = WLAgentSkillsNumberValue(dictionary[@"partSeq"], nil);

    _content = WLAgentSkillsStringValue(dictionary[@"content"], nil);
    _toolName = WLAgentSkillsStringValue(dictionary[@"toolName"], nil);
    _toolCallId = WLAgentSkillsStringValue(dictionary[@"toolCallId"], nil);
    _status = WLAgentSkillsStringValue(dictionary[@"status"], nil);
    if (_status == nil || _status.length == 0) {
        _status = WLAgentSkillsStringValue(dictionary[@"toolStatus"], nil);
    }
    _input = [dictionary[@"input"] isKindOfClass:[NSDictionary class]] ? dictionary[@"input"] : nil;
    if (_input == nil || _input.count == 0) {
        _input = [dictionary[@"toolInput"] isKindOfClass:[NSDictionary class]] ? dictionary[@"toolInput"] : nil;
    }
    _output = WLAgentSkillsStringValue(dictionary[@"output"], nil);
    if (_output == nil || _output.length == 0) {
        _output = WLAgentSkillsStringValue(dictionary[@"toolOutput"], nil);
    }
    _error = WLAgentSkillsStringValue(dictionary[@"error"], nil);
    _title = WLAgentSkillsStringValue(dictionary[@"title"], nil);
    _header = WLAgentSkillsStringValue(dictionary[@"header"], nil);
    _question = WLAgentSkillsStringValue(dictionary[@"question"], nil);
    _options = [dictionary[@"options"] isKindOfClass:[NSArray class]] ? dictionary[@"options"] : nil;
    _fileName = WLAgentSkillsStringValue(dictionary[@"fileName"], nil);
    _fileUrl = WLAgentSkillsStringValue(dictionary[@"fileUrl"], nil);
    _fileMime = WLAgentSkillsStringValue(dictionary[@"fileMime"], nil);
    _tokens = [dictionary[@"tokens"] isKindOfClass:[NSDictionary class]] ? dictionary[@"tokens"] : nil;
    _cost = WLAgentSkillsNumberValue(dictionary[@"cost"], nil);
    _reason = WLAgentSkillsStringValue(dictionary[@"reason"], nil);
    _sessionStatus = WLAgentSkillsStringValue(dictionary[@"sessionStatus"], nil);
    _permissionId = WLAgentSkillsStringValue(dictionary[@"permissionId"], nil);
    _permType = WLAgentSkillsStringValue(dictionary[@"permType"], nil);
    _metadata = [dictionary[@"metadata"] isKindOfClass:[NSDictionary class]] ? dictionary[@"metadata"] : nil;
    _response = WLAgentSkillsStringValue(dictionary[@"response"], nil);
    _messages = [dictionary[@"messages"] isKindOfClass:[NSArray class]] ? dictionary[@"messages"] : nil;
    _parts = [dictionary[@"parts"] isKindOfClass:[NSArray class]] ? dictionary[@"parts"] : nil;
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"type" : self.type ?: @"",
        @"seq" : WLAgentSkillsNullObject(self.seq),
        @"welinkSessionId" : self.welinkSessionId ?: @"",
        @"emittedAt" : self.emittedAt ?: @"",
        @"raw" : WLAgentSkillsNullObject(self.raw),
        @"messageId" : WLAgentSkillsNullObject(self.messageId),
        @"sourceMessageId" : WLAgentSkillsNullObject(self.sourceMessageId),
        @"messageSeq" : WLAgentSkillsNullObject(self.messageSeq),
        @"role" : WLAgentSkillsNullObject(self.role),
        @"partId" : WLAgentSkillsNullObject(self.partId),
        @"partSeq" : WLAgentSkillsNullObject(self.partSeq),
        @"content" : WLAgentSkillsNullObject(self.content),
        @"toolName" : WLAgentSkillsNullObject(self.toolName),
        @"toolCallId" : WLAgentSkillsNullObject(self.toolCallId),
        @"status" : WLAgentSkillsNullObject(self.status),
        @"input" : WLAgentSkillsNullObject(self.input),
        @"output" : WLAgentSkillsNullObject(self.output),
        @"error" : WLAgentSkillsNullObject(self.error),
        @"title" : WLAgentSkillsNullObject(self.title),
        @"header" : WLAgentSkillsNullObject(self.header),
        @"question" : WLAgentSkillsNullObject(self.question),
        @"options" : WLAgentSkillsNullObject(self.options),
        @"fileName" : WLAgentSkillsNullObject(self.fileName),
        @"fileUrl" : WLAgentSkillsNullObject(self.fileUrl),
        @"fileMime" : WLAgentSkillsNullObject(self.fileMime),
        @"tokens" : WLAgentSkillsNullObject(self.tokens),
        @"cost" : WLAgentSkillsNullObject(self.cost),
        @"reason" : WLAgentSkillsNullObject(self.reason),
        @"sessionStatus" : WLAgentSkillsNullObject(self.sessionStatus),
        @"permissionId" : WLAgentSkillsNullObject(self.permissionId),
        @"permType" : WLAgentSkillsNullObject(self.permType),
        @"metadata" : WLAgentSkillsNullObject(self.metadata),
        @"response" : WLAgentSkillsNullObject(self.response),
        @"messages" : WLAgentSkillsNullObject(self.messages),
        @"parts" : WLAgentSkillsNullObject(self.parts)
    };
}

@end

#pragma mark - Result Models

@implementation WLAgentSkillsSendMessageResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _id = WLAgentSkillsStringValue(dictionary[@"id"], @"");
        if (_id == nil || _id.length == 0) {
            _id = WLAgentSkillsStringValue(dictionary[@"messageId"], @"");
        }
        _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
        _seq = WLAgentSkillsNumberValue(dictionary[@"seq"], nil);
        _messageSeq = WLAgentSkillsNumberValue(dictionary[@"messageSeq"], nil);
        _role = WLAgentSkillsStringValue(dictionary[@"role"], @"");
        _content = WLAgentSkillsStringValue(dictionary[@"content"], nil);
        _contentType = WLAgentSkillsStringValue(dictionary[@"contentType"], nil);
        _meta = [dictionary[@"meta"] isKindOfClass:[NSDictionary class]] ? dictionary[@"meta"] : nil;
        NSMutableArray<WLAgentSkillsSessionMessagePart *> *parts = [NSMutableArray array];
        for (NSDictionary *part in WLAgentSkillsArrayValue(dictionary[@"parts"])) {
            if (![part isKindOfClass:[NSDictionary class]]) {
                continue;
            }
            [parts addObject:[[WLAgentSkillsSessionMessagePart alloc] initWithDictionary:part]];
        }
        _parts = [parts copy];
        _createdAt = WLAgentSkillsStringValue(dictionary[@"createdAt"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"id" : self.id ?: @"",
        @"welinkSessionId" : self.welinkSessionId ?: @"",
        @"seq" : WLAgentSkillsNullObject(self.seq),
        @"messageSeq" : WLAgentSkillsNullObject(self.messageSeq),
        @"role" : self.role ?: @"",
        @"content" : WLAgentSkillsNullObject(self.content),
        @"contentType" : WLAgentSkillsNullObject(self.contentType),
        @"meta" : WLAgentSkillsNullObject(self.meta),
        @"parts" : WLAgentSkillsSerializeModelArray(self.parts),
        @"createdAt" : self.createdAt ?: @""
    };
}

@end

@implementation WLAgentSkillsStopSkillResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
        _status = WLAgentSkillsStringValue(dictionary[@"status"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"welinkSessionId" : self.welinkSessionId ?: @"",
        @"status" : self.status ?: @""
    };
}

@end

@implementation WLAgentSkillsRegisterSessionListenerResult

- (NSDictionary *)toDictionary {
    return @{
        @"status" : self.status ?: @""
    };
}

@end

@implementation WLAgentSkillsUnregisterSessionListenerResult

- (NSDictionary *)toDictionary {
    return @{
        @"status" : self.status ?: @""
    };
}

@end

@implementation WLAgentSkillsCloseSkillResult

- (NSDictionary *)toDictionary {
    return @{
        @"status" : self.status ?: @""
    };
}

@end

@implementation WLAgentSkillsReplyPermissionResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
        _permissionId = WLAgentSkillsStringValue(dictionary[@"permissionId"], @"");
        _response = WLAgentSkillsStringValue(dictionary[@"response"], @"");
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"welinkSessionId" : self.welinkSessionId ?: @"",
        @"permissionId" : self.permissionId ?: @"",
        @"response" : self.response ?: @""
    };
}

@end

@implementation WLAgentSkillsControlSkillWeCodeResult

- (NSDictionary *)toDictionary {
    return @{
        @"status" : self.status ?: @""
    };
}

@end

@implementation WLAgentSkillsSendMessageToIMResult

- (NSDictionary *)toDictionary {
    return @{
        @"success" : @(self.success)
    };
}

@end

@implementation WLAgentSkillsCreateDigitalTwinResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
        _robotId = WLAgentSkillsStringValue(dictionary[@"robotId"], @"");
        _partnerAccount = WLAgentSkillsStringValue(dictionary[@"partnerAccount"], @"");
        _message = WLAgentSkillsStringValue(
            dictionary[@"message"],
            WLAgentSkillsStringValue(dictionary[@"status"], @"success")
        );
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"robotId" : self.robotId ?: @"",
        @"partnerAccount" : self.partnerAccount ?: @"",
        @"message" : self.message ?: @""
    };
}

@end

@implementation WLAgentSkillsAgentTypeListResult

- (instancetype)init {
    self = [super init];
    if (self) {
        _content = @[];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"content" : WLAgentSkillsSerializeModelArray(self.content)
    };
}

@end

@implementation WLAgentSkillsWeAgentListResult

- (instancetype)init {
    self = [super init];
    if (self) {
        _content = @[];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"content" : WLAgentSkillsSerializeModelArray(self.content)
    };
}

@end

@implementation WLAgentSkillsWeAgentDetailsArrayResult

- (instancetype)init {
    self = [super init];
    if (self) {
        _WeAgentDetailsArray = @[];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"WeAgentDetailsArray" : WLAgentSkillsSerializeModelArray(self.WeAgentDetailsArray)
    };
}

@end

@implementation WLAgentSkillsSessionStatusResult

- (NSDictionary *)toDictionary {
    return @{
        @"status" : @(self.status)
    };
}

@end

@implementation WLAgentSkillsSkillWecodeStatusResult

- (NSDictionary *)toDictionary {
    return @{
        @"status" : @(self.status),
        @"timestamp" : WLAgentSkillsNullObject(self.timestamp),
        @"message" : WLAgentSkillsNullObject(self.message)
    };
}

@end
