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

#pragma mark - Param Models

@implementation WLAgentSkillsCreateSessionParams
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
    _status = WLAgentSkillsStringValue(dictionary[@"status"], @"");
    _toolSessionId = WLAgentSkillsStringValue(dictionary[@"toolSessionId"], nil);
    _createdAt = WLAgentSkillsStringValue(dictionary[@"createdAt"], @"");
    _updatedAt = WLAgentSkillsStringValue(dictionary[@"updatedAt"], @"");
    }
    return self;
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
    if (_status.length == 0) {
        _status = WLAgentSkillsStringValue(dictionary[@"toolStatus"], nil);
    }
    _input = [dictionary[@"input"] isKindOfClass:[NSDictionary class]] ? dictionary[@"input"] : nil;
    if (_input.count == 0) {
        _input = [dictionary[@"toolInput"] isKindOfClass:[NSDictionary class]] ? dictionary[@"toolInput"] : nil;
    }
    _output = WLAgentSkillsStringValue(dictionary[@"output"], nil);
    if (_output.length == 0) {
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
    if (self.partId.length > 0) {
    dictionary[@"partId"] = self.partId;
    }
    if (self.partSeq != nil) {
    dictionary[@"partSeq"] = self.partSeq;
    }
    if (self.type.length > 0) {
    dictionary[@"type"] = self.type;
    }
    if (self.content.length > 0) {
    dictionary[@"content"] = self.content;
    }
    if (self.toolName.length > 0) {
    dictionary[@"toolName"] = self.toolName;
    }
    if (self.toolCallId.length > 0) {
    dictionary[@"toolCallId"] = self.toolCallId;
    }
    if (self.status.length > 0) {
    dictionary[@"status"] = self.status;
    }
    if (self.input.count > 0) {
    dictionary[@"input"] = self.input;
    }
    if (self.output.length > 0) {
    dictionary[@"output"] = self.output;
    }
    if (self.error.length > 0) {
    dictionary[@"error"] = self.error;
    }
    if (self.title.length > 0) {
    dictionary[@"title"] = self.title;
    }
    if (self.header.length > 0) {
    dictionary[@"header"] = self.header;
    }
    if (self.question.length > 0) {
    dictionary[@"question"] = self.question;
    }
    if (self.options.count > 0) {
    dictionary[@"options"] = self.options;
    }
    if (self.permissionId.length > 0) {
    dictionary[@"permissionId"] = self.permissionId;
    }
    if (self.permType.length > 0) {
    dictionary[@"permType"] = self.permType;
    }
    if (self.metadata.count > 0) {
    dictionary[@"metadata"] = self.metadata;
    }
    if (self.response.length > 0) {
    dictionary[@"response"] = self.response;
    }
    if (self.fileName.length > 0) {
    dictionary[@"fileName"] = self.fileName;
    }
    if (self.fileUrl.length > 0) {
    dictionary[@"fileUrl"] = self.fileUrl;
    }
    if (self.fileMime.length > 0) {
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
    if (_welinkSessionId.length == 0) {
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

@end

@implementation WLAgentSkillsSessionError

- (instancetype)initWithCode:(NSString *)code message:(NSString *)message {
    self = [super init];
    if (self) {
    _code = code.length > 0 ? code : @"UNKNOWN";
    _message = message.length > 0 ? message : @"Unknown error";
    _timestamp = @((long long)([[NSDate date] timeIntervalSince1970] * 1000));
    }
    return self;
}

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    return [self initWithCode:WLAgentSkillsStringValue(dictionary[@"code"], @"UNKNOWN")
                    message:WLAgentSkillsStringValue(dictionary[@"message"], @"Unknown error")];
}

@end

@implementation WLAgentSkillsStreamMessage

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
    _type = WLAgentSkillsStringValue(dictionary[@"type"], @"");
    _seq = WLAgentSkillsNumberValue(dictionary[@"seq"], nil);
    _welinkSessionId = WLAgentSkillsStringValue(dictionary[@"welinkSessionId"], @"");
    if (_welinkSessionId.length == 0) {
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
    if (_status.length == 0) {
        _status = WLAgentSkillsStringValue(dictionary[@"toolStatus"], nil);
    }
    _input = [dictionary[@"input"] isKindOfClass:[NSDictionary class]] ? dictionary[@"input"] : nil;
    if (_input.count == 0) {
        _input = [dictionary[@"toolInput"] isKindOfClass:[NSDictionary class]] ? dictionary[@"toolInput"] : nil;
    }
    _output = WLAgentSkillsStringValue(dictionary[@"output"], nil);
    if (_output.length == 0) {
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

@end

#pragma mark - Result Models

@implementation WLAgentSkillsSendMessageResult

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    self = [super init];
    if (self) {
    _id = WLAgentSkillsStringValue(dictionary[@"id"], @"");
    if (_id.length == 0) {
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

@end

@implementation WLAgentSkillsRegisterSessionListenerResult
@end

@implementation WLAgentSkillsUnregisterSessionListenerResult
@end

@implementation WLAgentSkillsCloseSkillResult
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

@end

@implementation WLAgentSkillsControlSkillWeCodeResult
@end

@implementation WLAgentSkillsSendMessageToIMResult
@end

@implementation WLAgentSkillsSessionStatusResult
@end

@implementation WLAgentSkillsSkillWecodeStatusResult
@end
