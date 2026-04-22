import React from 'react';
import { useTranslation } from 'react-i18next';
import backIcon from '../../imgs/back_icon.svg';
import closeIcon from '../../imgs/close_icon.svg';
import serviceIcon from '../../imgs/icon-service.svg';
import '../../styles/AssistantPageHeader.less';
import type { AssistantPageHeaderAction, AssistantPageHeaderProps } from '../../types/components';
import { dispatchAssistantCloseEvent } from '../../utils/assistantHostBridge';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { useMobileStatusBarHeight } from '../../utils/useMobileStatusBarHeight';

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
  const statusBarHeight = useMobileStatusBarHeight(isPcMiniApp);

  const resolvedDefaultPcCloseAction: AssistantPageHeaderAction = {
    label: t('common.close'),
    icon: closeIcon,
    onClick: () => {
      dispatchAssistantCloseEvent();
      onClose();
    },
  };

  const resolvedDefaultPcServiceAction: AssistantPageHeaderAction = {
    label: t('common.service'),
    icon: serviceIcon,
    onClick: () => {
      onService();
    },
  };

  const resolvedPcLeftActions = pcLeftActions ?? [resolvedDefaultPcServiceAction];
  const resolvedPcRightActions = pcRightActions ?? [resolvedDefaultPcCloseAction];

  if (isPcMiniApp) {
    return (
      <header className="assistant-page-header assistant-page-header--pc">
        <div className="assistant-page-header__pc-side assistant-page-header__pc-side--left">
          {resolvedPcLeftActions.map((action) => (
            <button
              key={`${action.label}-left`}
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
              {action.iconNode ? (
                <span className="assistant-page-header__pc-icon assistant-page-header__pc-icon--svg">
                  {action.iconNode}
                </span>
              ) : action.icon ? (
                <img src={action.icon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
        <span className="assistant-page-header__title">{title}</span>
        <div className="assistant-page-header__pc-side assistant-page-header__pc-side--right">
          {resolvedPcRightActions.map((action) => (
            <button
              key={`${action.label}-right`}
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
              {action.iconNode ? (
                <span className="assistant-page-header__pc-icon assistant-page-header__pc-icon--svg">
                  {action.iconNode}
                </span>
              ) : action.icon ? (
                <img src={action.icon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      </header>
    );
  }

  const mobileHeaderStyle = statusBarHeight > 0
    ? {
      paddingTop: `${statusBarHeight}px`,
      height: `${44 + statusBarHeight}px`,
      minHeight: `${44 + statusBarHeight}px`,
    }
    : undefined;

  return (
    <header className="assistant-page-header assistant-page-header--mobile" style={mobileHeaderStyle}>
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
