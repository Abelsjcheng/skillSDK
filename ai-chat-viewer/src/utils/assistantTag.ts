import type { WeAgentListItem, WeAgentDetails } from '../types/bridge';

export const CUSTOM_ASSISTANT_TAG = '自定义助手';
export const EXCLUSIVE_ASSISTANT_BIZ_TAG = 'myAgent';
export const EXCLUSIVE_ASSISTANT_TAG = '专属助手';

function normalizeAssistantTagLanguage(language?: string | null): 'zh' | 'en' {
  return String(language ?? '')
    .trim()
    .replace(/_/g, '-')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'zh';
}

export function resolveAssistantTag(
  assistant: WeAgentListItem | WeAgentDetails | null,
  language?: string,
): string {
  const appLanguage = normalizeAssistantTagLanguage(language);
  const tagName = assistant?.tagName?.trim() ?? '';
  const tagNameEn = assistant?.tagNameEn?.trim() ?? '';
  if (appLanguage === 'en' && tagNameEn) {
    return tagNameEn;
  }
  if (appLanguage === 'zh' && tagName) {
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
