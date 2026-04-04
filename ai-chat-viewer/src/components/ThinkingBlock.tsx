import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import type { MessagePart } from '../types';
import { createMarkdownComponents } from './markdownComponents';

const STREAMING_CURSOR_HTML = '<span class="streaming-cursor"></span>';

function withStreamingCursor(content: string, isStreaming: boolean): string {
  return isStreaming ? `${content}${STREAMING_CURSOR_HTML}` : content;
}

interface ThinkingBlockProps {
  part: MessagePart;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ part }) => {
  const [expanded, setExpanded] = useState(true);
  const prevStreamingRef = useRef(part.isStreaming);
  const markdownComponents = useRef<Components>(createMarkdownComponents());

  useEffect(() => {
    if (part.isStreaming && !prevStreamingRef.current) {
      // thinking resumed: reopen the panel so new content is visible.
      setExpanded(true);
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
            components={markdownComponents.current}
          >
            {withStreamingCursor(part.content, part.isStreaming)}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
