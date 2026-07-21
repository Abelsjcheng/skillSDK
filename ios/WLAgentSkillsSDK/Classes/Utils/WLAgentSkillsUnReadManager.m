#import "WLAgentSkillsUnReadManager.h"
#import "WLAgentSkillsHTTPClient.h"
#import "WLAgentSkillsLog.h"
#import "WLAgentSkillsTypeConverter.h"
#import "WLAgentSkillsWeAgentStore.h"

@interface WLAgentSkillsUnReadManager ()
@property (nonatomic, copy) NSString *partnerAccount;
@property (nonatomic, copy) NSString *bizRobotTag;
@property (nonatomic, copy) NSString *viewingSessionId;
@property (nonatomic, assign) BOOL agentTabNotifyEnabled;
@property (nonatomic, assign) BOOL myAgentUnread;
@property (nonatomic, assign) BOOL networkRefreshInFlight;
@property (nonatomic, strong) NSMutableDictionary<NSString *, WLAgentSkillsSessionUnreadState *> *sessions;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *reportedReadSeq;
@end

@implementation WLAgentSkillsUnReadManager

+ (instancetype)sharedManager {
  static WLAgentSkillsUnReadManager *manager;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    manager = [self new];
  });
  return manager;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _sessions = [NSMutableDictionary dictionary];
    _reportedReadSeq = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)initUnReadState {
  self.agentTabNotifyEnabled = [self isAgentTabNotifyEnabled];
  if (!self.agentTabNotifyEnabled) {
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] skip initialization: AgentTabNotify is unavailable");
    return;
  }
  [self registerImUnreadNotifications];
  [self registerNetworkStatusListener];
  NSDictionary *currentDetail = [[WLAgentSkillsWeAgentStore sharedStore] loadCurrentWeAgentDetailDictionary];
  NSString *partnerAccount =
    [WLAgentSkillsTypeConverter optionalStringFromValue:currentDetail[@"partnerAccount"]];
  if (partnerAccount.length == 0) {
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] skip initialization: partnerAccount is empty");
    return;
  }
  [self refreshCurrentAssistantUnread:partnerAccount bizRobotTag:currentDetail[@"bizRobotTag"]];
}

- (void)getWeAgentUnreadMessage:(WLAgentSkillsGetWeAgentUnreadMessageParams *)params
                         success:(void (^)(WLAgentSkillsGetWeAgentUnreadMessageResult *))success
                         failure:(void (^)(NSError *))failure {
  // 查询指定助理的未读会话，并在请求失败时优先返回当前助理内存缓存。
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] query partnerAccount=%@", params.assistantAccount);
  [self requestWeAgentUnreadMessageWithPartnerAccount:params.assistantAccount
                                            sessionIds:params.sessionIds
                                               success:^(id response) {
    if (![response isKindOfClass:[NSDictionary class]]) {
      response = @{};
    }
    if (success) {
      WLAgentSkillsGetWeAgentUnreadMessageResult *result = [self applyResponse:response
                                                                  partnerAccount:params.assistantAccount
                                                                      sessionIds:params.sessionIds
                                                                          source:@"server"];
      [self onUnReadedChanged:@"server" shouldBroadcast:NO];
      WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] query succeeded, partnerAccount=%@",
                 params.assistantAccount);
      success(result);
    }
  } failure:^(NSError *error) {
    WLAgentSkillsGetWeAgentUnreadMessageResult *cachedResult = nil;
    @synchronized (self) {
      if ([params.assistantAccount isEqualToString:self.partnerAccount]) {
        cachedResult = [self snapshot:@"cache"];
      }
    }
    if (cachedResult != nil) {
      WKFLogInfo(WLAS_BUNDLE_NAME,
                 @"[WeAgentUnread] query failed, return memory cache, partnerAccount=%@",
                 params.assistantAccount);
      if (success) {
        success(cachedResult);
      }
      return;
    }
    WKFLogError(WLAS_BUNDLE_NAME,
                @"[WeAgentUnread] query failed, no matching memory cache, partnerAccount=%@, error=%@",
                params.assistantAccount,
                error.localizedDescription);
    if (failure) {
      failure(error);
    }
  }];
}

