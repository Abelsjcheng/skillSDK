import type { WeAgentListItem } from './hwext';

export const CUSTOM_ASSISTANT_TAG = '自定义助理';

export function resolveAssistantTag(assistant: WeAgentListItem): string {
  const bizRobotName = assistant.bizRobotName?.trim() ?? '';
  const bizRobotNameEn = assistant.bizRobotNameEn?.trim() ?? '';
  return bizRobotName || bizRobotNameEn || CUSTOM_ASSISTANT_TAG;
}
