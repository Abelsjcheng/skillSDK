import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import arrowUpIcon from '../imgs/arrow_up_icon.svg';
import errorIcon from '../imgs/error_icon.svg';
import successIcon from '../imgs/success_icon.svg';
import { createMarkdownComponents, normalizeMarkdownHtml } from './markdownComponents';
import type { ToolCardProps } from '../types/components';

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
};

const statusIcons: Record<string, string> = {
  pending: successIcon,
  running: successIcon,
  completed: successIcon,
  error: errorIcon,
};

function resolveInputContent(input: object | null | undefined): string {
  if (!input) {
    return '';
  }

  const content = (input as { content: string }).content;
  if (typeof content === 'string' && content) {
    return content;
  }

  return JSON.stringify(input);
}

export const ToolCard: React.FC<ToolCardProps> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);
  const status = part.status ?? 'pending';
  const statusLabel = statusLabels[status] ?? status;
  const statusIcon = statusIcons[status] ?? successIcon;
  const markdownComponents: Components = useMemo(
    () => createMarkdownComponents(true),
    [],
  );
  const inputContent = resolveInputContent(part.input);
  const errorContent = part?.error || part?.content || '';

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={markdownComponents}
    >
      {normalizeMarkdownHtml(content)}
    </ReactMarkdown>
  );

  return (
    <div className={`tool-card tool-card--${status}`}>
      <div
        className="tool-card__header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className="tool-card__icon">
          <img
            className="tool-card__icon-img"
            src={statusIcon}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </span>
        <span className="tool-card__name">{part.toolName ?? 'Tool call'}</span>
        {part.title && (
          <span className="tool-card__title">{part.title}</span>
        )}
        <span className="tool-card__status">{statusLabel}</span>
        <img
          className={[
            'tool-card__chevron',
            !expanded ? 'is-collapsed' : '',
          ].filter(Boolean).join(' ')}
          src={arrowUpIcon}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </div>

      {expanded && (
        <div className="tool-card__body">
          {inputContent && (
            <div className="tool-card__section">
              <div className="tool-card__section-title">Input</div>
              <div className="tool-card__code">{renderMarkdown(inputContent)}</div>
            </div>
          )}
          {part.output && (
            <div className="tool-card__section">
              <div className="tool-card__section-title">Output</div>
              <div className="tool-card__code">{renderMarkdown(part.output)}</div>
            </div>
          )}
          {status === 'error' && errorContent && (
            <div className="tool-card__section tool-card__error">
              <div className="tool-card__section-title">Error</div>
              <div className="tool-card__code">{renderMarkdown(errorContent)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
