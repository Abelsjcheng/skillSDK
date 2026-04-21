//
//  WLAgentSkillsTypes.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString * const WLAgentSkillsErrorCodeKey;
FOUNDATION_EXPORT NSString * const WLAgentSkillsErrorMessageKey;

typedef NS_ENUM(NSInteger, WLAgentSkillsClientSessionStatus) {
    WLAgentSkillsClientSessionStatusExecuting = 0,
    WLAgentSkillsClientSessionStatusStopped,
    WLAgentSkillsClientSessionStatusCompleted,
};

typedef NS_ENUM(NSInteger, WLAgentSkillsWecodeStatus) {
    WLAgentSkillsWecodeStatusClosed = 0,
    WLAgentSkillsWecodeStatusMinimized,
};

typedef NS_ENUM(NSInteger, WLAgentSkillsWecodeAction) {
    WLAgentSkillsWecodeActionClose = 0,
    WLAgentSkillsWecodeActionMinimize,
};

@class WLAgentSkillsSessionError;
@class WLAgentSkillsSkillWecodeStatusResult;
@class WLAgentSkillsSessionStatusResult;
@class WLAgentSkillsStreamMessage;
@class WLAgentSkillsAssistantDetailUpdatedPayload;

#pragma mark - Callback Typedefs

typedef void (^WLAgentSkillsSessionStatusCallback)(WLAgentSkillsSessionStatusResult *result);
typedef void (^WLAgentSkillsWecodeStatusCallback)(WLAgentSkillsSkillWecodeStatusResult *result);
typedef void (^WLAgentSkillsSessionMessageCallback)(WLAgentSkillsStreamMessage *message);
typedef void (^WLAgentSkillsSessionErrorCallback)(WLAgentSkillsSessionError *error);
typedef void (^WLAgentSkillsSessionCloseCallback)(NSString *reason);
typedef void (^WLAgentSkillsAssistantDetailUpdatedCallback)(WLAgentSkillsAssistantDetailUpdatedPayload *payload);

#pragma mark - Param Models

@interface WLAgentSkillsCreateSessionParams : NSObject
@property (nonatomic, copy, nullable) NSString *ak;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy) NSString *imGroupId;
@end

@interface WLAgentSkillsCreateNewSessionParams : NSObject
@property (nonatomic, copy) NSString *ak;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy) NSString *bussinessDomain;
@property (nonatomic, copy) NSString *bussinessType;
@property (nonatomic, copy) NSString *bussinessId;
@property (nonatomic, copy) NSString *assistantAccount;
@end

@interface WLAgentSkillsHistorySessionsParams : NSObject
@property (nonatomic, strong, nullable) NSNumber *page;
@property (nonatomic, strong, nullable) NSNumber *size;
@property (nonatomic, copy, nullable) NSString *status;
@property (nonatomic, copy, nullable) NSString *ak;
@property (nonatomic, copy, nullable) NSString *bussinessId;
@property (nonatomic, copy, nullable) NSString *assistantAccount;
@property (nonatomic, copy, nullable) NSString *businessSessionDomain;
@end

@interface WLAgentSkillsStopSkillParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@end

@interface WLAgentSkillsOnSessionStatusChangeParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) WLAgentSkillsSessionStatusCallback callback;
@end

@interface WLAgentSkillsOnSkillWecodeStatusChangeParams : NSObject
@property (nonatomic, copy) WLAgentSkillsWecodeStatusCallback callback;
@end

@interface WLAgentSkillsRegenerateAnswerParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@end

@interface WLAgentSkillsSendMessageToIMParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy, nullable) NSString *messageId;
@property (nonatomic, copy, nullable) NSString *chatId;
@end

@interface WLAgentSkillsGetSessionMessageParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, strong, nullable) NSNumber *page;
@property (nonatomic, strong, nullable) NSNumber *size;
@property (nonatomic, assign) BOOL isFirst;
@end

@interface WLAgentSkillsGetSessionMessageHistoryParams : NSObject
@property (nonatomic, strong, nullable) id welinkSessionId;
@property (nonatomic, strong, nullable) id beforeSeq;
@property (nonatomic, strong, nullable) id size;
@end

@interface WLAgentSkillsRegisterSessionListenerParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) WLAgentSkillsSessionMessageCallback onMessage;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionErrorCallback onError;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionCloseCallback onClose;
@end

@interface WLAgentSkillsUnregisterSessionListenerParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@end

@interface WLAgentSkillsSendMessageParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, copy, nullable) NSString *toolCallId;
@end

