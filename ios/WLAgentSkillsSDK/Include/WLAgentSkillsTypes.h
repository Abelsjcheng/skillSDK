//
//  WLAgentSkillsTypes.h
//  WLAgentSkillsSDK
//
//  Data types and model definitions for WLAgentSkills SDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#pragma mark - Enums

typedef NS_ENUM(NSInteger, WLAgentSkillsSessionStatus) {
    WLAgentSkillsSessionStatusActive = 0,
    WLAgentSkillsSessionStatusIdle,
    WLAgentSkillsSessionStatusClosed
};

typedef NS_ENUM(NSInteger, WLAgentSkillsMessageRole) {
    WLAgentSkillsMessageRoleUser = 0,
    WLAgentSkillsMessageRoleAssistant,
    WLAgentSkillsMessageRoleSystem,
    WLAgentSkillsMessageRoleTool
};

typedef NS_ENUM(NSInteger, WLAgentSkillsContentType) {
    WLAgentSkillsContentTypeMarkdown = 0,
    WLAgentSkillsContentTypeCode,
    WLAgentSkillsContentTypePlain
};

typedef NS_ENUM(NSInteger, WLAgentSkillsStreamMessageType) {
    WLAgentSkillsStreamMessageTypeDelta = 0,
    WLAgentSkillsStreamMessageTypeDone,
    WLAgentSkillsStreamMessageTypeError,
    WLAgentSkillsStreamMessageTypeAgentOffline,
    WLAgentSkillsStreamMessageTypeAgentOnline
};

typedef NS_ENUM(NSInteger, WLAgentSkillsClientSessionStatus) {
    WLAgentSkillsClientSessionStatusExecuting = 0,
    WLAgentSkillsClientSessionStatusStopped,
    WLAgentSkillsClientSessionStatusCompleted
};

typedef NS_ENUM(NSInteger, WLAgentSkillsWeCodeStatus) {
    WLAgentSkillsWeCodeStatusClosed = 0,
    WLAgentSkillsWeCodeStatusMinimized
};

typedef NS_ENUM(NSInteger, WLAgentSkillsWeCodeAction) {
    WLAgentSkillsWeCodeActionClose = 0,
    WLAgentSkillsWeCodeActionMinimize
};

#pragma mark - Model Classes

#pragma mark WLAgentSkillsSkillDefinition

@interface WLAgentSkillsSkillDefinition : NSObject

@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, copy) NSString *skillCode;
@property (nonatomic, copy) NSString *skillName;
@property (nonatomic, copy) NSString *toolType;
@property (nonatomic, copy, nullable) NSString *skillDescription;
@property (nonatomic, copy, nullable) NSString *iconUrl;
@property (nonatomic, copy) NSString *status;
@property (nonatomic, assign) NSInteger sortOrder;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy) NSString *updatedAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;

@end

#pragma mark WLAgentSkillsSession

@interface WLAgentSkillsSession : NSObject

@property (nonatomic, assign) NSInteger sessionId;
@property (nonatomic, assign) NSInteger userId;
@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, assign) NSInteger agentId;
@property (nonatomic, copy, nullable) NSString *toolSessionId;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, assign) WLAgentSkillsSessionStatus status;
@property (nonatomic, copy, nullable) NSString *imChatId;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy) NSString *lastActiveAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
- (NSString *)statusString;

@end

#pragma mark WLAgentSkillsMessage

@interface WLAgentSkillsMessage : NSObject

@property (nonatomic, assign) NSInteger messageId;
@property (nonatomic, assign) NSInteger sessionId;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, assign) WLAgentSkillsMessageRole role;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, assign) WLAgentSkillsContentType contentType;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy, nullable) NSString *meta;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
- (NSString *)roleString;
- (NSString *)contentTypeString;

@end

#pragma mark WLAgentSkillsPageResult

@interface WLAgentSkillsPageResult : NSObject

@property (nonatomic, strong) NSArray *content;
@property (nonatomic, assign) NSInteger totalElements;
@property (nonatomic, assign) NSInteger totalPages;
@property (nonatomic, assign) NSInteger number;
@property (nonatomic, assign) NSInteger size;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;

@end

#pragma mark WLAgentSkillsStreamMessage

@interface WLAgentSkillsStreamMessage : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, assign) WLAgentSkillsStreamMessageType type;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, strong, nullable) NSDictionary *usage;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSString *)typeString;

@end

#pragma mark WLAgentSkillsSessionError

@interface WLAgentSkillsSessionError : NSObject

@property (nonatomic, copy) NSString *code;
@property (nonatomic, copy) NSString *message;
@property (nonatomic, assign) NSTimeInterval timestamp;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;

