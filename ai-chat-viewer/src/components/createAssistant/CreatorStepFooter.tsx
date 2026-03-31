import React from 'react';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';

type FooterButtonVariant = 'cancel' | 'next' | 'confirm';

interface CreatorStepFooterButton {
  label: string;
  onClick: () => void;
  variant: FooterButtonVariant;
  enabled?: boolean;
  withStateClass?: boolean;
}

interface CreatorStepFooterProps {
  isPcMiniApp: boolean;
  pcButtons: CreatorStepFooterButton[];
  mobileButton: CreatorStepFooterButton;
}

function getStateActionButtonClassName(
  baseClassName: string,
  isEnabled: boolean,
  includeMobilePrimary = false,
): string {
  return `${baseClassName} ${includeMobilePrimary ? 'digital-twin__action-btn--mobile-primary' : ''} ${
    isEnabled ? 'is-active' : 'is-disabled'
  }`.trim();
}

function getButtonBaseClassName(variant: FooterButtonVariant): string {
  return `digital-twin__action-btn digital-twin__action-btn--${variant}`;
}

function resolveButtonClassName(button: CreatorStepFooterButton, includeMobilePrimary = false): string {
  const baseClassName = getButtonBaseClassName(button.variant);
  const isEnabled = button.enabled ?? true;

  if (button.withStateClass) {
    return getStateActionButtonClassName(baseClassName, isEnabled, includeMobilePrimary);
  }

  return `${baseClassName} ${includeMobilePrimary ? 'digital-twin__action-btn--mobile-primary' : ''}`.trim();
}

function renderButton(button: CreatorStepFooterButton, includeMobilePrimary = false): React.ReactElement {
  const isEnabled = button.enabled ?? true;

  return (
    <button
      key={`${button.variant}-${button.label}`}
      type="button"
      className={resolveButtonClassName(button, includeMobilePrimary)}
      disabled={!isEnabled}
      onClick={(event) => {
        runButtonClickWithDebounce(event, () => {
          button.onClick();
        });
      }}
    >
      {button.label}
    </button>
  );
}

export const CreatorStepFooter: React.FC<CreatorStepFooterProps> = ({ isPcMiniApp, pcButtons, mobileButton }) => {
  return (
    <footer className="digital-twin__actions">
      {isPcMiniApp ? pcButtons.map((button) => renderButton(button)) : renderButton(mobileButton, true)}
    </footer>
  );
};
