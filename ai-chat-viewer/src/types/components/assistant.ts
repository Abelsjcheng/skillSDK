import type { KeyboardEvent, ReactNode, Ref } from 'react';
import type { SkillSession, WeAgentDetails } from '../bridge/hwext';
import type { AssistantItem } from '../assistant';
import type { DigitalTwinBasicInfoPayload } from '../digitalTwin';
import type { SlashCommandItem, SlashCommandToken } from '../slashCommand';

export interface AssistantDetailDeleteModalProps {
  open: boolean;
  assistantName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  cancelText: string;
  confirmText: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmTextColor?: string;
}

export interface AssistantDetailActionSheetProps {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export interface AssistantDetailPcMenuProps {
  open: boolean;
  top: number;
  left: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}

export interface AssistantCardListProps {
  assistants: AssistantItem[];
  selectedAssistantId: string;
  onSelectAssistant: (assistantId: string) => void;
}

export interface AssistantPageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: string;
  iconNode?: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
}

export interface AssistantPageHeaderProps {
  title: string;
  isPcMiniApp?: boolean;
  onClose?: () => void;
  onService?: () => void;
  mobileRightActionIcon?: string;
  mobileRightActionLabel?: string;
  onMobileRightAction?: () => void;
  pcLeftActions?: AssistantPageHeaderAction[];
  pcRightActions?: AssistantPageHeaderAction[];
}

export interface AssistantSelectionPageProps {
  title: string;
  isPcMiniApp?: boolean;
  leftButtonText?: string;
  rightButtonText: string;
  defaultSelectedAssistantId?: string;
  onLeftButtonClick?: () => void;
  onRightButtonClick?: () => void;
  onService?: () => void;
  assistants?: AssistantItem[];
  selectedAssistantId?: string;
  onSelectAssistant?: (assistantId: string) => void;
  rightButtonDisabled?: boolean;
}

export interface EditAssistantContentProps {
  isPcMiniApp?: boolean;
  source?: 'assistantDetail' | 'external';
  initialDetail?: WeAgentDetails | null;
  partnerAccount?: string;
  robotId?: string;
  onClose: () => void;
  onSuccess?: (payload: DigitalTwinBasicInfoPayload) => void;
}

export type SendShortcutMode = 'enter' | 'ctrlEnter';

export interface ShortcutOption {
  mode: SendShortcutMode;
  label: string;
}

export interface WeAgentCUIFooterProps {
  isPcMiniApp?: boolean;
  mode: 'generate' | 'generating' | 'regenerate';
  partnerAccount?: string;
  slashCommands?: SlashCommandItem[];
  onRequestSlashCommands?: () => Promise<void> | void;
  onSend: (message: string) => void;
  onStop: () => void;
  onInputFocus?: () => void;
  leftActions?: ReactNode;
}

export interface SlashCommandComposerHandle {
  focus: () => void;
  getSelectionRange: () => { start: number; end: number };
  setCursor: (cursor: number) => void;
}

export interface SlashCommandComposerProps {
  className: string;
  isPcMiniApp?: boolean;
  placeholder: string;
  slashToken: SlashCommandToken | null;
  value: string;
  onChange: (value: string, cursor: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export type HistorySessionGroupKey = 'today' | 'yesterday' | 'threeDaysAgo';

export interface HistorySessionGroup {
  key: HistorySessionGroupKey;
  sessions: SkillSession[];
}

export interface HistorySessionsCache {
  content: SkillSession[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface WeAgentHistorySidebarProps {
  assistantAccount?: string;
  currentWelinkSessionId?: string;
  cachedCache?: HistorySessionsCache | null;
  defaultOpen?: boolean;
  historyLoaded?: boolean;
  onHistoryLoaded?: (cache: HistorySessionsCache) => void;
  onSessionSelect?: (welinkSessionId: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
}
