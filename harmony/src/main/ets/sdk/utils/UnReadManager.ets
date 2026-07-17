import connection from '@ohos.net.connection';
import { HttpClient } from '../core/HttpClient';
import { Logger } from './Logger';
import { TypeConverter } from './TypeConverter';
import { WeAgentStore } from './WeAgentStore';
import {
  GetWeAgentUnreadMessageParams,
  GetWeAgentUnreadMessageResult,
  OnSessionViewingEndParams,
  OnSessionViewingParams,
  ReportWeAgentSessionReadParams,
  WeAgentDetails,
  WeAgentUnreadSource,
  WeAgentSessionUnreadState
} from '../types';

interface ServerUnreadItem {
  sessionId?: string;
  maxSeq?: number;
}

interface ServerUnreadResult {
  unreadSessionList?: ServerUnreadItem[];
}

interface ServerMyAgentUnreadResult {
  un_read_count?: number;
}

/** 维护当前助理未读状态与助理页小红点，不引入异步任务队列。 */
export class UnReadManager {
  private partnerAccount: string = '';
  private bizRobotTag: string = '';
  private viewingSessionId: string = '';
  private agentTabNotifyEnabled: boolean = false;
  private myAgentUnread: boolean = false;
  private networkStatusKnown: boolean = false;
  private networkAvailable: boolean = false;
  private networkRefreshInFlight: boolean = false;
  private readonly sessions: Map<string, WeAgentSessionUnreadState> = new Map();
  private readonly reportedReadSeq: Map<string, number> = new Map();
  private readonly networkAvailableCallback = (): void => {
    this.onNetworkAvailabilityChanged(true);
  };
  private readonly networkLostCallback = (): void => {
    this.onNetworkAvailabilityChanged(false);
  };

  constructor(
    private readonly httpClient: HttpClient,
    private readonly logger: Logger,
    private readonly weAgentStore: WeAgentStore
  ) {}

  /** SDK 初始化后异步加载当前助理未读状态，不阻塞初始化流程。 */
  async initUnReadState(): Promise<void> {
    this.agentTabNotifyEnabled = this.isAgentTabNotifyEnabled();
    if (!this.agentTabNotifyEnabled) {
      this.logger.info('skip unread initialization: AgentTabNotify is unavailable');
      return;
    }
    this.registerImUnreadNotifications();
    this.registerNetworkStatusListener();
    const currentDetail = this.weAgentStore.loadCurrentDetail();
    const partnerAccount = TypeConverter.normalizeOptionalString(currentDetail?.partnerAccount);
    if (partnerAccount === undefined) {
      this.logger.info('skip unread initialization: partnerAccount is empty');
      return;
    }
    await this.refreshCurrentAssistantUnread(partnerAccount, currentDetail?.bizRobotTag, true, 'server');
  }

  async getWeAgentUnreadMessage(
    params: GetWeAgentUnreadMessageParams
  ): Promise<GetWeAgentUnreadMessageResult> {
    // 查询指定助理的未读会话，并在请求失败时优先返回当前助理内存缓存。
    this.logger.info(`query unread state, partnerAccount=${params.assistantAcount}`);
    try {
      const data = await this.requestWeAgentUnreadMessage(
        params.assistantAcount,
        params.sessionIds
      );
      const result = this.applyServerResult(params.assistantAcount, params.sessionIds, data, 'server');
      this.onUnReadedChanged('server');
      this.logger.info(`query unread state succeeded, partnerAccount=${params.assistantAcount}`);
      return result;
    } catch (error) {
      if (this.partnerAccount === params.assistantAcount) {
        this.logger.info(`query unread state fallback succeeded, partnerAccount=${params.assistantAcount}`);
        return this.snapshot('cache');
      }
      this.logger.error(`query unread state failed, partnerAccount=${params.assistantAcount}, error=${JSON.stringify(error)}`);
      throw error;
    }
  }

  async reportWeAgentSessionRead(
    params: ReportWeAgentSessionReadParams
  ): Promise<void> {
    // 按会话记录最大已读序号，避免重复向服务端上报。
    if ((this.reportedReadSeq.get(params.welinkSessionId) ?? 0) >= params.readSeq) {
      this.logger.info(`report session read succeeded without request, sessionId=${params.welinkSessionId}`);
      return;
    }
    await this.httpClient.post(
      `/api/skill/sessions/${encodeURIComponent(params.welinkSessionId)}/read`,
      { readSeq: params.readSeq }
    );
    this.reportedReadSeq.set(params.welinkSessionId, params.readSeq);
    this.setRead(params.welinkSessionId, params.readSeq);
    this.onUnReadedChanged('readReport');
    this.logger.info(`report session read succeeded, sessionId=${params.welinkSessionId}`);
  }

