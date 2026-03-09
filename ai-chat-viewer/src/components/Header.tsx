import React from 'react';
import { AgentStatus, SessionStatus } from '../types';
import '../styles/Header.less';

interface HeaderProps {
  title: string;
  sessionStatus: SessionStatus;
  agentStatus: AgentStatus;
  onMinimize: () => void;
  onClose: () => void;
  disabled?: boolean;
}

const sessionStatusText: Record<SessionStatus, string> = {
  busy: '生成中',
  idle: '空闲',
  retry: '重试中',
  unknown: '初始化中',
};

const agentStatusText: Record<AgentStatus, string> = {
  online: 'Agent 在线',
  offline: 'Agent 离线',
  unknown: 'Agent 状态未知',
};

const Header: React.FC<HeaderProps> = ({
  title,
  sessionStatus,
  agentStatus,
  onMinimize,
  onClose,
  disabled = false,
}) => {
  return (
    <header className="header">
      <div className="text-area">
        <span className={`status-dot status-${sessionStatus}`} />
        <span className="title-text" title={title}>{title}</span>
        <span className="status-text">{sessionStatusText[sessionStatus]}</span>
        <span className={`agent-status agent-${agentStatus}`}>{agentStatusText[agentStatus]}</span>
      </div>
      <div className="action-area">
        <button
          className="icon-btn minimize-btn"
          onClick={onMinimize}
          disabled={disabled}
          title="缩小"
          type="button"
        >
          缩小
        </button>
        <button
          className="icon-btn close-btn"
          onClick={onClose}
          disabled={disabled}
          title="关闭"
          type="button"
        >
          关闭
        </button>
      </div>
    </header>
  );
};

export default Header;
