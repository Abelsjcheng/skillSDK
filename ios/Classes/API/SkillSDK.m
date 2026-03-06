//
//  SkillSDK.m
//  SkillSDK
//
//  Skill SDK 主接口实现
//  提供技能执行、会话管理、消息发送等核心功能
//  采用单例模式设计，确保全局唯一实例
//
//  @author OpenCode Team
//  @version 1.0.0
//  @since 2026-03-06
//

#import "SkillSDK.h"
#import "SkillSessionManager.h"
#import "SkillWebSocketManager.h"
#import "SkillHTTPClient.h"

@interface SkillSDKConfig ()
@end

@implementation SkillSDKConfig

- (instancetype)initWithBaseUrl:(NSString *)baseUrl
              skillDefinitionId:(NSInteger)skillDefinitionId {
    self = [super init];
    if (self) {
        _baseUrl = baseUrl;
        _skillDefinitionId = skillDefinitionId;
    }
    return self;
}

@end

@interface SkillSDK ()

// 会话管理器，负责会话的创建、管理和销毁
@property (nonatomic, strong) SkillSessionManager *sessionManager;
// 会话状态回调映射表，存储每个会话的状态回调
@property (nonatomic, strong) NSMutableDictionary<NSString *, SkillSessionStatusCallback> *sessionStatusCallbacks;
// 小程序状态回调，接收小程序状态变化通知
@property (nonatomic, copy) SkillWecodeStatusCallback wecodeStatusCallback;

@end

@implementation SkillSDK

/**
 * 获取SkillSDK单例实例
 * 采用dispatch_once确保线程安全和唯一实例
 * 
 * @return SkillSDK单例实例
 */
+ (instancetype)sharedSDK {
    static SkillSDK *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SkillSDK alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sessionStatusCallbacks = [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)initWithConfig:(SkillSDKConfig *)config {
    _sessionManager = [SkillSessionManager sharedInstance];
    [_sessionManager initWithBaseUrl:config.baseUrl
                   skillDefinitionId:config.skillDefinitionId
                      webSocketHost:config.webSocketHost];
}

/**
 * 执行技能，创建会话并发送用户消息
 * 
 * @param imChatId IM聊天ID
 * @param userId 用户ID
 * @param skillContent 用户输入的技能指令内容
 * @param agentId PCAgent ID，可选
 * @param title 会话标题，可选
 * @param handler 完成回调，返回执行结果或错误信息
 */
- (void)executeSkillWithImChatId:(NSString *)imChatId
                          userId:(NSString *)userId
                    skillContent:(NSString *)skillContent
                         agentId:(nullable NSNumber *)agentId
                           title:(nullable NSString *)title
               completionHandler:(void(^)(SkillExecuteSkillResult * _Nullable result, NSError * _Nullable error))handler {
    
    // 获取HTTP客户端实例
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    // 准备创建会话请求参数
    NSInteger userIdInt = [userId integerValue];
    NSDictionary *body = @{
        @"userId": @(userIdInt),
        @"skillDefinitionId": @(self.sessionManager.skillDefinitionId),
        @"imChatId": imChatId
    };
    
    // 构建可变请求体，处理可选参数
    NSMutableDictionary *mutableBody = [body mutableCopy];
    if (agentId) {
        mutableBody[@"agentId"] = agentId;
    }
    if (title) {
        mutableBody[@"title"] = title;
    }
    
    [httpClient postWithURL:@"/api/skill/sessions"
                       body:mutableBody
          completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        NSDictionary *sessionDict = (NSDictionary *)result;
        NSNumber *sessionIdNum = sessionDict[@"id"];
        NSString *sessionId = [NSString stringWithFormat:@"%@", sessionIdNum];
        NSString *toolSessionId = sessionDict[@"toolSessionId"];
        NSString *statusStr = sessionDict[@"status"];
        NSString *createdAtStr = sessionDict[@"createdAt"];
        
        SkillWebSocketManager *wsManager = [[SkillWebSocketManager alloc] init];
        
        __weak typeof(self) weakSelf = self;
        SkillStreamMessageCallback messageCallback = ^(SkillStreamMessage *message) {
            __strong typeof(self) strongSelf = weakSelf;
            if (!strongSelf) return;
            
            SkillSessionStatusCallback statusCallback = strongSelf.sessionStatusCallbacks[sessionId];
            if (statusCallback) {
                if (message.type == SkillStreamMessageTypeDelta) {
                    statusCallback(SkillSessionStatusExecuting);
                } else if (message.type == SkillStreamMessageTypeDone) {
                    statusCallback(SkillSessionStatusCompleted);
                } else if (message.type == SkillStreamMessageTypeError) {
                    statusCallback(SkillSessionStatusStopped);
                } else if (message.type == SkillStreamMessageTypeAgentOffline) {
                    statusCallback(SkillSessionStatusStopped);
                }
            }
        };
        
        [wsManager connectWithSessionId:sessionId
                                   host:self.sessionManager.getWebSocketHost
                                onMessage:messageCallback
                                 onStatus:nil
                        completionHandler:^(BOOL success, NSError * _Nullable error) {
            if (error) {
                if (handler) {
                    handler(nil, error);
                }
                return;
            }
            
            [self.sessionManager addSession:sessionId wsManager:wsManager];
            
            NSDictionary *sendBody = @{@"content": skillContent};
            [httpClient postWithURL:[NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId]
                               body:sendBody
                  completionHandler:^(id _Nullable result, NSError * _Nullable error) {
                if (error) {
                    if (handler) {
                        handler(nil, error);
                    }
                    return;
                }
                
                SkillExecuteSkillResult *executeResult = [[SkillExecuteSkillResult alloc] init];
                executeResult.sessionId = sessionId;
                executeResult.toolSessionId = toolSessionId;
                executeResult.createdAt = [self parseDateToTimestamp:createdAtStr];
                
                if ([statusStr isEqualToString:@"ACTIVE"]) {
                    executeResult.status = SkillSessionStatusExecuting;
                } else if ([statusStr isEqualToString:@"CLOSED"]) {
                    executeResult.status = SkillSessionStatusStopped;
                } else {
                    executeResult.status = SkillSessionStatusExecuting;
                }
                
                if (handler) {
                    handler(executeResult, nil);
                }
            }];
        }];
    }];
}

