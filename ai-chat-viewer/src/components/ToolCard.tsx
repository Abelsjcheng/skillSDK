import React, { useState } from 'react';
import type { MessagePart } from '../types';

interface ToolCardProps {
  part: MessagePart;
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
};

const statusIcons: Record<string, string> = {
  pending: 'O',
  running: '*',
  completed: 'OK',
  error: 'X',
};

export const ToolCard: React.FC<ToolCardProps> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);
  const status = part.status ?? 'pending';
  const statusLabel = statusLabels[status] ?? status;
  const statusIcon = statusIcons[status] ?? 'i';

  return (
    <div className={`tool-card tool-card--${status}`}>
      <div
        className="tool-card__header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className="tool-card__icon">{statusIcon}</span>
        <span className="tool-card__name">{part.toolName ?? 'Tool call'}</span>
        {part.title && (
          <span className="tool-card__title">{part.title}</span>
        )}
        <span className="tool-card__status">{statusLabel}</span>
        <span className={`tool-card__chevron ${expanded ? 'expanded' : ''}`}>
          {'>'}
        </span>
      </div>

      {expanded && (
        <div className="tool-card__body">
          {part.input && (
            <div className="tool-card__section">
              <div className="tool-card__section-title">Input</div>
              <pre className="tool-card__code">{JSON.stringify(part.input, null, 2)}</pre>
            </div>
          )}
          {part.output && (
            <div className="tool-card__section">
              <div className="tool-card__section-title">Output</div>
              <pre className="tool-card__code">{part.output}</pre>
            </div>
          )}
          {status === 'error' && part.content && (
            <div className="tool-card__section tool-card__error">
              <div className="tool-card__section-title">Error</div>
              <pre className="tool-card__code">{part.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