@interface WLAgentSkillsReplyPermissionParams : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *permId;
@property (nonatomic, copy) NSString *response;
@end

@interface WLAgentSkillsControlSkillWeCodeParams : NSObject
@property (nonatomic, assign) WLAgentSkillsWecodeAction action;
@end

@interface WLAgentSkillsCreateDigitalTwinParams : NSObject
@property (nonatomic, strong, nullable) id name;
@property (nonatomic, strong, nullable) id icon;
@property (nonatomic, strong, nullable) id description;
@property (nonatomic, strong, nullable) id weCrewType;
@property (nonatomic, strong, nullable) id bizRobotId;
@end

@interface WLAgentSkillsPageParams : NSObject
@property (nonatomic, strong, nullable) id pageSize;
@property (nonatomic, strong, nullable) id pageNumber;
@end

@interface WLAgentSkillsQueryWeAgentParams : NSObject
@property (nonatomic, strong, nullable) id partnerAccount;
@end

@interface WLAgentSkillsUpdateWeAgentParams : NSObject
@property (nonatomic, strong, nullable) id partnerAccount;
@property (nonatomic, strong, nullable) id robotId;
@property (nonatomic, strong, nullable) id name;
@property (nonatomic, strong, nullable) id icon;
@property (nonatomic, strong, nullable) id description;
@end

@interface WLAgentSkillsDeleteWeAgentParams : NSObject
@property (nonatomic, strong, nullable) id partnerAccount;
@property (nonatomic, strong, nullable) id robotId;
@end

@interface WLAgentSkillsOpenAssistantEditPageParams : NSObject
@property (nonatomic, strong, nullable) id partnerAccount;
@property (nonatomic, strong, nullable) id robotId;
@property (nonatomic, copy, nullable) WLAgentSkillsAssistantDetailUpdatedCallback onUpdated;
@end

@interface WLAgentSkillsNotifyAssistantDetailUpdatedParams : NSObject
@property (nonatomic, strong, nullable) id name;
@property (nonatomic, strong, nullable) id icon;
@property (nonatomic, strong, nullable) id description;
@property (nonatomic, strong, nullable) id partnerAccount;
@property (nonatomic, strong, nullable) id robotId;
@end

@interface WLAgentSkillsQueryQrcodeInfoParams : NSObject
@property (nonatomic, strong, nullable) id qrcode;
@end

@interface WLAgentSkillsUpdateQrcodeInfoParams : NSObject
@property (nonatomic, strong, nullable) id qrcode;
@property (nonatomic, strong, nullable) id ak;
@property (nonatomic, strong, nullable) id status;
@end

#pragma mark - Data Models

@interface WLAgentSkillsSkillSession : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *userId;
@property (nonatomic, copy, nullable) NSString *ak;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy, nullable) NSString *imGroupId;
@property (nonatomic, copy, nullable) NSString *bussinessDomain;
@property (nonatomic, copy, nullable) NSString *bussinessType;
@property (nonatomic, copy, nullable) NSString *bussinessId;
@property (nonatomic, copy, nullable) NSString *assistantAccount;
@property (nonatomic, copy) NSString *status;
@property (nonatomic, copy, nullable) NSString *toolSessionId;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy) NSString *updatedAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSessionMessagePart : NSObject
@property (nonatomic, copy, nullable) NSString *partId;
@property (nonatomic, strong, nullable) NSNumber *partSeq;
@property (nonatomic, copy, nullable) NSString *type;
@property (nonatomic, copy, nullable) NSString *content;
@property (nonatomic, copy, nullable) NSString *toolName;
@property (nonatomic, copy, nullable) NSString *toolCallId;
@property (nonatomic, copy, nullable) NSString *status;
@property (nonatomic, strong, nullable) NSDictionary *input;
@property (nonatomic, copy, nullable) NSString *output;
@property (nonatomic, copy, nullable) NSString *error;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy, nullable) NSString *header;
@property (nonatomic, copy, nullable) NSString *question;
@property (nonatomic, strong, nullable) NSArray<NSString *> *options;
@property (nonatomic, copy, nullable) NSString *permissionId;
@property (nonatomic, copy, nullable) NSString *permType;
@property (nonatomic, strong, nullable) NSDictionary *metadata;
@property (nonatomic, copy, nullable) NSString *response;
@property (nonatomic, copy, nullable) NSString *fileName;
@property (nonatomic, copy, nullable) NSString *fileUrl;
@property (nonatomic, copy, nullable) NSString *fileMime;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSessionMessage : NSObject
@property (nonatomic, copy) NSString *id;
@property (nonatomic, strong, nullable) NSNumber *seq;
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *role;
@property (nonatomic, copy, nullable) NSString *content;
@property (nonatomic, copy, nullable) NSString *contentType;
@property (nonatomic, strong, nullable) NSDictionary *meta;
@property (nonatomic, strong, nullable) NSNumber *messageSeq;
@property (nonatomic, strong, nullable) NSArray<WLAgentSkillsSessionMessagePart *> *parts;
@property (nonatomic, copy) NSString *createdAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsPageResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsSessionMessage *> *content;
@property (nonatomic, strong) NSNumber *page;
@property (nonatomic, strong) NSNumber *size;
@property (nonatomic, strong) NSNumber *total;
@property (nonatomic, strong) NSNumber *totalPages;