- (void)closeSkillWithSessionId:(NSString *)sessionId
              completionHandler:(void(^)(SkillCloseSkillResult * _Nullable result, NSError * _Nullable error))handler {
    
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    [httpClient deleteWithURL:[NSString stringWithFormat:@"/api/skill/sessions/%@", sessionId]
            completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        [self.sessionManager removeSession:sessionId];
        [self.sessionStatusCallbacks removeObjectForKey:sessionId];
        
        SkillCloseSkillResult *closeResult = [[SkillCloseSkillResult alloc] init];
        closeResult.success = YES;
        
        if (handler) {
            handler(closeResult, nil);
        }
    }];
}

- (void)stopSkillWithSessionId:(NSString *)sessionId
             completionHandler:(void(^)(SkillStopSkillResult * _Nullable result, NSError * _Nullable error))handler {
    
    SkillSessionInfo *session = [self.sessionManager getSession:sessionId];
    
    if (session) {
        [session.wsManager close];
        [self.sessionManager updateSessionState:sessionId state:SkillSessionStateIdle];
        [self.sessionStatusCallbacks removeObjectForKey:sessionId];
    }
    
    SkillStopSkillResult *stopResult = [[SkillStopSkillResult alloc] init];
    stopResult.success = YES;
    
    if (handler) {
        handler(stopResult, nil);
    }
}

- (void)onSessionStatusWithSessionId:(NSString *)sessionId
                            callback:(SkillSessionStatusCallback)callback {
    
    self.sessionStatusCallbacks[sessionId] = callback;
    
    SkillSessionInfo *session = [self.sessionManager getSession:sessionId];
    if (session) {
        [session.wsManager setStatusCallback:callback];
    }
}

- (void)onSkillWecodeStatusWithCallback:(SkillWecodeStatusCallback)callback {
    self.wecodeStatusCallback = callback;
}