  onSessionViewing(params: OnSessionViewingParams): void {
    // 页面正在查看会话时立即清除该会话本地未读状态。
    this.viewingSessionId = params.welinkSessionId;
    this.setRead(params.welinkSessionId, this.sessions.get(params.welinkSessionId)?.maxSeq ?? 0);
    this.onUnReadedChanged('sessionViewing');
    this.logger.info(`session viewing succeeded, sessionId=${params.welinkSessionId}`);
  }

  onSessionViewingEnd(params: OnSessionViewingEndParams): void {
    // 页面离开会话后清除查看态，恢复服务端未读通知处理。
    if (this.viewingSessionId === params.welinkSessionId) {
      this.viewingSessionId = '';
    }
    this.logger.info(`session viewing end succeeded, sessionId=${params.welinkSessionId}`);
  }

  /** 会话删除后清理本地未读状态，并刷新助理 Tab 小红点。 */
  onSessionDeleted(rawSessionId: string | undefined): void {
    const sessionId = TypeConverter.normalizeOptionalString(rawSessionId);
    if (sessionId === undefined) {
      this.logger.info('ignore deleted session unread refresh: sessionId is empty');
      return;
    }
    let changed = this.sessions.delete(sessionId);
    changed = this.reportedReadSeq.delete(sessionId) || changed;
    if (this.viewingSessionId === sessionId) {
      this.viewingSessionId = '';
      changed = true;
    }
    if (!changed) {
      this.logger.info(`ignore deleted session unread refresh: session is not cached, sessionId=${sessionId}`);
      return;
    }
    this.onUnReadedChanged('sessionDeleted');
    this.logger.info(`deleted session unread state cleared, sessionId=${sessionId}`);
  }

  /** 助理切换后清空旧未读状态，并加载新助理的未读状态。 */
  async onAssistantChanged(assistantDetail: WeAgentDetails | undefined): Promise<void> {
    const partnerAccount = TypeConverter.normalizeOptionalString(assistantDetail?.partnerAccount);
    const bizRobotTag = TypeConverter.normalizeOptionalString(assistantDetail?.bizRobotTag);
    this.clearUnreadState(partnerAccount ?? '', bizRobotTag);
    if (!this.agentTabNotifyEnabled) {
      this.setHostWeAgentTabRedDot(false);
      this.logger.info('skip unread refresh after assistant change: AgentTabNotify is unavailable');
      return;
    }
    if (partnerAccount === undefined) {
      this.setHostWeAgentTabRedDot(false);
      this.logger.info('skip unread refresh after assistant change: partnerAccount is empty');
      return;
    }
    this.onUnReadedChanged('assistantChanged');
    await this.refreshCurrentAssistantUnread(partnerAccount, bizRobotTag, true, 'server');
  }

  /** 处理宿主 IM 适配层解析后的未读通知。 */
  handleImUnreadNotifyData(notifyData: Record<string, Object>): boolean {
    return this.handleEmployeeAssistantImUnreadNotifyData(notifyData)
      || this.handleCuiImUnreadNotifyData(notifyData);
  }

  /** 处理员工助手 uni-assistant 模块携带 un_read_count 的通知。 */
  handleEmployeeAssistantImUnreadNotifyData(notifyData: Record<string, Object>): boolean {
    if (!this.isMyAgent(this.bizRobotTag) || notifyData.un_read_count === undefined) {
      return false;
    }
    this.myAgentUnread = this.toNonNegativeNumber(notifyData.un_read_count, 0) > 0;
    this.logger.info(`applied MyAgent IM unread notification, hasUnread=${this.myAgentUnread}`);
    this.onUnReadedChanged('serverPush');
    return true;
  }

  /** 处理 CUI 服务端 welink-athena 的会话未读或已读通知。 */
  handleCuiImUnreadNotifyData(notifyData: Record<string, Object>): boolean {
    const notifyType = TypeConverter.normalizeOptionalString(notifyData.notify_type as string | undefined);
    if (notifyType !== 'session.unread' && notifyType !== 'session.read') {
      return false;
    }
    const content = TypeConverter.toRecord(notifyData.notyfy_content);
    if (content === undefined) {
      this.logger.error('ignore unread IM notification: notyfy_content is invalid');
      return true;
    }
    const partnerAccount = TypeConverter.normalizeOptionalString(content.assistantAccount as string | undefined);
    const welinkSessionId = TypeConverter.normalizeOptionalString(content.welinkSessionId as string | undefined);
    if (partnerAccount === undefined || welinkSessionId === undefined) {
      this.logger.error('ignore unread IM notification: assistantAccount or welinkSessionId is missing');
      return true;
    }
    if (partnerAccount !== this.partnerAccount) {
      this.logger.info(`ignore unread IM notification for inactive assistant, partnerAccount=${partnerAccount}`);
      return true;
    }
    const maxSeq = this.toNonNegativeNumber(
      content.maxSeq,
      this.sessions.get(welinkSessionId)?.maxSeq ?? 0
    );
    if (notifyType === 'session.unread') {
      if (welinkSessionId === this.viewingSessionId) {
        this.logger.info(`ignore unread state for viewing session, sessionId=${welinkSessionId}`);
        return true;
      }
      this.sessions.set(welinkSessionId, {
        welinkSessionId,
        hasUnRead: true,
        maxSeq
      });
    } else {
      this.sessions.set(welinkSessionId, {
        welinkSessionId,
        hasUnRead: false,
        maxSeq
      });
    }
    this.logger.info(`applied IM unread notification, type=${notifyType}, sessionId=${welinkSessionId}`);
    this.onUnReadedChanged('serverPush');
    return true;
  }

