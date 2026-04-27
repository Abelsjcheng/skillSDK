import type { ReactNode } from 'react';

import type { DefaultAvatarOption, DigitalTwinBasicInfoPayload, DigitalTwinBrainPayload } from '../digitalTwin';

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
  leftContent?: ReactNode;
}

export interface CreatorStepHeaderProps {
  isPcMiniApp: boolean;
  onClose: () => void;
  onMobileBack?: () => void;
  pcTitle?: string;
}

export interface StepBasicInfoProps {
  isPcMiniApp?: boolean;
  defaultAvatars: DefaultAvatarOption[];
  initialValue?: DigitalTwinBasicInfoPayload | null;
  className?: string;
  showHeader?: boolean;
  expired?: boolean;
  expiredImageSrc?: string;
  expiredMessage?: string;
  providerChannel?: string;
  onClose: () => void;
  onMobileBack?: () => void;
  onNext: (payload: DigitalTwinBasicInfoPayload) => void;
  submitLabel?: string;
}

export interface StepBrainSelectProps {
  isPcMiniApp?: boolean;
  onClose: () => void;
  onPrev: () => void;
  onConfirm: (payload: DigitalTwinBrainPayload) => void;
}