- (void)regenerateAnswerWithSessionId:(NSString *)sessionId
                    completionHandler:(void(^)(SkillAnswerResult * _Nullable result, NSError * _Nullable error))handler {
    
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages?page=0&size=50", sessionId];
    [httpClient getWithURL:url
                    params:nil
         completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        NSDictionary *pageResult = (NSDictionary *)result;
        NSArray *content = pageResult[@"content"];
        
        NSMutableArray *userMessages = [NSMutableArray array];
        for (NSDictionary *msgDict in content) {
            NSString *role = msgDict[@"role"];
            if ([role isEqualToString:@"USER"]) {
                [userMessages addObject:msgDict];
            }
        }
        
        if (userMessages.count == 0) {
            SkillAnswerResult *answerResult = [[SkillAnswerResult alloc] init];
            answerResult.messageId = @"";
            answerResult.success = NO;
            
            if (handler) {
                handler(answerResult, nil);
            }
            return;
        }
        
        NSDictionary *lastUserMessage = userMessages.lastObject;
        NSString *contentStr = lastUserMessage[@"content"];
        
        NSDictionary *sendBody = @{@"content": contentStr};
        [httpClient postWithURL:[NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId]
                           body:sendBody
              completionHandler:^(id _Nullable result, NSError * _Nullable error) {
            if (error) {
                if (handler) {
                    handler(nil, error);
                }
                return;
            }
            
            NSDictionary *messageDict = (NSDictionary *)result;
            NSNumber *messageIdNum = messageDict[@"id"];
            
            SkillAnswerResult *answerResult = [[SkillAnswerResult alloc] init];
            answerResult.messageId = [NSString stringWithFormat:@"%@", messageIdNum];
            answerResult.success = YES;
            
            if (handler) {
                handler(answerResult, nil);
            }
        }];
    }];
}

- (void)sendMessageToIMWithSessionId:(NSString *)sessionId
                             content:(NSString *)content
                   completionHandler:(void(^)(SkillSendMessageToIMResult * _Nullable result, NSError * _Nullable error))handler {
    
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    NSDictionary *body = @{@"content": content};
    [httpClient postWithURL:[NSString stringWithFormat:@"/api/skill/sessions/%@/send-to-im", sessionId]
                       body:body
          completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        NSDictionary *responseDict = (NSDictionary *)result;
        BOOL success = [responseDict[@"success"] boolValue];
        
        SkillSendMessageToIMResult *sendResult = [[SkillSendMessageToIMResult alloc] init];
        sendResult.success = success;
        
        if (handler) {
            handler(sendResult, nil);
        }
    }];
}

- (void)getSessionMessageWithSessionId:(NSString *)sessionId
                                  page:(NSInteger)page
                                  size:(NSInteger)size
                     completionHandler:(void(^)(SkillPageResult<SkillChatMessage *> * _Nullable result, NSError * _Nullable error))handler {
    
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    NSDictionary *params = @{
        @"page": @(page),
        @"size": @(size)
    };
    
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId];
    [httpClient getWithURL:url
                    params:params
         completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        SkillPageResult<SkillChatMessage *> *pageResult = [[SkillPageResult alloc] init];
        NSDictionary *pageDict = (NSDictionary *)result;
        
        NSMutableArray *messages = [NSMutableArray array];
        NSArray *content = pageDict[@"content"];
        
        for (NSDictionary *msgDict in content) {
            SkillChatMessage *message = [[SkillChatMessage alloc] init];
            message.id = [msgDict[@"id"] integerValue];
            message.sessionId = [msgDict[@"sessionId"] integerValue];
            message.seq = [msgDict[@"seq"] integerValue];
            
            NSString *roleStr = msgDict[@"role"];
            if ([roleStr isEqualToString:@"USER"]) {
                message.role = SkillMessageRoleUser;
            } else if ([roleStr isEqualToString:@"ASSISTANT"]) {
                message.role = SkillMessageRoleAssistant;
            } else if ([roleStr isEqualToString:@"SYSTEM"]) {
                message.role = SkillMessageRoleSystem;
            } else if ([roleStr isEqualToString:@"TOOL"]) {
                message.role = SkillMessageRoleTool;
            }
            
            message.content = msgDict[@"content"];
            
            NSString *contentTypeStr = msgDict[@"contentType"];
            if ([contentTypeStr isEqualToString:@"CODE"]) {
                message.contentType = SkillContentTypeCode;
            } else if ([contentTypeStr isEqualToString:@"PLAIN"]) {
                message.contentType = SkillContentTypePlain;
            } else {
                message.contentType = SkillContentTypeMarkdown;
            }
            
            message.createdAt = msgDict[@"createdAt"];
            message.meta = msgDict[@"meta"];
            
            [messages addObject:message];
        }
        
        pageResult.content = messages;
        pageResult.totalElements = [pageDict[@"totalElements"] integerValue];
        pageResult.totalPages = [pageDict[@"totalPages"] integerValue];
        pageResult.number = [pageDict[@"number"] integerValue];
        pageResult.size = [pageDict[@"size"] integerValue];
        
        if (handler) {
            handler(pageResult, nil);
        }
    }];
}