- (void)reportWeAgentSessionRead:(WLAgentSkillsReportWeAgentSessionReadParams *)params
                          success:(void (^)(void))success
                          failure:(void (^)(NSError *))failure {
  // 按会话记录最大已读序号，避免重复向服务端上报。
  @synchronized (self) {
    if ([self.reportedReadSeq[params.welinkSessionId] integerValue] >= params.readSeq.integerValue) {
      WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] report read succeeded without request, sessionId=%@",
                 params.welinkSessionId);
      if (success) {
        success();
      }
      return;
    }
  }
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] report read, sessionId=%@, readSeq=%@",
             params.welinkSessionId, params.readSeq);
  [[WLAgentSkillsHTTPClient sharedClient] reportWeAgentSessionReadWithSessionId:params.welinkSessionId
                                                                         readSeq:params.readSeq
                                                                         success:^(id response) {
    @synchronized (self) {
      self.reportedReadSeq[params.welinkSessionId] = params.readSeq;
      [self markRead:params.welinkSessionId maxSeq:params.readSeq.integerValue];
    }
    [self onUnReadedChanged:@"readReport" shouldBroadcast:NO];
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] report read succeeded, sessionId=%@",
               params.welinkSessionId);
    if (success) {
      success();
    }
  } failure:^(NSError *error) {
    WKFLogError(WLAS_BUNDLE_NAME, @"[WeAgentUnread] report read failed, sessionId=%@, error=%@",
                params.welinkSessionId, error.localizedDescription);
    if (failure) {
      failure(error);
    }
  }];
}

- (void)onSessionViewing:(WLAgentSkillsOnSessionViewingParams *)params {
  // 页面正在查看会话时立即清除该会话本地未读状态。
  @synchronized (self) {
    self.viewingSessionId = params.welinkSessionId;
    [self markRead:params.welinkSessionId maxSeq:self.sessions[params.welinkSessionId].maxSeq];
  }
  [self onUnReadedChanged:@"sessionViewing"];
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] session viewing succeeded, sessionId=%@",
             params.welinkSessionId);
}

- (void)onSessionViewingEnd:(WLAgentSkillsOnSessionViewingEndParams *)params {
  // 页面离开会话后清除查看态，恢复服务端未读通知处理。
  @synchronized (self) {
    if ([self.viewingSessionId isEqualToString:params.welinkSessionId]) {
      self.viewingSessionId = nil;
    }
  }
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] session viewing end succeeded, sessionId=%@",
             params.welinkSessionId);
}

/// 会话删除后清理本地未读状态，并刷新助理 Tab 小红点。
- (void)onSessionDeleted:(nullable NSString *)rawSessionId {
  NSString *sessionId = [WLAgentSkillsTypeConverter optionalStringFromValue:rawSessionId];
  if (sessionId.length == 0) {
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore deleted session unread refresh: sessionId is empty");
    return;
  }

  __block BOOL changed = NO;
  @synchronized (self) {
    changed = self.sessions[sessionId] != nil;
    [self.sessions removeObjectForKey:sessionId];
    changed = self.reportedReadSeq[sessionId] != nil || changed;
    [self.reportedReadSeq removeObjectForKey:sessionId];
    if ([self.viewingSessionId isEqualToString:sessionId]) {
      self.viewingSessionId = nil;
      changed = YES;
    }
  }
  if (!changed) {
    WKFLogInfo(WLAS_BUNDLE_NAME,
               @"[WeAgentUnread] ignore deleted session unread refresh: session is not cached, sessionId=%@",
               sessionId);
    return;
  }
  [self onUnReadedChanged:@"sessionDeleted"];
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] deleted session unread state cleared, sessionId=%@", sessionId);
}

