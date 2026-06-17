import React, { useState } from 'react';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import starIcon from '../imgs/star_icon.png';
import type { SubtaskBlockProps } from '../types/components';

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
};

export const SubtaskBlock: React.FC<SubtaskBlockProps> = ({ part, children }) => {
  const [expanded, setExpanded] = useState(true);
  const status = part.subagentStatus ?? 'running';
  const statusLabel = statusLabels[status] ?? status;

  return (
    <div className={`subtask-block subtask-block--${status}`}>
      <button
        type="button"
        className="subtask-block__header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="subtask-block__title">
          <img
            className="subtask-block__icon"
            src={starIcon}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <span className="subtask-block__name">{part.subagentName ?? 'Subagent'}</span>
        </div>
        <div className="subtask-block__side">
          <span className="subtask-block__status-text">{statusLabel}</span>
          <img
            className={[
              'subtask-block__chevron',
              !expanded ? 'is-collapsed' : '',
            ].filter(Boolean).join(' ')}
            src={arrowUpIcon}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </div>
      </button>

      {expanded ? (
        <div className="subtask-block__body">
          {children}
        </div>
      ) : null}
    </div>
  );
};