- (void)sendMessageWithSessionId:(NSString *)sessionId
                         content:(NSString *)content
                       onMessage:(nullable SkillStreamMessageCallback)onMessage
               completionHandler:(void(^)(SkillSendMessageResult * _Nullable result, NSError * _Nullable error))handler {
    
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    NSDictionary *body = @{@"content": content};
    [httpClient postWithURL:[NSString stringWithFormat:@"/api/skill/sessions/%@/messages", sessionId]
                       body:body
          completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        if (onMessage) {
            SkillSessionInfo *session = [self.sessionManager getSession:sessionId];
            if (session) {
                [session.wsManager setMessageCallback:onMessage];
            }
        }
        
        SkillSendMessageResult *sendResult = [[SkillSendMessageResult alloc] init];
        sendResult.success = YES;
        
        if (handler) {
            handler(sendResult, nil);
        }
    }];
}

- (void)replyPermissionWithSessionId:(NSString *)sessionId
                        permissionId:(NSString *)permissionId
                            approved:(BOOL)approved
                   completionHandler:(void(^)(SkillReplyPermissionResult * _Nullable result, NSError * _Nullable error))handler {
    
    SkillHTTPClient *httpClient = self.sessionManager.httpClient;
    
    NSDictionary *body = @{@"approved": @(approved)};
    NSString *url = [NSString stringWithFormat:@"/api/skill/sessions/%@/permissions/%@", sessionId, permissionId];
    [httpClient postWithURL:url
                       body:body
          completionHandler:^(id _Nullable result, NSError * _Nullable error) {
        if (error) {
            if (handler) {
                handler(nil, error);
            }
            return;
        }
        
        NSDictionary *responseDict = (NSDictionary *)result;
        BOOL success = [responseDict[@"success"] boolValue];
        
        SkillReplyPermissionResult *replyResult = [[SkillReplyPermissionResult alloc] init];
        replyResult.success = success;
        
        if (handler) {
            handler(replyResult, nil);
        }
    }];
}

- (void)controlSkillWeCodeWithAction:(SkillWeCodeAction)action
                   completionHandler:(void(^)(SkillControlSkillWeCodeResult * _Nullable result, NSError * _Nullable error))handler {
    
    if (action == SkillWeCodeActionClose) {
        NSDictionary *allSessions = [self.sessionManager getAllSessions];
        for (NSString *sessionId in allSessions.allKeys) {
            [self closeSkillWithSessionId:sessionId completionHandler:nil];
        }
        
        if (self.wecodeStatusCallback) {
            self.wecodeStatusCallback(SkillWecodeStatusClosed);
        }
    } else if (action == SkillWeCodeActionMinimize) {
        if (self.wecodeStatusCallback) {
            self.wecodeStatusCallback(SkillWecodeStatusMinimized);
        }
    }
    
    SkillControlSkillWeCodeResult *controlResult = [[SkillControlSkillWeCodeResult alloc] init];
    controlResult.success = YES;
    
    if (handler) {
        handler(controlResult, nil);
    }
}

- (NSTimeInterval)parseDateToTimestamp:(NSString *)dateString {
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss";
    formatter.timeZone = [NSTimeZone timeZoneWithAbbreviation:@"UTC"];
    
    NSDate *date = [formatter dateFromString:dateString];
    if (date) {
        return [date timeIntervalSince1970] * 1000;
    }
    return 0;
}

@end