// 网络恢复后保留旧缓存，查询成功才覆盖未读状态并刷新小红点。
- (void)onNetworkReconnected {
  NSString *partnerAccount = nil;
  NSString *bizRobotTag = nil;
  @synchronized (self) {
    if (!self.agentTabNotifyEnabled || self.partnerAccount.length == 0 || self.networkRefreshInFlight) {
      return;
    }
    if ([self isUniAssistant:self.bizRobotTag]) {
      WKFLogInfo(WLAS_BUNDLE_NAME,
                 @"[WeAgentUnread] skip network reconnect unread refresh, partnerAccount=%@",
                 self.partnerAccount);
      return;
    }
    partnerAccount = self.partnerAccount;
    bizRobotTag = self.bizRobotTag;
    self.networkRefreshInFlight = YES;
  }

  WKFLogInfo(WLAS_BUNDLE_NAME,
             @"[WeAgentUnread] start network reconnect unread refresh, partnerAccount=%@",
             partnerAccount);
  if ([self isMyAgent:bizRobotTag]) {
    [self requestMyAgentUnreadMessageWithSuccess:^(id response) {
      NSDictionary *data = [response isKindOfClass:[NSDictionary class]] ? response : @{};
      BOOL current = NO;
      @synchronized (self) {
        current = [partnerAccount isEqualToString:self.partnerAccount];
        if (current) {
          self.myAgentUnread = [data[@"un_read_count"] integerValue] > 0;
        }
        self.networkRefreshInFlight = NO;
      }
      if (!current) {
        return;
      }
      WKFLogInfo(WLAS_BUNDLE_NAME,
                 @"[WeAgentUnread] network reconnect unread refresh succeeded, partnerAccount=%@",
                 partnerAccount);
      [self onUnReadedChanged:@"networkReconnect"];
    } failure:^(NSError *error) {
      [self finishNetworkReconnectRefreshWithError:error];
    }];
    return;
  }

  [self requestWeAgentUnreadMessageWithPartnerAccount:partnerAccount
                                            sessionIds:nil
                                               success:^(id response) {
    NSDictionary *data = [response isKindOfClass:[NSDictionary class]] ? response : @{};
    BOOL current = NO;
    @synchronized (self) {
      current = [partnerAccount isEqualToString:self.partnerAccount];
      if (current) {
        [self applyResponse:data partnerAccount:partnerAccount sessionIds:nil source:@"networkReconnect"];
      }
      self.networkRefreshInFlight = NO;
    }
    if (!current) {
      return;
    }
    WKFLogInfo(WLAS_BUNDLE_NAME,
               @"[WeAgentUnread] network reconnect unread refresh succeeded, partnerAccount=%@",
               partnerAccount);
    [self onUnReadedChanged:@"networkReconnect"];
  } failure:^(NSError *error) {
    [self finishNetworkReconnectRefreshWithError:error];
  }];
}

/// 助理切换后清空旧未读状态，并加载新助理的未读状态。
- (void)onAssistantChanged:(nullable WLAgentSkillsWeAgentDetails *)assistantDetail {
  NSString *partnerAccount =
    [WLAgentSkillsTypeConverter optionalStringFromValue:assistantDetail.partnerAccount];
  NSString *bizRobotTag =
    [WLAgentSkillsTypeConverter optionalStringFromValue:assistantDetail.bizRobotTag];
  [self clearUnreadStateForPartnerAccount:partnerAccount ?: @"" bizRobotTag:bizRobotTag];
  if (!self.agentTabNotifyEnabled) {
    [self setHostWeAgentTabRedDot:NO];
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] skip refresh after assistant change: AgentTabNotify is unavailable");
    return;
  }
  if (partnerAccount.length == 0) {
    [self setHostWeAgentTabRedDot:NO];
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] skip refresh after assistant change: partnerAccount is empty");
    return;
  }
  [self onUnReadedChanged:@"assistantChanged"];
  [self refreshCurrentAssistantUnread:partnerAccount bizRobotTag:bizRobotTag];
}

/// 消费已由宿主 IM 适配层解析的未读通知。
- (BOOL)handleImUnreadNotifyData:(NSDictionary *)notifyData {
  return [self handleEmployeeAssistantImUnreadNotifyData:notifyData]
    || [self handleCuiImUnreadNotifyData:notifyData];
}

/// 消费员工助手 uni-assistant 模块下发的 un_read_count 通知。
- (BOOL)handleEmployeeAssistantImUnreadNotifyData:(NSDictionary *)notifyData {
  if (![self isMyAgent:self.bizRobotTag]) {
    return NO;
  }
  id rawContent = notifyData[@"notify_content"];
  NSDictionary *content = nil;
  if ([rawContent isKindOfClass:[NSString class]]) {
    NSData *contentData = [(NSString *)rawContent dataUsingEncoding:NSUTF8StringEncoding];
    content = contentData == nil ? nil : [NSJSONSerialization JSONObjectWithData:contentData options:0 error:nil];
  }
  if (![content isKindOfClass:[NSDictionary class]] || content[@"un_read_count"] == nil) {
    WKFLogError(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore MyAgent IM notification: notify_content is invalid");
    return YES;
  }
  @synchronized (self) {
    self.myAgentUnread = [self nonNegativeInteger:content[@"un_read_count"] fallback:0] > 0;
  }
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] applied MyAgent IM notification, hasUnread=%@",
             self.myAgentUnread ? @"YES" : @"NO");
  [self onUnReadedChanged:@"serverPush"];
  return YES;
}

