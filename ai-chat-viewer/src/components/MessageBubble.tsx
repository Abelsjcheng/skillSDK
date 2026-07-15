import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import AvatarImage from './AvatarImage';
import { copyTextToClipboard } from '../utils/clipboard';
import copyIcon from '../imgs/copy_icon.svg';
import sendImIcon from '../imgs/send_im_icon.png';
import { ToolCard } from './ToolCard';
import { ThinkingBlock } from './ThinkingBlock';
import { QuestionCard } from './QuestionCard';
import { PermissionCard } from './PermissionCard';
import { ErrorBlock } from './ErrorBlock';
import { SubtaskBlock } from './SubtaskBlock';
import { createMarkdownComponents, normalizeMarkdownHtml } from './markdownComponents';
import type { Message, MessagePart } from '../types';
import type { MessageBubbleProps } from '../types/components';
import {
  groupMessagePartsForDisplay,
  formatQuestionAnswerDisplay,
  normalizeRole,
  parseQuestionAnswerMatrix,
  shouldRenderMessagePart,
  syncToolCallIdForQuestionParts,
} from '../utils/message';
import defaultAvatar from '../imgs/defaultAvatar.png';
import 'katex/dist/katex.min.css';
import { showToast } from '../utils/toast';
import { WeLog } from '../utils/logger';

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function hasMarkdownCodeBlock(content?: string): boolean {
  if (typeof content !== 'string' || content.length === 0) {
    return false;
  }
  return /(^|\n)```/.test(content);
}

function messageContainsCodeBlock(message: Message): boolean {
  if (message.parts?.some((part) => part.type === 'text' && hasMarkdownCodeBlock(part.content))) {
    return true;
  }
  return hasMarkdownCodeBlock(message.content);
}

function isQuestionPartReadonly(part: MessagePart, readonly: boolean): boolean {
  if (part.type !== 'question') {
    return readonly;
  }
  if (part.answered) {
    return readonly;
  }
  return false;
}

function isPermissionPartReadonly(part: MessagePart, readonly: boolean): boolean {
  if (part.type !== 'permission') {
    return readonly;
  }
  if (part.permResolved) {
    return readonly;
  }
  return false;
}

const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];
const MESSAGE_COPY_TOAST_OPTIONS = { toastClassName: 'toast toast--message-copy' } as const;

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  welinkSessionId,
  variant = 'weAgent',
  showActions = false,
  onQuestionAnswered,
  onCopy,
  onSendToIM,
  weAgentUserName = '',
  weAgentUserAvatar = '',
  weAgentAssistantName = '',
  weAgentAssistantAvatar = '',
}) => {
  const { t } = useTranslation();
  const normalizedRole = normalizeRole(message.role);
  const isUser = normalizedRole === 'user';
  const isHistoryAssistantReadonly = Boolean(message.isHistory && normalizedRole === 'assistant');
  const hasCodeBlock = !isUser && messageContainsCodeBlock(message);
  const isPlainVariant = variant === 'plain';
  const canRenderActions = showActions && !isUser;
  const displayContent = useMemo(() => {
    if (!isUser) {
      return message.content?.trim() ?? '';
    }
    const questionAnswerMatrix = parseQuestionAnswerMatrix(message.content);
    return questionAnswerMatrix
      ? formatQuestionAnswerDisplay([], questionAnswerMatrix, { showQuestionTitle: false })
      : message.content?.trim() ?? '';
  }, [isUser, message.content]);

  const markdownComponents: Components = useMemo(
    () => createMarkdownComponents(true),
    [],
  );

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={MARKDOWN_REMARK_PLUGINS}
      rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
      components={markdownComponents}
    >
      {normalizeMarkdownHtml(content)}
    </ReactMarkdown>
  );

  const renderPart = (part: MessagePart, nested = false): React.ReactNode => {
    switch (part.type) {
      case 'thinking':
        return (
          <ThinkingBlock
            key={part.partId}
            part={part}
            defaultExpanded={!message.isHistory && Boolean(message.isStreaming || part.isStreaming)}
          />
        );

      case 'tool':
        return <ToolCard key={part.partId} part={part} />;

      case 'question':
        return (
          <QuestionCard
            key={part.partId}
            part={part}
            messageId={message.id}
            onAnswered={onQuestionAnswered}
            readonly={isQuestionPartReadonly(part, isHistoryAssistantReadonly)}
          />
        );

      case 'permission':
        return (
          <PermissionCard
            key={part.partId}
            part={part}
            welinkSessionId={welinkSessionId}
            readonly={isPermissionPartReadonly(part, isHistoryAssistantReadonly)}
          />
        );

      case 'file':
        return (
          <div key={part.partId} className="file-part">
            <span className="file-part__icon">附件</span>
            {part.fileUrl ? (
              <a href={part.fileUrl} target="_blank" rel="noopener noreferrer">
                {part.fileName ?? '文件'}
              </a>
            ) : (
              <span>{part.fileName ?? '文件'}</span>
            )}
          </div>
        );

      case 'error':
        return <ErrorBlock key={part.partId} part={part} />;

      case 'subtask':
        return (
          <SubtaskBlock key={part.partId} part={part}>
            <div className="subtask-block__parts">
              {(part.subParts ?? [])
                .filter(shouldRenderMessagePart)
                .map((subPart) => renderPart(subPart, true))}
            </div>
          </SubtaskBlock>
        );

      case 'text':
      default:
        return (
          <div key={part.partId} className="text-part">
            {renderMarkdown(part.content)}
          </div>
        );
    }
  };

  const renderContent = () => {
    const normalizedParts = message.parts
      ? groupMessagePartsForDisplay(syncToolCallIdForQuestionParts(message.parts)).filter(shouldRenderMessagePart)
      : undefined;
    if (normalizedParts && normalizedParts.length > 0) {
      return (
        <div className="message-parts">
          {normalizedParts.map((part) => renderPart(part, false))}
        </div>
      );
    }

    if (!displayContent) {
      return null;
    }

    if (normalizedRole === 'assistant' || normalizedRole === 'tool') {
      return renderMarkdown(displayContent);
    }
    return <span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>;
  };

  const handleCopy = () => {
    if (!displayContent) {
      return;
    }

    if (onCopy) {
      void onCopy(displayContent);
      return;
    }

    void copyTextToClipboard(displayContent)
      .then(() => {
        showToast(t('common.copySuccess'), MESSAGE_COPY_TOAST_OPTIONS);
      })
      .catch((error) => {
        WeLog(`MessageBubble copy failed | error=${JSON.stringify(error)}`);
        showToast(t('common.copyFailed'), MESSAGE_COPY_TOAST_OPTIONS);
      });
  };

  const handleSendToIM = () => {
    void onSendToIM?.(displayContent);
  };

  const renderWeAgentActions = () => {
    if (!canRenderActions || message.isStreaming || !displayContent || !onCopy) {
      return null;
    }

    return (
      <div className="message-actions message-actions--we-agent">
        <button
          type="button"
          className="action-btn copy-btn"
          onClick={handleCopy}
          title={t('common.copyContent')}
        >
          <img className="action-btn__icon" src={copyIcon} alt="" aria-hidden="true" draggable="false" />
        </button>
      </div>
    );
  };

  const renderPlainActions = () => {
    if (!canRenderActions || message.isStreaming || !displayContent || (!onCopy && !onSendToIM)) {
      return null;
    }

    return (
      <div className="message-actions message-actions--plain">
        {onCopy ? (
          <button
            type="button"
            className="action-btn copy-btn"
            onClick={handleCopy}
            title={t('common.copyContent')}
          >
            <img className="action-btn__icon" src={copyIcon} alt="" aria-hidden="true" draggable="false" />
            <span className="action-btn__text">{t('common.copy')}</span>
          </button>
        ) : null}
        {onSendToIM && message.content ? (
          <button
            type="button"
            className="action-btn send-btn"
            onClick={handleSendToIM}
            title="发送到聊天"
          >
            <img className="action-btn__icon" src={sendImIcon} alt="" aria-hidden="true" draggable="false" />
            <span className="action-btn__text">发送</span>
          </button>
        ) : null}
      </div>
    );
  };

  const messageContent = renderContent();
  if (messageContent === null) {
    return null;
  }
  const messageTimeText = formatMessageTime(message.timestamp || new Date().getTime());
  const userName = weAgentUserName.trim();
  const assistantName = weAgentAssistantName.trim();
  const messageMetaText = `${isUser ? userName : assistantName} ${messageTimeText}`.trim();

  if (isPlainVariant) {
    return (
      <div className={`message-block ${isUser ? 'message-user' : 'message-assistant'}`}>
        <div className="message-content">{messageContent}</div>
        {renderPlainActions()}
      </div>
    );
  }

  return (
    <div className={`message-block message-we-agent ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className={`we-agent-message ${isUser ? 'we-agent-message--user' : 'we-agent-message--assistant'}`}>
        <div className={`we-agent-message__meta ${isUser ? 'is-user' : 'is-assistant'}`}>
          {isUser ? (
            <>
              <span className="we-agent-message__meta-text">{messageMetaText}</span>
              <AvatarImage
                className="we-agent-message__avatar"
                src={weAgentUserAvatar}
                fallbackSrc={defaultAvatar}
                alt=""
              />
            </>
          ) : (
            <>
              <AvatarImage
                className="we-agent-message__avatar"
                src={weAgentAssistantAvatar}
                fallbackSrc={defaultAvatar}
                alt=""
              />
              <span className="we-agent-message__meta-text">{messageMetaText}</span>
            </>
          )}
        </div>
        <div
          className={[
            'we-agent-message__bubble',
            isUser ? 'is-user' : 'is-assistant',
            hasCodeBlock ? 'has-code-block' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="message-content">{messageContent}</div>
          {renderWeAgentActions()}
        </div>
      </div>
    </div>
  );
};
