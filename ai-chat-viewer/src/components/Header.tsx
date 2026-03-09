import React from 'react';
import '../styles/Header.less';

interface HeaderProps {
  onMinimize: () => void;
  onClose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMinimize,
  onClose,
}) => {
  return (
    <div className="header">
      <div className="text-area">
        <span className="logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="4" stroke="#1890ff" strokeWidth="2" fill="none"/>
            <path d="M8 12L11 15L16 9" stroke="#1890ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span className="title-text">AI技能</span>
      </div>
      <div className="action-area">
        <button
          className="icon-btn minimize-btn"
          onClick={onMinimize}
          title="缩小"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          className="icon-btn close-btn"
          onClick={onClose}
          title="关闭"
        >
          ✕
        </button>
      </div>
    </div>
  );
};