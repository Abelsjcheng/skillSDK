import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import type { MessagePart } from '../types';
import { createMarkdownComponents } from './markdownComponents';

interface ThinkingBlockProps {
  part: MessagePart;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ part }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const prevStreamingRef = useRef(part.isStreaming);
  const markdownComponents = useRef<Components>(createMarkdownComponents());

  useEffect(() => {
    if (part.isStreaming && !prevStreamingRef.current) {
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
        <span className="thinking-block__icon">*</span>
        <span className="thinking-block__label">{t('thinking.title')}</span>
        {part.isStreaming && (
          <span className="thinking-block__streaming">{t('thinking.streaming')}</span>
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
            {part.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
