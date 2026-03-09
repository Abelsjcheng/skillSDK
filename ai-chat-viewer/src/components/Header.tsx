import React from 'react';
import type { SessionStatus, AgentStatus } from '../types';
import '../styles/Header.less';

interface HeaderProps {
  title: string;
  sessionStatus: SessionStatus;
  agentStatus: AgentStatus;
  isMaximized: boolean;
  onMaximize: () => void;
  onClose: () => void;
}

const sessionStatusConfig: Record<SessionStatus, { icon: string; text: string }> = {
  idle: { icon: '💬', text: '空闲' },
  busy: { icon: '⚙️', text: '处理中...' },
  retry: { icon: '🔄', text: '重试中...' },
  error: { icon: '❌', text: '错误' },
};

const agentStatusConfig: Record<AgentStatus, { color: string; text: string }> = {
  online: { color: '#4caf50', text: '在线' },
  offline: { color: '#9e9e9e', text: '离线' },
  unknown: { color: '#ff9800', text: '连接中...' },
};

export const Header: React.FC<HeaderProps> = ({
  title,
  sessionStatus,
  agentStatus,
  isMaximized,
  onMaximize,
  onClose,
}) => {
  const sessionCfg = sessionStatusConfig[sessionStatus] ?? sessionStatusConfig.idle;
  const agentCfg = agentStatusConfig[agentStatus] ?? agentStatusConfig.unknown;

  return (
    <div className="header">
      <div className="text-area">
        <span className="progress-icon" title={sessionCfg.text}>
          {sessionCfg.icon}
        </span>
        <span className="title-text">{title}</span>
        <span
          className="agent-status-dot"
          style={{ backgroundColor: agentCfg.color }}
          title={agentCfg.text}
        />
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