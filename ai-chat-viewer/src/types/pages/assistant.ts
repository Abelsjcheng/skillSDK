import type { ReactNode } from 'react';
import { WeAgentDetails } from '../bridge';

export interface DetailInfoRowProps {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}

export interface AssistantDetailProps {
  partnerAccount?: string;
  handlePcDelete?: (detail: WeAgentDetails | null, cb: () => void) => void;
  onEditAssistant?: (detail: WeAgentDetails | null) => void;
}

export interface SkillCUIProps {
  welinkSessionId?: string;
}

export type AssistantDetailOverlay = 'none' | 'action-sheet' | 'delete-modal';

export type AssistantDetailPcView = 'detail' | 'edit';

export interface SwitchAssistantProps {
  defaultSelectedAssistantId?: string;
}