@end

#pragma mark - Parameter Classes

#pragma mark ExecuteSkillParams

@interface WLAgentSkillsExecuteSkillParams : NSObject

@property (nonatomic, copy) NSString *imChatId;
@property (nonatomic, assign) NSInteger skillDefinitionId;
@property (nonatomic, copy) NSString *userId;
@property (nonatomic, assign) NSInteger agentId;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy) NSString *skillContent;

@end

#pragma mark CloseSkillParams

@interface WLAgentSkillsCloseSkillParams : NSObject

@property (nonatomic, copy) NSString *sessionId;

@end

#pragma mark StopSkillParams

@interface WLAgentSkillsStopSkillParams : NSObject

@property (nonatomic, copy) NSString *sessionId;

@end

#pragma mark RegenerateAnswerParams

@interface WLAgentSkillsRegenerateAnswerParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) NSString *content;

@end

#pragma mark SendMessageToIMParams

@interface WLAgentSkillsSendMessageToIMParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) NSString *content;

@end

#pragma mark GetSessionMessageParams

@interface WLAgentSkillsGetSessionMessageParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, assign) NSInteger page;
@property (nonatomic, assign) NSInteger size;

@end

#pragma mark SendMessageParams

@interface WLAgentSkillsSendMessageParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) NSString *content;

@end

#pragma mark ReplyPermissionParams

@interface WLAgentSkillsReplyPermissionParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) NSString *permissionId;
@property (nonatomic, assign) BOOL approved;

@end

#pragma mark ControlSkillWeCodeParams

@interface WLAgentSkillsControlSkillWeCodeParams : NSObject

@property (nonatomic, assign) WLAgentSkillsWeCodeAction action;

@end

#pragma mark RegisterSessionListenerParams

@interface WLAgentSkillsRegisterSessionListenerParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) void (^onMessage)(WLAgentSkillsStreamMessage *message);
@property (nonatomic, copy, nullable) void (^onError)(WLAgentSkillsSessionError *error);
@property (nonatomic, copy, nullable) void (^onClose)(NSString *reason);

@end

#pragma mark UnregisterSessionListenerParams

@interface WLAgentSkillsUnregisterSessionListenerParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) void (^onMessage)(WLAgentSkillsStreamMessage *message);
@property (nonatomic, copy, nullable) void (^onError)(WLAgentSkillsSessionError *error);
@property (nonatomic, copy, nullable) void (^onClose)(NSString *reason);

@end

#pragma mark OnSessionStatusChangeParams

@interface WLAgentSkillsOnSessionStatusChangeParams : NSObject

@property (nonatomic, copy) NSString *sessionId;
@property (nonatomic, copy) void (^callback)(WLAgentSkillsClientSessionStatus status);

@end

#pragma mark OnSkillWecodeStatusChangeParams

@interface WLAgentSkillsOnSkillWecodeStatusChangeParams : NSObject

@property (nonatomic, copy) void (^callback)(WLAgentSkillsWeCodeStatus status);

@end

#pragma mark - Result Classes

#pragma mark CloseSkillResult

@interface WLAgentSkillsCloseSkillResult : NSObject

@property (nonatomic, copy) NSString *status;

@end

#pragma mark StopSkillResult

@interface WLAgentSkillsStopSkillResult : NSObject

@property (nonatomic, copy) NSString *status;

@end

#pragma mark RegenerateAnswerResult

@interface WLAgentSkillsRegenerateAnswerResult : NSObject

@property (nonatomic, copy) NSString *messageId;

@end

#pragma mark SendMessageToIMResult

@interface WLAgentSkillsSendMessageToIMResult : NSObject

@property (nonatomic, assign) BOOL success;
@property (nonatomic, copy, nullable) NSString *chatId;
@property (nonatomic, assign) NSInteger contentLength;
@property (nonatomic, copy, nullable) NSString *errorMessage;

@end

#pragma mark SendMessageResult

@interface WLAgentSkillsSendMessageResult : NSObject

@property (nonatomic, assign) NSInteger messageId;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, copy) NSString *createdAt;

@end

#pragma mark ReplyPermissionResult

@interface WLAgentSkillsReplyPermissionResult : NSObject

@property (nonatomic, assign) BOOL success;
@property (nonatomic, copy, nullable) NSString *permissionId;
@property (nonatomic, assign) BOOL approved;

@end

#pragma mark ControlSkillWeCodeResult

@interface WLAgentSkillsControlSkillWeCodeResult : NSObject

@property (nonatomic, copy) NSString *status;

@end

NS_ASSUME_NONNULL_END