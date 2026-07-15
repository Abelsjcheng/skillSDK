import React from 'react';
import closeIcon from '../../imgs/close_icon.png';
import customerIcon from '../../imgs/customer_icon.svg';
import type { AssistantPageHeaderAction } from '../../types/components';
import { dispatchAssistantCloseEvent } from '../../utils/assistantHostBridge';

export const createDefaultPcServiceAction = (onService: () => void, label: string): AssistantPageHeaderAction => ({
  label,
  icon: customerIcon,
  onClick: onService,
});

export const createDefaultPcCloseAction = (onClose: () => void, label: string): AssistantPageHeaderAction => ({
  label,
  icon: closeIcon,
  onClick: () => {
    dispatchAssistantCloseEvent();
    onClose();
  },
});

export const renderAssistantHeaderActionIcon = (action: AssistantPageHeaderAction): React.ReactNode => {
  if (action.iconNode) {
    return <span className="assistant-page-header__pc-icon assistant-page-header__pc-icon--svg">{action.iconNode}</span>;
  }

  if (action.icon) {
    return <img src={action.icon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />;
  }

  return null;
};
