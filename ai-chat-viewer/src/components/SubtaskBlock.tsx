import React, { useMemo, useState } from 'react';
import type { SubtaskBlockProps } from '../types/components';

function countToolParts(subParts: NonNullable<SubtaskBlockProps['part']['subParts']>): number {
  return subParts.filter((part) => part.type === 'tool').length;
}

export const SubtaskBlock: React.FC<SubtaskBlockProps> = ({ part, children }) => {
  const [expanded, setExpanded] = useState(false);
  const toolCount = useMemo(() => countToolParts(part.subParts ?? []), [part.subParts]);
  const status = part.subagentStatus ?? 'running';
  const summary = part.subagentPrompt ?? '';

  return (
    <div className={`subtask-block subtask-block--${status}`}>
      <button
        type="button"
        className="subtask-block__header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="subtask-block__meta">
          <span className={`subtask-block__status subtask-block__status--${status}`} />
          <span className="subtask-block__name">{part.subagentName ?? 'Subagent'}</span>
          <span className="subtask-block__summary">{summary}</span>
        </div>
        <div className="subtask-block__side">
          <span className="subtask-block__tools">{toolCount} tools</span>
          <span className={`subtask-block__chevron ${expanded ? 'is-open' : ''}`}>{'>'}</span>
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
