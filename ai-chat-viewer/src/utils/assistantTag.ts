import type { WeAgentListItem, WeAgentDetails } from '../types/bridge';

export const CUSTOM_ASSISTANT_TAG = '自定义助手';
export const EXCLUSIVE_ASSISTANT_BIZ_TAG = 'myAgent';
export const EXCLUSIVE_ASSISTANT_TAG = '专属助手';
export const UNIVERSAL_ASSISTANT_BIZ_TAG = 'uniassistant';

export function resolveAssistantTag(
  assistant: WeAgentListItem | WeAgentDetails | null,
  language?: string,
): string {
  const tagName = assistant?.tagName?.trim() ?? '';
  const tagNameEn = assistant?.tagNameEn?.trim() ?? '';
  if (language === 'en' && tagNameEn) {
    return tagNameEn;
  }
  if (language !== 'en' && tagName) {
    return tagName;
  }

  const bizRobotTag = assistant?.bizRobotTag?.trim() ?? '';
  const bizRobotName = assistant?.bizRobotName?.trim() ?? '';
  const bizRobotNameEn = assistant?.bizRobotNameEn?.trim() ?? '';
  if (bizRobotTag === EXCLUSIVE_ASSISTANT_BIZ_TAG) {
    return EXCLUSIVE_ASSISTANT_TAG;
  }

  return bizRobotName || bizRobotNameEn || CUSTOM_ASSISTANT_TAG;
}
