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

#pragma mark - Callback Typedefs

typedef void (^WLAgentSkillsSessionStatusCallback)(WLAgentSkillsSessionStatusResult *result);
typedef void (^WLAgentSkillsWecodeStatusCallback)(WLAgentSkillsSkillWecodeStatusResult *result);
typedef void (^WLAgentSkillsSessionMessageCallback)(WLAgentSkillsStreamMessage *message);
typedef void (^WLAgentSkillsSessionErrorCallback)(WLAgentSkillsSessionError *error);
typedef void (^WLAgentSkillsSessionCloseCallback)(NSString *reason);

#pragma mark - Param Models

@interface WLAgentSkillsCreateSessionParams : NSObject
@property (nonatomic, copy) NSString *ak;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy) NSString *imGroupId;
@end

@interface WLAgentSkillsStopSkillParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@end

@interface WLAgentSkillsOnSessionStatusChangeParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) WLAgentSkillsSessionStatusCallback callback;
@end

@interface WLAgentSkillsOnSkillWecodeStatusChangeParams : NSObject
@property (nonatomic, copy) WLAgentSkillsWecodeStatusCallback callback;
@end

@interface WLAgentSkillsRegenerateAnswerParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@end

@interface WLAgentSkillsSendMessageToIMParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy, nullable) NSString *messageId;
@property (nonatomic, copy, nullable) NSString *chatId;
@end

@interface WLAgentSkillsGetSessionMessageParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, strong, nullable) NSNumber *page;
@property (nonatomic, strong, nullable) NSNumber *size;
@end

@interface WLAgentSkillsRegisterSessionListenerParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) WLAgentSkillsSessionMessageCallback onMessage;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionErrorCallback onError;
@property (nonatomic, copy, nullable) WLAgentSkillsSessionCloseCallback onClose;
@end

@interface WLAgentSkillsUnregisterSessionListenerParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@end

@interface WLAgentSkillsSendMessageParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, copy, nullable) NSString *toolCallId;
@end

@interface WLAgentSkillsReplyPermissionParams : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) NSString *permId;
@property (nonatomic, copy) NSString *response;
@end

@interface WLAgentSkillsControlSkillWeCodeParams : NSObject
@property (nonatomic, assign) WLAgentSkillsWecodeAction action;
@end

#pragma mark - Data Models

@interface WLAgentSkillsSkillSession : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) NSString *userId;
@property (nonatomic, copy) NSString *ak;
@property (nonatomic, copy, nullable) NSString *title;
@property (nonatomic, copy) NSString *imGroupId;
@property (nonatomic, copy) NSString *status;
@property (nonatomic, copy, nullable) NSString *toolSessionId;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy) NSString *updatedAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
@end

@interface WLAgentSkillsSessionMessagePart : NSObject
@property (nonatomic, copy, nullable) NSString *partId;
@property (nonatomic, strong, nullable) NSNumber *partSeq;
@property (nonatomic, copy, nullable) NSString *type;
@property (nonatomic, copy, nullable) NSString *content;
@property (nonatomic, copy, nullable) NSString *toolName;
@property (nonatomic, copy, nullable) NSString *toolCallId;
@property (nonatomic, copy, nullable) NSString *toolStatus;
@property (nonatomic, strong, nullable) NSDictionary *toolInput;
@property (nonatomic, copy, nullable) NSString *toolOutput;
@property (nonatomic, copy, nullable) NSString *header;
@property (nonatomic, copy, nullable) NSString *question;
@property (nonatomic, strong, nullable) NSArray<NSString *> *options;
@property (nonatomic, copy, nullable) NSString *permissionId;
@property (nonatomic, copy, nullable) NSString *fileName;
@property (nonatomic, copy, nullable) NSString *fileUrl;
@property (nonatomic, copy, nullable) NSString *fileMime;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsSessionMessage : NSObject
@property (nonatomic, copy) NSString *id;
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy, nullable) NSString *userId;
@property (nonatomic, copy) NSString *role;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, strong) NSNumber *messageSeq;
@property (nonatomic, strong) NSArray<WLAgentSkillsSessionMessagePart *> *parts;
@property (nonatomic, copy) NSString *createdAt;
@property (nonatomic, copy, nullable) NSString *contentType;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;
@end

@interface WLAgentSkillsPageResult : NSObject
@property (nonatomic, strong) NSArray<WLAgentSkillsSessionMessage *> *content;
@property (nonatomic, strong) NSNumber *page;
@property (nonatomic, strong) NSNumber *size;
@property (nonatomic, strong) NSNumber *total;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
@end

@interface WLAgentSkillsSessionError : NSObject
@property (nonatomic, copy) NSString *code;
@property (nonatomic, copy) NSString *message;
@property (nonatomic, strong) NSNumber *timestamp;

- (instancetype)initWithCode:(NSString *)code message:(NSString *)message;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
@end

@interface WLAgentSkillsStreamMessage : NSObject
@property (nonatomic, copy) NSString *type;
@property (nonatomic, strong) NSNumber *seq;
@property (nonatomic, copy) NSString *welinkSessionId;
@property (nonatomic, copy) NSString *emittedAt;
@property (nonatomic, strong, nullable) NSDictionary *raw;

@property (nonatomic, copy, nullable) NSString *messageId;
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
@end

#pragma mark - Result Models

@interface WLAgentSkillsSendMessageResult : NSObject
@property (nonatomic, strong) NSNumber *id;
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) NSString *userId;
@property (nonatomic, copy) NSString *role;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, strong) NSNumber *messageSeq;
@property (nonatomic, copy) NSString *createdAt;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
@end

@interface WLAgentSkillsStopSkillResult : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) NSString *status;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
@end

@interface WLAgentSkillsRegisterSessionListenerResult : NSObject
@property (nonatomic, copy) NSString *status;
@end

@interface WLAgentSkillsUnregisterSessionListenerResult : NSObject
@property (nonatomic, copy) NSString *status;
@end

@interface WLAgentSkillsCloseSkillResult : NSObject
@property (nonatomic, copy) NSString *status;
@end

@interface WLAgentSkillsReplyPermissionResult : NSObject
@property (nonatomic, strong) NSNumber *welinkSessionId;
@property (nonatomic, copy) NSString *permissionId;
@property (nonatomic, copy) NSString *response;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
@end

@interface WLAgentSkillsControlSkillWeCodeResult : NSObject
@property (nonatomic, copy) NSString *status;
@end

@interface WLAgentSkillsSendMessageToIMResult : NSObject
@property (nonatomic, copy) NSString *status;
@property (nonatomic, copy, nullable) NSString *chatId;
@property (nonatomic, strong, nullable) NSNumber *contentLength;
@end

@interface WLAgentSkillsSessionStatusResult : NSObject
@property (nonatomic, assign) WLAgentSkillsClientSessionStatus status;
@end

@interface WLAgentSkillsSkillWecodeStatusResult : NSObject
@property (nonatomic, assign) WLAgentSkillsWecodeStatus status;
@property (nonatomic, strong, nullable) NSNumber *timestamp;
@property (nonatomic, copy, nullable) NSString *message;
@end

NS_ASSUME_NONNULL_END
