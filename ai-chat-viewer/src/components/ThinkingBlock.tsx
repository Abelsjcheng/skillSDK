import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import type { MessagePart } from '../types';

interface ThinkingBlockProps {
  part: MessagePart;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ part }) => {
  const [expanded, setExpanded] = useState(part.isStreaming);
  const prevStreamingRef = useRef(part.isStreaming);

  useEffect(() => {
    if (part.isStreaming && !prevStreamingRef.current) {
      // thinking started: default expand
      setExpanded(true);
    } else if (!part.isStreaming && prevStreamingRef.current) {
      // thinking finished: auto collapse
      setExpanded(false);
    }
    prevStreamingRef.current = part.isStreaming;
  }, [part.isStreaming]);

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
        <img
          className={[
            'thinking-block__chevron',
            !expanded ? 'is-collapsed' : '',
          ].filter(Boolean).join(' ')}
          src={arrowUpIcon}
          alt=""
          aria-hidden="true"
        />
      </div>

      {expanded && (
        <div className="thinking-block__content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
          >
            {part.content}
          </ReactMarkdown>
          {part.isStreaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  );
};