/// 消费 CUI welink-athena 模块下发的 session.unread/session.read 通知。
- (BOOL)handleCuiImUnreadNotifyData:(NSDictionary *)notifyData {
  NSString *notifyType =
    [WLAgentSkillsTypeConverter optionalStringFromValue:notifyData[@"notify_type"]];
  if (![notifyType isEqualToString:@"session.unread"] && ![notifyType isEqualToString:@"session.read"]) {
    return NO;
  }
  id rawContent = notifyData[@"notyfy_content"];
  if (![rawContent isKindOfClass:[NSDictionary class]]) {
    WKFLogError(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore IM notification: notyfy_content is invalid");
    return YES;
  }
  NSDictionary *content = (NSDictionary *)rawContent;
  NSString *partnerAccount =
    [WLAgentSkillsTypeConverter optionalStringFromValue:content[@"assistantAccount"]];
  NSString *welinkSessionId =
    [WLAgentSkillsTypeConverter optionalStringFromValue:content[@"welinkSessionId"]];
  if (partnerAccount.length == 0 || welinkSessionId.length == 0) {
    WKFLogError(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore IM notification: assistantAccount or welinkSessionId is missing");
    return YES;
  }
  @synchronized (self) {
    if (![partnerAccount isEqualToString:self.partnerAccount]) {
      WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore notification for inactive assistant, partnerAccount=%@", partnerAccount);
      return YES;
    }
    NSInteger maxSeq = [self nonNegativeInteger:content[@"maxSeq"]
                                       fallback:self.sessions[welinkSessionId].maxSeq];
    if ([notifyType isEqualToString:@"session.unread"]) {
      if ([welinkSessionId isEqualToString:self.viewingSessionId]) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore unread state for viewing session, sessionId=%@", welinkSessionId);
        return YES;
      }
      WLAgentSkillsSessionUnreadState *state = [WLAgentSkillsSessionUnreadState new];
      state.welinkSessionId = welinkSessionId;
      state.hasUnRead = YES;
      state.maxSeq = maxSeq;
      self.sessions[welinkSessionId] = state;
    } else {
      [self markRead:welinkSessionId maxSeq:maxSeq];
    }
  }
  WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] applied IM notification, type=%@, sessionId=%@", notifyType, welinkSessionId);
  [self onUnReadedChanged:@"serverPush"];
  return YES;
}

// 将服务端返回的全量未读结果转换为当前助理的会话内存缓存。
- (WLAgentSkillsGetWeAgentUnreadMessageResult *)applyResponse:(NSDictionary *)response
                                                partnerAccount:(NSString *)account
                                                    sessionIds:(NSArray *)sessionIds
                                                        source:(NSString *)source {
  @synchronized (self) {
    self.partnerAccount = account;
    self.myAgentUnread = NO;
    [self.sessions removeAllObjects];
    for (NSDictionary *item in response[@"unreadSessionList"] ?: @[]) {
      NSString *sid = item[@"sessionId"];
      if (sid.length == 0) {
        continue;
      }
      WLAgentSkillsSessionUnreadState *state = [WLAgentSkillsSessionUnreadState new];
      state.welinkSessionId = sid;
      state.hasUnRead = ![sid isEqualToString:self.viewingSessionId];
      state.maxSeq = [item[@"maxSeq"] integerValue];
      self.sessions[sid] = state;
    }
    for (NSString *sid in sessionIds ?: @[]) {
      if (self.sessions[sid] == nil) {
        [self markRead:sid maxSeq:0];
      }
    }
    return [self snapshot:source];
  }
}

