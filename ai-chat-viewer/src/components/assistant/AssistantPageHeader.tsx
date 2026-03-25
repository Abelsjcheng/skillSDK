import React from 'react';
import backIcon from '../../imgs/icon-back.svg';
import serviceIcon from '../../imgs/icon-service.svg';
import '../../styles/AssistantPageHeader.less';

interface AssistantPageHeaderProps {
  title: string;
  onBack?: () => void;
  onService?: () => void;
}

const noop = () => {};

const AssistantPageHeader: React.FC<AssistantPageHeaderProps> = ({
  title,
  onBack = noop,
  onService = noop,
}) => (
  <header className="assistant-page-header">
    <div className="assistant-page-header__side assistant-page-header__side--left">
      <button type="button" className="assistant-page-header__icon-btn" aria-label="返回" onClick={onBack}>
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

export default AssistantPageHeader;
