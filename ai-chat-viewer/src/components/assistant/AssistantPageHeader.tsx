import React from 'react';
import backIcon from '../../imgs/back_icon.svg';
import closeIcon from '../../imgs/close_icon.svg';
import serviceIcon from '../../imgs/icon-service.svg';
import '../../styles/AssistantPageHeader.less';
import { dispatchAssistantCloseEvent } from '../../utils/assistantHostBridge';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { useMobileStatusBarHeight } from '../../utils/useMobileStatusBarHeight';

interface AssistantPageHeaderProps {
  title: string;
  isPcMiniApp?: boolean;
  onClose?: () => void;
  onService?: () => void;
}

const noop = () => {};

const AssistantPageHeader: React.FC<AssistantPageHeaderProps> = ({
  title,
  isPcMiniApp = false,
  onClose = noop,
  onService = noop,
}) => {
  const statusBarHeight = useMobileStatusBarHeight(isPcMiniApp);

  if (isPcMiniApp) {
    return (
      <header className="assistant-page-header assistant-page-header--pc">
        <button
          type="button"
          className="assistant-page-header__pc-btn"
          aria-label="关闭"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              dispatchAssistantCloseEvent();
              onClose();
            });
          }}
        >
          <img src={closeIcon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />
        </button>
        <span className="assistant-page-header__title">{title}</span>
        <button
          type="button"
          className="assistant-page-header__pc-btn"
          aria-label="客服"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              onService();
            });
          }}
        >
          <img src={serviceIcon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />
        </button>
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
          aria-label="返回"
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
          aria-label="客服"
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
      <div className="assistant-page-header__side" aria-hidden="true" />
    </header>
  );
};

export default AssistantPageHeader;