// 根据助理类型选择员工助手或 CUI 未读接口刷新当前状态。
- (void)refreshCurrentAssistantUnread:(NSString *)partnerAccount
                          bizRobotTag:(id)bizRobotTagValue {
  NSString *bizRobotTag =
    [WLAgentSkillsTypeConverter optionalStringFromValue:bizRobotTagValue];
  [self clearUnreadStateForPartnerAccount:partnerAccount bizRobotTag:bizRobotTag];
  if ([self isUniAssistant:bizRobotTag]) {
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] skip query for uniassistant, partnerAccount=%@", partnerAccount);
    return;
  }
  if ([self isMyAgent:bizRobotTag]) {
    [self requestMyAgentUnreadMessageWithSuccess:^(id response) {
      NSDictionary *data = [response isKindOfClass:[NSDictionary class]] ? response : @{};
      @synchronized (self) {
        if (![partnerAccount isEqualToString:self.partnerAccount]) {
          WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore stale MyAgent unread response, partnerAccount=%@", partnerAccount);
          return;
        }
        self.myAgentUnread = [data[@"un_read_count"] integerValue] > 0;
      }
      WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] initialized MyAgent unread state, partnerAccount=%@", partnerAccount);
      [self onUnReadedChanged:@"server"];
    } failure:^(NSError *error) {
      WKFLogError(WLAS_BUNDLE_NAME, @"[WeAgentUnread] initialize MyAgent unread state failed, error=%@", error.localizedDescription);
    }];
    return;
  }
  [self requestWeAgentUnreadMessageWithPartnerAccount:partnerAccount
                                            sessionIds:nil
                                               success:^(id response) {
    NSDictionary *data = [response isKindOfClass:[NSDictionary class]] ? response : @{};
    @synchronized (self) {
      if (![partnerAccount isEqualToString:self.partnerAccount]) {
        WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] ignore stale CUI unread response, partnerAccount=%@", partnerAccount);
        return;
      }
      [self applyResponse:data partnerAccount:partnerAccount sessionIds:nil source:@"server"];
    }
    WKFLogInfo(WLAS_BUNDLE_NAME, @"[WeAgentUnread] initialized CUI unread state, partnerAccount=%@", partnerAccount);
    [self onUnReadedChanged:@"server"];
  } failure:^(NSError *error) {
    WKFLogError(WLAS_BUNDLE_NAME, @"[WeAgentUnread] initialize CUI unread state failed, error=%@", error.localizedDescription);
  }];
}

// 切换助理前清理旧助理的会话、查看态和已读上报记录。
- (void)clearUnreadStateForPartnerAccount:(NSString *)partnerAccount
                               bizRobotTag:(nullable NSString *)bizRobotTag {
  @synchronized (self) {
    self.partnerAccount = partnerAccount;
    self.bizRobotTag = bizRobotTag;
    self.viewingSessionId = nil;
    self.myAgentUnread = NO;
    [self.sessions removeAllObjects];
    [self.reportedReadSeq removeAllObjects];
  }
}

- (BOOL)isAgentTabNotifyEnabled {
  // 待接入：调用宿主 ABTest 能力获取 AgentTabNotify 权限。
  return NO;
}

- (void)registerImUnreadNotifications {
  // 待接入：注册宿主 IM 在线和离线未读通知监听。
}

- (void)registerNetworkStatusListener {
  // 待接入：注册宿主网络监听，并在离线恢复后调用 onNetworkReconnected。
}

- (void)onUnReadedChanged:(NSString *)source {
  [self onUnReadedChanged:source shouldBroadcast:YES];
}

- (void)onUnReadedChanged:(NSString *)source shouldBroadcast:(BOOL)shouldBroadcast {
  if (self.partnerAccount.length == 0 || !self.agentTabNotifyEnabled) {
    return;
  }
  WLAgentSkillsGetWeAgentUnreadMessageResult *result = [self snapshot:source];
  BOOL showHostRedDot = [self shouldShowHostWeAgentTabRedDot];
  [self setHostWeAgentTabRedDot:showHostRedDot];
  if (shouldBroadcast) {
    [self broadcastUnreadChanged:result];
  }
  WKFLogInfo(WLAS_BUNDLE_NAME,
             @"[WeAgentUnread] state changed, source=%@, partnerAccount=%@, redDotVisible=%@, showHostRedDot=%@",
             source,
             self.partnerAccount,
             result.redDotVisible ? @"YES" : @"NO",
             showHostRedDot ? @"YES" : @"NO");
}

