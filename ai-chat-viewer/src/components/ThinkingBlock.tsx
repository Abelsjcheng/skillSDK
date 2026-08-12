import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import thinkingIcon from '../imgs/thinking_icon.svg';
import thinkingFinishIcon from '../imgs/success_icon.svg';
import ingIcon from '../imgs/ingicon.svg';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import type { ThinkingBlockProps } from '../types/components';
import { createMarkdownComponents, normalizeMarkdownHtml } from './markdownComponents';

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ part }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
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
        <img alt="" src={part.isStreaming ? thinkingIcon : thinkingFinishIcon} className="send-icon" draggable="false"></img>
        <span className="thinking-block__label">{part.isStreaming ? t('thinking.streaming') : t('thinking.streamingCompleted')}</span>
        {part.isStreaming && <img alt="" src={ingIcon} className="send-icon"></img>}
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
