import type { WeAgentListItem, WeAgentDetails } from '../types/bridge';

export const CUSTOM_ASSISTANT_TAG = '自定义助手';
export const EXCLUSIVE_ASSISTANT_BIZ_TAG = 'myAgent';
export const EXCLUSIVE_ASSISTANT_TAG = '专属助手';

export function resolveAssistantTag(assistant: WeAgentListItem | WeAgentDetails | null): string {
  const bizRobotTag = assistant?.bizRobotTag?.trim() ?? '';
  const bizRobotName = assistant?.bizRobotName?.trim() ?? '';
  const bizRobotNameEn = assistant?.bizRobotNameEn?.trim() ?? '';
  if (bizRobotTag === EXCLUSIVE_ASSISTANT_BIZ_TAG) {
    return EXCLUSIVE_ASSISTANT_TAG;
  }

  return bizRobotName || bizRobotNameEn || CUSTOM_ASSISTANT_TAG;
}