// 结合权限、助理类型、未读状态和 Tab 聚焦状态计算是否显示小红点。
- (BOOL)shouldShowHostWeAgentTabRedDot {
  if (!self.agentTabNotifyEnabled) {
    return NO;
  }
  if ([self isUniAssistant:self.bizRobotTag]) {
    return NO;
  }
  if ([self isMyAgent:self.bizRobotTag]) {
    return self.myAgentUnread && ![self isHostWeAgentTabFocused];
  }
  for (WLAgentSkillsSessionUnreadState *state in self.sessions.allValues) {
    if (state.hasUnRead
        && (![self isHostWeAgentTabFocused] || ![state.welinkSessionId isEqualToString:self.viewingSessionId])) {
      return YES;
    }
  }
  return NO;
}

- (BOOL)isHostWeAgentTabFocused {
  // 待接入：从宿主读取助理 Tab 是否处于聚焦状态。
  return NO;
}

- (void)setHostWeAgentTabRedDot:(BOOL)visible {
  (void)visible;
  // 待接入：调用宿主适配层显示或隐藏助理 Tab 小红点。
}

- (void)broadcastUnreadChanged:(WLAgentSkillsGetWeAgentUnreadMessageResult *)result {
  (void)result;
  // 待接入：调用 HWH5INNER.eventListener 广播助理未读状态。
}

- (BOOL)isMyAgent:(nullable NSString *)bizRobotTag {
  return [bizRobotTag isEqualToString:@"myAgent"];
}

- (BOOL)isUniAssistant:(nullable NSString *)bizRobotTag {
  return [bizRobotTag isEqualToString:@"uniassistant"];
}

- (void)requestWeAgentUnreadMessageWithPartnerAccount:(NSString *)partnerAccount
                                            sessionIds:(nullable NSArray<NSString *> *)sessionIds
                                               success:(void (^)(id response))success
                                               failure:(void (^)(NSError *error))failure {
  [[WLAgentSkillsHTTPClient sharedClient] getWeAgentUnreadMessageWithAssistantAccount:partnerAccount
                                                                           sessionIds:sessionIds
                                                                              success:success
                                                                              failure:failure];
}

- (void)requestMyAgentUnreadMessageWithSuccess:(void (^)(id response))success
                                        failure:(void (^)(NSError *error))failure {
  [[WLAgentSkillsHTTPClient sharedClient] getMyAgentUnreadMessageWithSuccess:success
                                                                       failure:failure];
}

- (void)finishNetworkReconnectRefreshWithError:(NSError *)error {
  @synchronized (self) {
    self.networkRefreshInFlight = NO;
  }
  WKFLogError(WLAS_BUNDLE_NAME,
              @"[WeAgentUnread] network reconnect unread refresh failed, error=%@",
              error.localizedDescription);
}

- (NSInteger)nonNegativeInteger:(id)value fallback:(NSInteger)fallback {
  if ([value respondsToSelector:@selector(integerValue)]) {
    return MAX([(NSNumber *)value integerValue], 0);
  }
  return fallback;
}

- (void)markRead:(NSString *)sessionId maxSeq:(NSInteger)maxSeq {
  WLAgentSkillsSessionUnreadState *state = [WLAgentSkillsSessionUnreadState new];
  state.welinkSessionId = sessionId;
  state.hasUnRead = NO;
  state.maxSeq = MAX(maxSeq, self.sessions[sessionId].maxSeq);
  self.sessions[sessionId] = state;
}

- (WLAgentSkillsGetWeAgentUnreadMessageResult *)snapshot:(NSString *)source {
  WLAgentSkillsGetWeAgentUnreadMessageResult *result = [WLAgentSkillsGetWeAgentUnreadMessageResult new];
  result.partnerAccount = self.partnerAccount ?: @"";
  result.sessions = self.sessions.allValues;
  NSPredicate *unreadPredicate = [NSPredicate predicateWithBlock:^BOOL(
    WLAgentSkillsSessionUnreadState *state,
    NSDictionary *_) {
    return state.hasUnRead;
  }];
  result.assistantUnread = self.myAgentUnread
    || [result.sessions filteredArrayUsingPredicate:unreadPredicate].count > 0;
  result.redDotVisible = self.agentTabNotifyEnabled;
  result.source = source;
  return result;
}
@end
