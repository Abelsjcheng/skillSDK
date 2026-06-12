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
import type { ThinkingBlockProps } from '../types/components';
import { createMarkdownComponents, normalizeMarkdownHtml } from './markdownComponents';

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ part, defaultExpanded = false }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const userInteractedRef = useRef(false);
  const markdownComponents = useRef<Components>(createMarkdownComponents());

  useEffect(() => {
    if (defaultExpanded && !userInteractedRef.current) {
      setExpanded(true);
    }
  }, [defaultExpanded]);

  const handleToggle = () => {
    userInteractedRef.current = true;
    setExpanded((nextExpanded) => !nextExpanded);
  };

  return (
    <div className={`thinking-block ${part.isStreaming ? 'streaming' : ''}`}>
      <div
        className="thinking-block__header"
        onClick={handleToggle}
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
          draggable="false"
        />
      </div>

      {expanded && (
        <div className="thinking-block__content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={markdownComponents.current}
          >
            {normalizeMarkdownHtml(part.content)}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