@property (nonatomic, strong) NSNumber *number __attribute__((deprecated("Use page")));
@property (nonatomic, strong) NSNumber *totalElements __attribute__((deprecated("Use total")));

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsCursorResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsSessionMessage *> *content;
@property (nonatomic, strong) NSNumber *size;
@property (nonatomic, assign) BOOL hasMore;
@property (nonatomic, strong, nullable) NSNumber *nextBeforeSeq;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSkillSessionPageResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsSkillSession *> *content;
@property (nonatomic, strong) NSNumber *page;
@property (nonatomic, strong) NSNumber *size;
@property (nonatomic, strong) NSNumber *total;
@property (nonatomic, strong) NSNumber *totalPages;

@property (nonatomic, strong) NSNumber *number __attribute__((deprecated("Use page")));
@property (nonatomic, strong) NSNumber *totalElements __attribute__((deprecated("Use total")));

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsAgentType : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, copy) NSString *icon;
@property (nonatomic, copy) NSString *bizRobotId;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsWeAgent : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, copy) NSString *icon;
@property (nonatomic, copy) NSString *desc;
@property (nonatomic, copy) NSString *partnerAccount;
@property (nonatomic, copy) NSString *bizRobotName;
@property (nonatomic, copy) NSString *bizRobotNameEn;
@property (nonatomic, copy) NSString *robotId;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsWeAgentDetails : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, copy) NSString *icon;
@property (nonatomic, copy) NSString *desc;
@property (nonatomic, copy) NSString *moduleId;
@property (nonatomic, copy) NSString *appKey;
@property (nonatomic, copy) NSString *appSecret;
@property (nonatomic, copy) NSString *partnerAccount;
@property (nonatomic, copy) NSString *createdBy;
@property (nonatomic, copy) NSString *creatorWorkId;
@property (nonatomic, copy) NSString *creatorW3Account;
@property (nonatomic, copy) NSString *creatorName;
@property (nonatomic, copy) NSString *creatorNameEn;
@property (nonatomic, copy) NSString *ownerWelinkId;
@property (nonatomic, copy) NSString *ownerW3Account;
@property (nonatomic, copy) NSString *ownerName;
@property (nonatomic, copy) NSString *ownerNameEn;
@property (nonatomic, copy) NSString *ownerDeptName;
@property (nonatomic, copy) NSString *ownerDeptNameEn;
@property (nonatomic, copy) NSString *id;
@property (nonatomic, copy) NSString *bizRobotName;
@property (nonatomic, copy) NSString *bizRobotNameEn;
@property (nonatomic, copy) NSString *bizRobotTag;
@property (nonatomic, copy) NSString *bizRobotId;
@property (nonatomic, copy) NSString *weCodeUrl;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsWeAgentUriResult : NSObject
@property (nonatomic, copy) NSString *weAgentUri;
@property (nonatomic, copy) NSString *assistantDetailUri;
@property (nonatomic, copy) NSString *switchAssistantUri;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsAssistantDetailUpdatedPayload : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, copy) NSString *icon;
@property (nonatomic, copy) NSString *descriptionValue;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsQrcodeInfo : NSObject
@property (nonatomic, copy) NSString *qrcode;
@property (nonatomic, copy) NSString *weUrl;
@property (nonatomic, copy) NSString *pcUrl;
@property (nonatomic, copy) NSString *expireTime;
@property (nonatomic, strong) NSNumber *status;
@property (nonatomic, assign) BOOL expired;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSessionError : NSObject
@property (nonatomic, copy) NSString *code;
@property (nonatomic, copy) NSString *message;
@property (nonatomic, strong) NSNumber *timestamp;

