import React from 'react';
import { AIProgressStatus } from '../types';
import '../styles/Header.less';

interface HeaderProps {
  title: string;
  progress: AIProgressStatus;
  isMaximized: boolean;
  onMaximize: () => void;
  onClose: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  progress, 
  isMaximized, 
  onMaximize, 
  onClose 
}) => {
  const getProgressIcon = () => {
    switch (progress.status) {
      case 'thinking':
        return '🤔';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '💬';
    }
  };

  const getProgressText = () => {
    if (progress.status === 'processing') {
      return `${progress.step}/${progress.totalSteps}`;
    }
    return '';
  };

  return (
    <div className="header">
      <div className="text-area">
        <span className="progress-icon" title={progress.status}>
          {getProgressIcon()}
        </span>
        <span className="title-text">{title}</span>
      </div>
      <div className="action-area">
        <button 
          className="icon-btn maximize-btn" 
          onClick={onMaximize}
          title={isMaximized ? '缩小' : '放大'}
        >
          {isMaximized ? '🗗' : '🗖'}
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

export default Header;
