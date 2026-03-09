import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MessagePart } from '../types';

interface ThinkingBlockProps {
  part: MessagePart;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`thinking-block ${part.isStreaming ? 'streaming' : ''}`}>
      <div
        className="thinking-block__header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className="thinking-block__icon">💭</span>
        <span className="thinking-block__label">思考过程</span>
        {part.isStreaming && (
          <span className="thinking-block__streaming">思考中...</span>
        )}
        <span className={`thinking-block__chevron ${expanded ? 'expanded' : ''}`}>
          ▶
        </span>
      </div>

      {expanded && (
        <div className="thinking-block__content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {part.content}
          </ReactMarkdown>
          {part.isStreaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  );
};