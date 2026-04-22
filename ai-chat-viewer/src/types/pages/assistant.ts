import type { ReactNode } from 'react';

export interface DetailInfoRowProps {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}

export type AssistantDetailOverlay = 'none' | 'action-sheet' | 'delete-modal';

export type AssistantDetailPcView = 'detail' | 'edit';

export interface SwitchAssistantProps {
  defaultSelectedAssistantId?: string;
}
