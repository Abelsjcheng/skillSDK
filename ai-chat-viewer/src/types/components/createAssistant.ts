import type { DefaultAvatarOption, DigitalTwinBasicInfoPayload, DigitalTwinBrainPayload, InternalAssistantOption } from '../digitalTwin';

export type FooterButtonVariant = 'cancel' | 'next' | 'confirm';

export interface CreatorStepFooterButton {
  label: string;
  onClick: () => void;
  variant: FooterButtonVariant;
  enabled?: boolean;
  withStateClass?: boolean;
}

export interface CreatorStepFooterProps {
  isPcMiniApp: boolean;
  pcButtons: CreatorStepFooterButton[];
  mobileButton: CreatorStepFooterButton;
}

export interface CreatorStepHeaderProps {
  isPcMiniApp: boolean;
  onClose: () => void;
  onMobileBack?: () => void;
}

export interface StepBasicInfoProps {
  isPcMiniApp?: boolean;
  defaultAvatars: DefaultAvatarOption[];
  initialValue?: DigitalTwinBasicInfoPayload | null;
  className?: string;
  showHeader?: boolean;
  onClose: () => void;
  onCancel: () => void;
  onNext: (payload: DigitalTwinBasicInfoPayload) => void;
  submitLabel?: string;
}

export interface StepBrainSelectProps {
  isPcMiniApp?: boolean;
  onClose: () => void;
  onCancel: () => void;
  onPrev: () => void;
  onConfirm: (payload: DigitalTwinBrainPayload) => void;
  loadAgentTypes?: () => Promise<InternalAssistantOption[]>;
}
