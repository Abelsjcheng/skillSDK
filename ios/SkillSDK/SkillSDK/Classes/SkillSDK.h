//
//  SkillSDK.h
//  SkillSDK
//

#import <Foundation/Foundation.h>
#import "SkillSession.h"
#import "SkillMessage.h"
#import "StreamMessage.h"
#import "SkillSDKConfig.h"

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, SessionStatus) {
    SessionStatusExecuting = 0,
    SessionStatusStopped = 1,
    SessionStatusCompleted = 2
};

typedef NS_ENUM(NSInteger, SkillWecodeStatus) {
    SkillWecodeStatusClosed = 0,
    SkillWecodeStatusMinimized = 1
};

typedef NS_ENUM(NSInteger, SkillWeCodeAction) {
    SkillWeCodeActionClose = 0,
    SkillWeCodeActionMinimize = 1
};

typedef void (^SkillSessionCallback)(SkillSession *session, NSError * _Nullable error);
typedef void (^SkillMessageCallback)(SkillMessage *message, NSError * _Nullable error);
typedef void (^SkillResultCallback)(NSDictionary *result, NSError * _Nullable error);
typedef void (^SkillVoidCallback)(NSError * _Nullable error);

typedef void (^SessionStatusCallback)(SessionStatus status);
typedef void (^SkillWecodeStatusCallback)(SkillWecodeStatus status);
typedef void (^StreamMessageCallback)(StreamMessage *message);
typedef void (^SessionErrorCallback)(NSError *error);
typedef void (^SessionCloseCallback)(NSString *reason);

@interface SkillSDK : NSObject

+ (instancetype)sharedInstance;

#pragma mark - Configuration

- (void)configureWithBaseURL:(NSString *)baseURL;
- (void)configureWithBaseURL:(NSString *)baseURL wsURL:(NSString *)wsURL;

#pragma mark - 1. Execute Skill

- (void)executeSkillWithImChatId:(NSString *)imChatId
               skillDefinitionId:(NSInteger)skillDefinitionId
                         userId:(NSString *)userId
                    skillContent:(NSString *)skillContent
                        agentId:(NSInteger)agentId
                          title:(nullable NSString *)title
                      completion:(SkillSessionCallback)completion;

#pragma mark - 2. Close Skill

- (void)closeSkillWithSessionId:(NSString *)sessionId
                      completion:(SkillResultCallback)completion;

#pragma mark - 3. Stop Skill

- (void)stopSkillWithSessionId:(NSString *)sessionId
                    completion:(SkillResultCallback)completion;

#pragma mark - 4. On Session Status Change

- (void)onSessionStatusChangeWithSessionId:(NSString *)sessionId
                                  callback:(SessionStatusCallback)callback;

#pragma mark - 5. On Skill Wecode Status Change

- (void)onSkillWecodeStatusChange:(SkillWecodeStatusCallback)callback;

#pragma mark - 6. Regenerate Answer

- (void)regenerateAnswerWithSessionId:(NSString *)sessionId
                              content:(NSString *)content
                           completion:(SkillMessageCallback)completion;

#pragma mark - 7. Send Message To IM

- (void)sendMessageToIMWithSessionId:(NSString *)sessionId
                             content:(NSString *)content
                          completion:(SkillResultCallback)completion;

#pragma mark - 8. Get Session Message

- (void)getSessionMessageWithSessionId:(NSString *)sessionId
                                  page:(NSInteger)page
                                  size:(NSInteger)size
                            completion:(SkillResultCallback)completion;

#pragma mark - 9. Register Session Listener

- (void)registerSessionListenerWithSessionId:(NSString *)sessionId
                                    onMessage:(StreamMessageCallback)onMessage
                                      onError:(nullable SessionErrorCallback)onError
                                     onClose:(nullable SessionCloseCallback)onClose;

#pragma mark - 10. Unregister Session Listener

- (void)unregisterSessionListenerWithSessionId:(NSString *)sessionId
                                     onMessage:(StreamMessageCallback)onMessage
                                       onError:(nullable SessionErrorCallback)onError
                                      onClose:(nullable SessionCloseCallback)onClose;

#pragma mark - 11. Send Message

- (void)sendMessageWithSessionId:(NSString *)sessionId
                         content:(NSString *)content
                      completion:(SkillMessageCallback)completion;

#pragma mark - 12. Reply Permission

- (void)replyPermissionWithSessionId:(NSString *)sessionId
                         permissionId:(NSString *)permissionId
                             approved:(BOOL)approved
                           completion:(SkillResultCallback)completion;

#pragma mark - 13. Control Skill WeCode

- (void)controlSkillWeCodeWithAction:(SkillWeCodeAction)action
                           completion:(SkillResultCallback)completion;

@end

NS_ASSUME_NONNULL_END