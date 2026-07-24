import type {
  CreateDigitalTwinParams,
  CreateDigitalTwinResult,
  CreateNewSessionParams,
  DeleteWeAgentParams,
  DeleteWeAgentResult,
  GetHistorySessionsListParams,
  GetOnlineStatusResult,
  GetSessionMessageHistoryParams,
  GetWeAgentDetailsParams,
  GetWeAgentListParams,
  HistorySessionsListResult,
  QueryQrcodeInfoParams,
  QueryQrcodeInfoResult,
  ReplyPermissionParams,
  SendMessageParams,
  SendMessageToIMParams,
  SkillSession,
  StopSkillParams,
  UpdateWeAgentParams,
  UpdateWeAgentResult,
  UpdateQrcodeInfoParams,
  UpdateQrcodeInfoResult,
  WeAgentDetails,
  WeAgentDetailsArrayResult,
  WeAgentListResult,
} from '../types/bridge';
import type {
  GetSessionMessageHistoryResponse,
  ReplyPermissionResponse,
  SendMessageResponse,
  SendMessageToIMResponse,
  StopSkillResponse,
} from '../types';
import { EXCLUSIVE_ASSISTANT_BIZ_TAG } from './assistantTag';
import { reportApiError, reportApiSuccess } from './telemetry';
import { reportUemEvent } from './hwext';
import { WeLog } from './logger';

function reportClickEvent(
  eventId: string,
  eventTitle: string,
  data: Record<string, unknown> = {},
): void {
  void reportUemEvent(eventId, eventTitle, {
    entry: 'WeAgent',
    operationTime: Date.now(),
    ...data,
  }).catch((error) => {
    WeLog(`uemUtil reportUemEvent failed | extra=${JSON.stringify({ eventId })} | error=${JSON.stringify(error)}`);
  });
}