- (instancetype)initWithCode:(NSString *)code message:(NSString *)message;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsStreamMessage : NSObject
@property (nonatomic, copy) NSString *type;
@property (nonatomic, strong) NSNumber *seq;
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *emittedAt;
@property (nonatomic, strong, nullable) NSDictionary *raw;

@property (nonatomic, copy, nullable) NSString *messageId;
@property (nonatomic, copy, nullable) NSString *sourceMessageId;
@property (nonatomic, strong, nullable) NSNumber *messageSeq;
@property (nonatomic, copy, nullable) NSString *role;

@property (nonatomic, copy, nullable) NSString *partId;
@property (nonatomic, strong, nullable) NSNumber *partSeq;

@property (nonatomic, copy, nullable) NSString *content;
@property (nonatomic, copy, nullable) NSString *toolName;
@property (nonatomic, copy, nullable) NSString *toolCallId;
@property (nonatomic, copy, nullable) NSString *status;
@property (nonatomic, strong, nullable) NSDictionary *input;
@property (nonatomic, copy, nullable) NSString *output;
@property (nonatomic, copy, nullable) NSString *error;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy, nullable) NSString *header;
@property (nonatomic, copy, nullable) NSString *question;
@property (nonatomic, strong, nullable) NSArray<NSString *> *options;
@property (nonatomic, copy, nullable) NSString *fileName;
@property (nonatomic, copy, nullable) NSString *fileUrl;
@property (nonatomic, copy, nullable) NSString *fileMime;
@property (nonatomic, strong, nullable) NSDictionary *tokens;
@property (nonatomic, strong, nullable) NSNumber *cost;
@property (nonatomic, copy, nullable) NSString *reason;
@property (nonatomic, copy, nullable) NSString *sessionStatus;
@property (nonatomic, copy, nullable) NSString *permissionId;
@property (nonatomic, copy, nullable) NSString *permType;
@property (nonatomic, strong, nullable) NSDictionary *metadata;
@property (nonatomic, copy, nullable) NSString *response;
@property (nonatomic, strong, nullable) NSArray *messages;
@property (nonatomic, strong, nullable) NSArray *parts;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

#pragma mark - Result Models

@interface WLAgentSkillsSendMessageResult : NSObject
@property (nonatomic, copy) NSString *id;
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, strong, nullable) NSNumber *seq;
@property (nonatomic, strong, nullable) NSNumber *messageSeq;
@property (nonatomic, copy) NSString *role;
@property (nonatomic, copy, nullable) NSString *content;
@property (nonatomic, copy, nullable) NSString *contentType;
@property (nonatomic, strong, nullable) NSDictionary *meta;
@property (nonatomic, strong, nullable) NSArray<WLAgentSkillsSessionMessagePart *> *parts;
@property (nonatomic, copy) NSString *createdAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsStopSkillResult : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *status;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsRegisterSessionListenerResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsUnregisterSessionListenerResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsCloseSkillResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsReplyPermissionResult : NSObject
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *permissionId;
@property (nonatomic, copy) NSString *response;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsControlSkillWeCodeResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSendMessageToIMResult : NSObject
@property (nonatomic, assign) BOOL success;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsCreateDigitalTwinResult : NSObject
@property (nonatomic, copy) NSString *robotId;
@property (nonatomic, copy) NSString *partnerAccount;
@property (nonatomic, copy) NSString *message;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsAgentTypeListResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsAgentType *> *content;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsWeAgentListResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsWeAgent *> *content;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsWeAgentDetailsArrayResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsWeAgentDetails *> *weAgentDetailsArray;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsUpdateWeAgentResult : NSObject
@property (nonatomic, copy) NSString *updateResult;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsDeleteWeAgentResult : NSObject
@property (nonatomic, copy) NSString *deleteResult;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsOpenAssistantEditPageResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsNotifyAssistantDetailUpdatedResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsUpdateQrcodeInfoResult : NSObject
@property (nonatomic, copy) NSString *status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSessionStatusResult : NSObject
@property (nonatomic, assign) WLAgentSkillsClientSessionStatus status;

- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSkillWecodeStatusResult : NSObject
@property (nonatomic, assign) WLAgentSkillsWecodeStatus status;
@property (nonatomic, strong, nullable) NSNumber *timestamp;
@property (nonatomic, copy, nullable) NSString *message;

- (NSDictionary *)toDictionary;
@end

NS_ASSUME_NONNULL_END