  // 将服务端返回的全量未读结果转换为当前助理的会话内存缓存。
  private applyServerResult(
    account: string,
    requested: string[] | undefined,
    data: ServerUnreadResult,
    source: WeAgentUnreadSource
  ): GetWeAgentUnreadMessageResult {
    this.partnerAccount = account;
    this.myAgentUnread = false;
    this.sessions.clear();
    for (const item of data.unreadSessionList ?? []) {
      if (item.sessionId === undefined || item.sessionId.length === 0) {
        continue;
      }
      this.sessions.set(item.sessionId, {
        welinkSessionId: item.sessionId,
        hasUnRead: item.sessionId !== this.viewingSessionId,
        maxSeq: item.maxSeq ?? 0
      });
    }
    for (const sessionId of requested ?? []) {
      if (!this.sessions.has(sessionId)) {
        this.setRead(sessionId, 0);
      }
    }
    return this.snapshot(source);
  }

  // 根据助理类型选择员工助手或 CUI 未读接口刷新当前状态。
  private async refreshCurrentAssistantUnread(
    partnerAccount: string,
    bizRobotTag: string | undefined,
    clearState: boolean,
    source: WeAgentUnreadSource
  ): Promise<boolean> {
    if (clearState) {
      this.clearUnreadState(partnerAccount, bizRobotTag);
    }
    if (this.isUniAssistant(bizRobotTag)) {
      this.logger.info(`skip unread query for uniassistant, partnerAccount=${partnerAccount}`);
      return false;
    }
    try {
      if (this.isMyAgent(bizRobotTag)) {
        const data = await this.requestMyAgentUnreadMessage();
        if (this.partnerAccount !== partnerAccount) {
          this.logger.info(`ignore stale MyAgent unread response, partnerAccount=${partnerAccount}`);
          return false;
        }
        this.myAgentUnread = (data.un_read_count ?? 0) > 0;
        this.logger.info(`initialized MyAgent unread state, partnerAccount=${partnerAccount}`);
        this.onUnReadedChanged(source);
        return true;
      }
      const data = await this.requestWeAgentUnreadMessage(partnerAccount);
      if (this.partnerAccount !== partnerAccount) {
        this.logger.info(`ignore stale CUI unread response, partnerAccount=${partnerAccount}`);
        return false;
      }
      this.applyServerResult(partnerAccount, undefined, data, source);
      this.onUnReadedChanged(source);
      this.logger.info(`initialized CUI unread state, partnerAccount=${partnerAccount}`);
      return true;
    } catch (error) {
      this.logger.error(`${source} unread state refresh failed, error=${JSON.stringify(error)}`);
      return false;
    }
  }

  private clearUnreadState(partnerAccount: string, bizRobotTag: string | undefined): void {
    // 切换助理前清理旧助理的会话、查看态和已读上报记录。
    this.partnerAccount = partnerAccount;
    this.bizRobotTag = bizRobotTag ?? '';
    this.viewingSessionId = '';
    this.myAgentUnread = false;
    this.sessions.clear();
    this.reportedReadSeq.clear();
  }

  /** 仅在未读状态初始化时读取宿主 AgentTabNotify ABTest 权限。 */
  private isAgentTabNotifyEnabled(): boolean {
    // 待接入：调用宿主 ABTest 能力获取 AgentTabNotify 权限。
    return false;
  }

  private registerImUnreadNotifications(): void {
    // 待接入：注册宿主 IM 在线和离线未读通知监听。
  }

  private registerNetworkStatusListener(): void {
    connection.on('netAvailable', this.networkAvailableCallback);
    connection.on('netLost', this.networkLostCallback);
  }

  shutdown(): void {
    connection.off('netAvailable', this.networkAvailableCallback);
    connection.off('netLost', this.networkLostCallback);
  }

  private onNetworkAvailabilityChanged(available: boolean): void {
    // 仅识别从不可用到可用的网络状态变化。
    if (!this.networkStatusKnown) {
      this.networkStatusKnown = true;
      this.networkAvailable = available;
      return;
    }
    const reconnected = !this.networkAvailable && available;
    this.networkAvailable = available;
    if (reconnected) {
      void this.onNetworkReconnected();
    }
  }