function hashTelemetryValue(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function reportSelectAssistantClick(): void {
  reportClickEvent('activate_select_assistant_click', '选择助理');
}

export function reportCreateAssistantClick(): void {
  reportClickEvent('select_assistant_create_click', '创建助理');
}

export function reportEnableNowClick(): void {
  reportClickEvent('select_assistant_start_click', '开始使用');
}

export function reportSwitchAssistantClick(): void {
  reportClickEvent('switch_assistant_confirm_click', '确认切换');
}

export function reportViewHistoryClick(assistantAccount: string): void {
  reportClickEvent('weagent_history_click', '历史会话', {
    page: 'weAgentCUI',
    assistantAccount,
  });
}

export function reportCreateSessionClick(detail: WeAgentDetails | null, error?: unknown): void {
  reportClickEvent('weagent_create_session_click', '创建会话', {
    page: 'weAgentCUI',
    assistantAccount: detail?.partnerAccount ?? '',
    bizRobotTag: detail?.bizRobotTag ?? '',
    type: error ? 'error' : 'ok',
  });
}

export function reportSlashCommandPanelTrigger(params: {
  partnerAccount: string;
  commandCount: number;
  source: 'storage' | 'db' | 'memory' | 'network';
  isPcMiniApp: boolean;
}): void {
  reportClickEvent('slash_command_panel_trigger', 'Slash命令面板展示', {
    page: 'weAgentCUI',
    partnerAccount: params.partnerAccount,
    commandCount: params.commandCount,
    source: params.source,
    deviceType: params.isPcMiniApp ? 'pc' : 'mobile',
  });
}

export function reportSlashCommandSelect(params: {
  partnerAccount: string;
  command: string;
  queryLength: number;
  selectMethod: 'enter' | 'click';
  isPcMiniApp: boolean;
}): void {
  reportClickEvent('slash_command_select', 'Slash命令选择', {
    page: 'weAgentCUI',
    partnerAccount: params.partnerAccount,
    commandNameHash: hashTelemetryValue(params.command),
    queryLength: params.queryLength,
    selectMethod: params.selectMethod,
    deviceType: params.isPcMiniApp ? 'pc' : 'mobile',
  });
}

export function reportSendMessageClick(
  page: 'weAgentCUI' | 'skillCUI',
  welinkSessionId: string,
  content: string,
  assistantDetail?: WeAgentDetails | null,
): void {
  reportClickEvent('weagent_send_message_click', '发送消息', {
    page,
    welinkSessionId,
    contentLength: content.length,
    robot_Id: assistantDetail?.id,
    bizRobotId: assistantDetail?.bizRobotId,
  });
}

export async function trackApiCreateNewSession(
  params: CreateNewSessionParams,
  request: Promise<SkillSession>,
): Promise<SkillSession> {
  try {
    const result = await request;
    void reportApiSuccess('api_create_new_session', '创建会话接口', {
      request: {
        assistantAccount: params.assistantAccount,
        businessSessionDomain: params.businessSessionDomain,
        businessSessionType: params.businessSessionType,
        businessSessionId: params.businessSessionId,
        ak: params.ak,
        businessExtParam: params.businessExtParam,
      },
      response: {
        welinkSessionId: result.welinkSessionId,
        status: result.status,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_create_new_session', '创建会话接口', error, {
      request: {
        assistantAccount: params.assistantAccount,
        businessSessionDomain: params.businessSessionDomain,
        businessSessionType: params.businessSessionType,
        businessSessionId: params.businessSessionId,
        ak: params.ak,
        businessExtParam: params.businessExtParam,
      },
    });
    throw error;
  }
}

export async function trackApiGetHistorySessions(
  params: GetHistorySessionsListParams,
  request: Promise<HistorySessionsListResult>,
): Promise<HistorySessionsListResult> {
  try {
    const result = await request;
    const latestSession = result.content?.[0];
    void reportApiSuccess('api_get_history_sessions', '获取历史会话接口', {
      request: {
        assistantAccount: params.assistantAccount,
        businessSessionDomain: params.businessSessionDomain,
        page: params.page,
        size: params.size,
      },
      response: {
        sessionCount: result.content?.length ?? 0,
        latestWelinkSessionId: latestSession?.welinkSessionId,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_get_history_sessions', '获取历史会话接口', error, {
      request: {
        assistantAccount: params.assistantAccount,
        businessSessionDomain: params.businessSessionDomain,
        page: params.page,
        size: params.size,
      },
    });
    throw error;
  }
}

export async function trackApiGetSessionMessageHistory(
  params: GetSessionMessageHistoryParams,
  request: Promise<GetSessionMessageHistoryResponse>,
): Promise<GetSessionMessageHistoryResponse> {
  try {
    const result = await request;
    void reportApiSuccess('api_get_session_message_history', '获取会话历史消息接口', {
      request: {
        welinkSessionId: params.welinkSessionId,
        beforeSeq: params.beforeSeq,
        size: params.size,
      },
      response: {
        messageCount: result.content?.length ?? 0,
        nextBeforeSeq: result.nextBeforeSeq,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_get_session_message_history', '获取会话历史消息接口', error, {
      request: {
        welinkSessionId: params.welinkSessionId,
        beforeSeq: params.beforeSeq,
        size: params.size,
      },
    });
    throw error;
  }
}

export async function trackApiSendMessage(
  params: SendMessageParams,
  request: Promise<SendMessageResponse>,
): Promise<SendMessageResponse> {
  try {
    const result = await request;
    void reportApiSuccess('api_send_message', '发送消息接口', {
      request: {
        welinkSessionId: params.welinkSessionId,
        contentLength: params.content.length,
        toolCallId: params.toolCallId,
        questionId: params.questionId,
        subagentSessionId: params.subagentSessionId,
      },
      response: {
        messageId: result.id,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_send_message', '发送消息接口', error, {
      request: {
        welinkSessionId: params.welinkSessionId,
        contentLength: params.content.length,
        toolCallId: params.toolCallId,
        questionId: params.questionId,
        subagentSessionId: params.subagentSessionId,
      },
    });
    throw error;
  }
}

export async function trackApiReplyPermission(
  params: ReplyPermissionParams,
  request: Promise<ReplyPermissionResponse>,
): Promise<ReplyPermissionResponse> {
  try {
    const result = await request;
    void reportApiSuccess('api_reply_permission', '权限回复接口', {
      request: {
        welinkSessionId: params.welinkSessionId,
        permId: params.permId,
        response: params.response,
        subagentSessionId: params.subagentSessionId,
      },
      response: {
        permissionId: result.permissionId,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_reply_permission', '权限回复接口', error, {
      request: {
        welinkSessionId: params.welinkSessionId,
        permId: params.permId,
        response: params.response,
        subagentSessionId: params.subagentSessionId,
      },
    });
    throw error;
  }
}

export async function trackApiCreateDigitalTwin(
  params: CreateDigitalTwinParams,
  request: Promise<CreateDigitalTwinResult>,
): Promise<CreateDigitalTwinResult> {
  try {
    const result = await request;
    void reportApiSuccess('api_create_digital_twin', '创建助手接口', {
      request: {
        name: params.name,
        descriptionLength: params.description?.length ?? 0,
        bizRobotId: params.bizRobotId,
        qrcode: params.qrcode,
        weCrewType: params.weCrewType,
      },
      response: {
        partnerAccount: result.partnerAccount,
        robotId: result.robotId,
        isInternalAssistant: params.weCrewType === 1,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_create_digital_twin', '创建助手接口', error, {
      request: {
        name: params.name,
        descriptionLength: params.description?.length ?? 0,
        bizRobotId: params.bizRobotId,
        qrcode: params.qrcode,
        weCrewType: params.weCrewType,
      },
    });
    throw error;
  }
}

export async function trackApiQueryQrcodeInfo(
  params: QueryQrcodeInfoParams,
  request: Promise<QueryQrcodeInfoResult>,
): Promise<QueryQrcodeInfoResult> {
  try {
    const result = await request;
    void reportApiSuccess('api_query_qrcode_info', '查询二维码信息接口', {
      request: {
        qrcode: params.qrcode,
      },
      response: {
        status: result.status,
        expired: result.expired,
        expireTime: result.expireTime,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_query_qrcode_info', '查询二维码信息接口', error, {
      request: {
        qrcode: params.qrcode,
      },
    });
    throw error;
  }
}

export async function trackApiUpdateQrcodeInfo(
  params: UpdateQrcodeInfoParams,
  request: Promise<UpdateQrcodeInfoResult>,
): Promise<UpdateQrcodeInfoResult> {
  try {
    const result = await request;
    void reportApiSuccess('api_update_qrcode_info', '更新二维码信息接口', {
      request: {
        qrcode: params.qrcode,
        robotId: params.robotId,
        status: params.status,
      },
      response: {
        status: result.status,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_update_qrcode_info', '更新二维码信息接口', error, {
      request: {
        qrcode: params.qrcode,
        robotId: params.robotId,
        status: params.status,
      },
    });
    throw error;
  }
}

export async function trackApiGetWeAgentDetails(
  params: GetWeAgentDetailsParams,
  request: Promise<WeAgentDetailsArrayResult>,
): Promise<WeAgentDetailsArrayResult> {
  try {
    const result = await request;
    const firstDetail = result.weAgentDetailsArray?.[0];
    void reportApiSuccess('api_get_weagent_details', '获取助手详情接口', {
      request: {
        partnerAccount: 'partnerAccount' in params ? params.partnerAccount : undefined,
        partnerAccounts: 'partnerAccounts' in params ? params.partnerAccounts : undefined,
      },
      response: {
        detailCount: result.weAgentDetailsArray?.length ?? 0,
        bizRobotId: firstDetail?.bizRobotId,
        bizRobotTag: firstDetail?.bizRobotTag,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_get_weagent_details', '获取助手详情接口', error, {
      request: {
        partnerAccount: 'partnerAccount' in params ? params.partnerAccount : undefined,
        partnerAccounts: 'partnerAccounts' in params ? params.partnerAccounts : undefined,
      },
    });
    throw error;
  }
}

export async function trackApiGetWeAgentList(
  params: GetWeAgentListParams,
  request: Promise<WeAgentListResult>,
): Promise<WeAgentListResult> {
  try {
    const result = await request;
    void reportApiSuccess('api_get_weagent_list', '获取助手列表接口', {
      request: {
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
      },
      response: {
        listCount: result.content?.length ?? 0,
        hasMyAgent: Boolean(result.content?.some((item) => item.bizRobotTag === EXCLUSIVE_ASSISTANT_BIZ_TAG)),
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_get_weagent_list', '获取助手列表接口', error, {
      request: {
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
      },
    });
    throw error;
  }
}

export async function trackApiGetOnlineStatus(
  request: Promise<GetOnlineStatusResult[]>,
): Promise<GetOnlineStatusResult[]> {
  try {
    const result = await request;
    const onlineCount = result.filter((v) => v.status === 'ONLINE').length;
    const offlineCount = result.filter((v) => v.status === 'OFFLINE').length;
    void reportApiSuccess('api_get_online_status', '获取助手在线状态接口', {
      response: {
        onlineCount,
        offlineCount,
        totalCount: onlineCount + offlineCount,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_get_online_status', '获取助手在线状态接口', error, {});
    throw error;
  }
}

export async function trackApiStopSkill(
  params: StopSkillParams,
  request: Promise<StopSkillResponse>,
): Promise<StopSkillResponse> {
  try {
    const result = await request;
    void reportApiSuccess('api_stop_skill', '停止生成接口', {
      request: {
        welinkSessionId: params.welinkSessionId,
        subagentSessionId: params.subagentSessionId,
      },
      response: {
        status: result.status,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_stop_skill', '停止生成接口', error, {
      request: {
        welinkSessionId: params.welinkSessionId,
        subagentSessionId: params.subagentSessionId,
      },
    });
    throw error;
  }
}

export async function trackApiSendMessageToIM(
  params: SendMessageToIMParams,
  request: Promise<SendMessageToIMResponse>,
): Promise<SendMessageToIMResponse> {
  try {
    const result = await request;
    void reportApiSuccess('api_send_message_to_im', '发送到IM接口', {
      request: {
        welinkSessionId: params.welinkSessionId,
        chatId: params.chatId,
        contentLength: params.content?.length ?? 0,
      },
      response: {
        success: result.success,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_send_message_to_im', '发送到IM接口', error, {
      request: {
        welinkSessionId: params.welinkSessionId,
        chatId: params.chatId,
        contentLength: params.content?.length ?? 0,
      },
    });
    throw error;
  }
}

export async function trackApiUpdateWeAgent(
  params: UpdateWeAgentParams,
  request: Promise<UpdateWeAgentResult>,
): Promise<UpdateWeAgentResult> {
  try {
    const result = await request;
    void reportApiSuccess('api_update_weagent', '更新助理接口', {
      request: {
        partnerAccount: params.partnerAccount,
        name: params.name,
        descriptionLength: params.description.length,
      },
      response: {
        updateResult: result.updateResult,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_update_weagent', '更新助理接口', error, {
      request: {
        partnerAccount: params.partnerAccount,
        name: params.name,
        descriptionLength: params.description.length,
      },
    });
    throw error;
  }
}

export async function trackApiDeleteWeAgent(
  params: DeleteWeAgentParams,
  request: Promise<DeleteWeAgentResult>,
): Promise<DeleteWeAgentResult> {
  try {
    const result = await request;
    void reportApiSuccess('api_delete_weagent', '删除助理接口', {
      request: {
        partnerAccount: params.partnerAccount,
      },
      response: {
        deleteResult: result.deleteResult,
      },
    });
    return result;
  } catch (error) {
    void reportApiError('api_delete_weagent', '删除助理接口', error, {
      request: {
        partnerAccount: params.partnerAccount,
      },
    });
    throw error;
  }
}
