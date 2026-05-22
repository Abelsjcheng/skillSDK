import React from 'react';
import { useTranslation } from 'react-i18next';
import backIcon from '../../imgs/back_icon.svg';
import '../../styles/AssistantPageHeader.less';
import type { AssistantPageHeaderAction, AssistantPageHeaderProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { useMobileStatusBarHeight } from '../../utils/useMobileStatusBarHeight';
import {
  createDefaultPcCloseAction,
  createDefaultPcServiceAction,
  renderAssistantHeaderActionIcon,
} from './assistantHeaderActions';

const noop = () => {};

const AssistantPageHeader: React.FC<AssistantPageHeaderProps> = ({
  title,
  isPcMiniApp = false,
  onClose = noop,
  onService = noop,
  mobileRightActionIcon,
  mobileRightActionLabel = '',
  onMobileRightAction = noop,
  pcLeftActions,
  pcRightActions,
}) => {
  const { t } = useTranslation();
  useMobileStatusBarHeight(isPcMiniApp);

  const resolvedPcLeftActions = pcLeftActions ?? [createDefaultPcServiceAction(onService, t('common.service'))];
  const resolvedPcRightActions = pcRightActions ?? [createDefaultPcCloseAction(onClose, t('common.close'))];

  const renderPcActionButton = (action: AssistantPageHeaderAction, side: 'left' | 'right') => (
    <button
      key={`${action.label}-${side}`}
      ref={action.buttonRef}
      type="button"
      className="assistant-page-header__pc-btn"
      aria-label={action.label}
      onClick={(event) => {
        runButtonClickWithDebounce(event, () => {
          action.onClick();
        });
      }}
    >
      {renderAssistantHeaderActionIcon(action)}
    </button>
  );

  if (isPcMiniApp) {
    return (
      <header className="assistant-page-header assistant-page-header--pc">
        <div className="assistant-page-header__pc-side assistant-page-header__pc-side--left">
          {resolvedPcLeftActions.map((action) => renderPcActionButton(action, 'left'))}
        </div>
        <span className="assistant-page-header__title">{title}</span>
        <div className="assistant-page-header__pc-side assistant-page-header__pc-side--right">
          {resolvedPcRightActions.map((action) => renderPcActionButton(action, 'right'))}
        </div>
      </header>
    );
  }

  return (
    <header className="assistant-page-header assistant-page-header--mobile">
      <div className="assistant-page-header__side assistant-page-header__side--left">
        <button
          type="button"
          className="assistant-page-header__icon-btn"
          aria-label={t('common.back')}
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              window.HWH5.navigateBack();
            });
          }}
        >
          <img src={backIcon} alt="" className="assistant-page-header__icon-img" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="assistant-page-header__icon-btn"
          aria-label={t('common.service')}
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              onService();
            });
          }}
        >
          <img src={serviceIcon} alt="" className="assistant-page-header__icon-img" aria-hidden="true" />
        </button>
      </div>
      <span className="assistant-page-header__title">{title}</span>
      <div className="assistant-page-header__side assistant-page-header__side--right">
        {mobileRightActionIcon ? (
          <button
            type="button"
            className="assistant-page-header__icon-btn assistant-page-header__icon-btn--right"
            aria-label={mobileRightActionLabel}
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                onMobileRightAction();
              });
            }}
          >
            <img src={mobileRightActionIcon} alt="" className="assistant-page-header__icon-img" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
};

export default AssistantPageHeader;