  private async onNetworkReconnected(): Promise<void> {
    // 网络恢复后保留旧缓存，查询成功才覆盖未读状态并刷新小红点。
    if (!this.agentTabNotifyEnabled || this.partnerAccount.length === 0 || this.networkRefreshInFlight) {
      return;
    }
    if (this.isUniAssistant(this.bizRobotTag)) {
      this.logger.info(`skip network reconnect unread refresh, partnerAccount=${this.partnerAccount}`);
      return;
    }
    const partnerAccount = this.partnerAccount;
    const bizRobotTag = this.bizRobotTag;
    this.networkRefreshInFlight = true;
    this.logger.info(`start network reconnect unread refresh, partnerAccount=${partnerAccount}`);
    try {
      const refreshed = await this.refreshCurrentAssistantUnread(
        partnerAccount,
        bizRobotTag,
        false,
        'networkReconnect'
      );
      if (refreshed) {
        this.logger.info(`network reconnect unread refresh succeeded, partnerAccount=${partnerAccount}`);
      }
    } finally {
      this.networkRefreshInFlight = false;
    }
  }

  private onUnReadedChanged(source: WeAgentUnreadSource): void {
    if (this.partnerAccount.length === 0 || !this.agentTabNotifyEnabled) {
      return;
    }
    const result = this.snapshot(source);
    const showHostRedDot = this.shouldShowHostWeAgentTabRedDot();
    this.setHostWeAgentTabRedDot(showHostRedDot);
    this.broadcastUnreadChanged(result);
    this.logger.info(`unread state changed, source=${source}, partnerAccount=${this.partnerAccount}, `
      + `redDotVisible=${result.redDotVisible}, showHostRedDot=${showHostRedDot}`);
  }

  private shouldShowHostWeAgentTabRedDot(): boolean {
    // 结合权限、助理类型、未读状态和 Tab 聚焦状态计算是否显示小红点。
    if (!this.agentTabNotifyEnabled) {
      return false;
    }
    if (this.isUniAssistant(this.bizRobotTag)) {
      return false;
    }
    if (this.isMyAgent(this.bizRobotTag)) {
      return this.myAgentUnread && !this.isHostWeAgentTabFocused();
    }
    for (const state of this.sessions.values()) {
      if (state.hasUnRead && (!this.isHostWeAgentTabFocused() || state.welinkSessionId !== this.viewingSessionId)) {
        return true;
      }
    }
    return false;
  }

  private isHostWeAgentTabFocused(): boolean {
    // 待接入：从宿主读取助理 Tab 是否处于聚焦状态。
    return false;
  }

  private setHostWeAgentTabRedDot(_visible: boolean): void {
    // 待接入：调用宿主适配层显示或隐藏助理 Tab 小红点。
  }

  private broadcastUnreadChanged(_result: GetWeAgentUnreadMessageResult): void {
    // 待接入：调用 HWH5INNER.eventListener 广播助理未读状态。
  }

  private isMyAgent(bizRobotTag: string | undefined): boolean {
    return bizRobotTag === 'myAgent';
  }

  private isUniAssistant(bizRobotTag: string | undefined): boolean {
    return bizRobotTag === 'uniassistant';
  }

  private async requestWeAgentUnreadMessage(
    partnerAccount: string,
    sessionIds?: string[]
  ): Promise<ServerUnreadResult> {
    return this.httpClient.post<ServerUnreadResult>('/api/skill/sessions/unread', {
      assistantAcount: partnerAccount,
      sessionIds
    });
  }

  private async requestMyAgentUnreadMessage(): Promise<ServerMyAgentUnreadResult> {
    return this.httpClient.get<ServerMyAgentUnreadResult>(
      '/getMessageData',
      undefined,
      { skipBaseUrl: true }
    );
  }

  private toNonNegativeNumber(value: Object | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(value, 0);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(parsed, 0);
      }
    }
    return fallback;
  }

  private setRead(sessionId: string, readSeq: number): void {
    this.sessions.set(sessionId, {
      welinkSessionId: sessionId,
      hasUnRead: false,
      maxSeq: Math.max(readSeq, this.sessions.get(sessionId)?.maxSeq ?? 0)
    });
  }

  private snapshot(source: WeAgentUnreadSource): GetWeAgentUnreadMessageResult {
    const states = Array.from(this.sessions.values());
    const assistantUnread = this.myAgentUnread || states.some((item) => item.hasUnRead);
    return {
      partnerAccount: this.partnerAccount,
      assistantUnread,
      redDotVisible: this.agentTabNotifyEnabled,
      sessions: states,
      source
    };
  }
}
