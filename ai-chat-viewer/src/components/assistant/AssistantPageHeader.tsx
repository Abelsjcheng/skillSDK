import React from 'react';
import backIcon from '../../imgs/icon-back.svg';
import closeIcon from '../../imgs/icon-close.svg';
import serviceIcon from '../../imgs/icon-service.svg';
import '../../styles/AssistantPageHeader.less';

interface AssistantPageHeaderProps {
  title: string;
  isPcMiniApp?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onService?: () => void;
}

const noop = () => {};
const ASSISTANT_CLOSE_EVENT = 'weAgent:assistant-close';

const dispatchAssistantCloseEvent = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ASSISTANT_CLOSE_EVENT));
};

const AssistantPageHeader: React.FC<AssistantPageHeaderProps> = ({
  title,
  isPcMiniApp = false,
  onBack = noop,
  onClose = noop,
  onService = noop,
}) => {
  if (isPcMiniApp) {
    return (
      <header className="assistant-page-header assistant-page-header--pc">
        <button
          type="button"
          className="assistant-page-header__pc-btn"
          aria-label="关闭"
          onClick={() => {
            dispatchAssistantCloseEvent();
            onClose();
          }}
        >
          <img src={closeIcon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />
        </button>
        <span className="assistant-page-header__title">{title}</span>
        <button
          type="button"
          className="assistant-page-header__pc-btn"
          aria-label="客服"
          onClick={onService}
        >
          <img src={serviceIcon} alt="" className="assistant-page-header__pc-icon" aria-hidden="true" />
        </button>
      </header>
    );
  }

  return (
    <header className="assistant-page-header assistant-page-header--mobile">
      <div className="assistant-page-header__side assistant-page-header__side--left">
        <button
          type="button"
          className="assistant-page-header__icon-btn"
          aria-label="返回"
          onClick={() => {
            dispatchAssistantCloseEvent();
            onBack();
          }}
        >
          <img src={backIcon} alt="" className="assistant-page-header__icon-img" aria-hidden="true" />
        </button>
        <button type="button" className="assistant-page-header__icon-btn" aria-label="客服" onClick={onService}>
          <img src={serviceIcon} alt="" className="assistant-page-header__icon-img" aria-hidden="true" />
        </button>
      </div>
      <span className="assistant-page-header__title">{title}</span>
      <div className="assistant-page-header__side" aria-hidden="true" />
    </header>
  );
};

export default AssistantPageHeader;
