import React, { useState } from 'react';
import type { MessagePart } from '../types';

interface ToolCardProps {
  part: MessagePart;
}

const statusLabels: Record<string, string> = {
  pending: '等待中',
  running: '运行中...',
  completed: '完成',
  error: '错误',
};

const statusIcons: Record<string, string> = {
  pending: '⏳',
  running: '⚙️',
  completed: '✅',
  error: '❌',
};

export const ToolCard: React.FC<ToolCardProps> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);
  const status = part.toolStatus ?? 'pending';
  const statusLabel = statusLabels[status] ?? status;
  const statusIcon = statusIcons[status] ?? '🔧';

  return (
    <div className={`tool-card tool-card--${status}`}>
      <div
        className="tool-card__header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className="tool-card__icon">{statusIcon}</span>
        <span className="tool-card__name">{part.toolName ?? '工具调用'}</span>
        {part.toolTitle && (
          <span className="tool-card__title">{part.toolTitle}</span>
        )}
        <span className="tool-card__status">{statusLabel}</span>
        <span className={`tool-card__chevron ${expanded ? 'expanded' : ''}`}>
          ▶
        </span>
      </div>

      {expanded && (
        <div className="tool-card__body">
          {part.toolInput && (
            <div className="tool-card__section">
              <div className="tool-card__section-title">输入</div>
              <pre className="tool-card__code">
                {JSON.stringify(part.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {part.toolOutput && (
            <div className="tool-card__section">
              <div className="tool-card__section-title">输出</div>
              <pre className="tool-card__code">{part.toolOutput}</pre>
            </div>
          )}
          {status === 'error' && part.content && (
            <div className="tool-card__section tool-card__error">
              <div className="tool-card__section-title">错误</div>
              <pre className="tool-card__code">{part.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};