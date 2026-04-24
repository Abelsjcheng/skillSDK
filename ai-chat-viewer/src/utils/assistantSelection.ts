import { resolveAssistantIconUrl } from '../components/createAssistant/constants';
import type { WeAgentListItem } from '../types/bridge';
import { isPcMiniApp } from '../constants';
import type { AssistantItem } from '../types/assistant';
import { handleWeAgentOpenInitPc } from './assistantPcHandle';
import { resolveAssistantTag } from './assistantTag';
import {
  buildOpenWeAgentCUIParams,
  getWeAgentDetails,
  openWeAgentCUI,
  resolveRobotIdForOpenWeAgentCUI,
  resolveWeCodeUrlForOpenWeAgentCUI,
} from './hwext';

export const DEFAULT_ASSISTANT_LIST_QUERY = {
  pageSize: 20,
  pageNumber: 1,
};

export function mapWeAgentListToAssistantItems(list: WeAgentListItem[]): AssistantItem[] {
  return list.map((assistant) => ({
    id: assistant.partnerAccount,
    name: assistant.name ?? '',
    tag: resolveAssistantTag(assistant),
    description: assistant.description ?? '',
    icon: resolveAssistantIconUrl(assistant.icon),
  }));
}

export function resolveSelectableAssistantId(
  list: WeAgentListItem[],
  currentAssistantId: string,
  ...fallbackAssistantIds: Array<string | undefined>
): string {
  const availableAssistantIds = new Set(list.map((assistant) => assistant.partnerAccount));

  if (availableAssistantIds.has(currentAssistantId)) {
    return currentAssistantId;
  }

  for (const fallbackAssistantId of fallbackAssistantIds) {
    if (fallbackAssistantId && availableAssistantIds.has(fallbackAssistantId)) {
      return fallbackAssistantId;
    }
  }

  return '';
}

export async function openAssistantByPartnerAccount(
  assistantList: WeAgentListItem[],
  partnerAccount: string,
): Promise<boolean> {
  if (!partnerAccount) {
    return false;
  }

  const selectedAssistant = assistantList.find(
    (assistant) => assistant.partnerAccount === partnerAccount,
  );
  const detailResult = await getWeAgentDetails({ partnerAccount });
  const detail = detailResult?.weAgentDetailsArray?.[0];
  if (!detail) {
    console.warn('No we-agent detail found for partnerAccount:', partnerAccount);
    return false;
  }
  if (isPcMiniApp()) {
    handleWeAgentOpenInitPc(detail);
  } else {
    const weCodeUrl = resolveWeCodeUrlForOpenWeAgentCUI(detail, partnerAccount);
    const robotId = resolveRobotIdForOpenWeAgentCUI({
      detailId: detail.id,
      listRobotId: selectedAssistant?.robotId,
    });
    const params = buildOpenWeAgentCUIParams(weCodeUrl, partnerAccount, {
      bizRobotId: detail.bizRobotId,
      robotId,
    });
    await openWeAgentCUI(params);
    return true;
  }
  return false;
}
