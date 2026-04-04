import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import { ToolCard } from './ToolCard';
import { ThinkingBlock } from './ThinkingBlock';
import { QuestionCard } from './QuestionCard';
import { PermissionCard } from './PermissionCard';
import { ErrorBlock } from './ErrorBlock';
import { createMarkdownComponents } from './markdownComponents';
import type { Message, MessagePart, QuestionAnswerSubmission } from '../types';
import { normalizeRole, syncToolCallIdForQuestionParts } from '../utils/message';
import assistantAvatar from '../imgs/assistant-avatar.svg';
import generatingIcon from '../imgs/generating_icon.png';
import userAvatar from '../imgs/switch-assistant-avatar.svg';
import 'katex/dist/katex.min.css';

interface MessageBubbleProps {
  message: Message;
  welinkSessionId: string;
  onQuestionAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  weAgentUserName?: string;
  weAgentUserAvatar?: string;
  weAgentAssistantName?: string;
  weAgentAssistantAvatar?: string;
}

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
const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];
const STREAMING_CURSOR_HTML = '<span class="streaming-cursor"></span>';

function withStreamingCursor(content: string, isStreaming?: boolean): string {
  return isStreaming ? `${content}${STREAMING_CURSOR_HTML}` : content;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  welinkSessionId,
  onQuestionAnswered,
  weAgentUserName = '',
  weAgentUserAvatar = '',
  weAgentAssistantName = '',
  weAgentAssistantAvatar = '',
}) => {
  const normalizedRole = normalizeRole(message.role);
  const isUser = normalizedRole === 'user';
  const isPendingAssistant = normalizedRole === 'assistant' && Boolean(message.meta?.pending);
  const isHistoryAssistantReadonly = Boolean(message.isHistory && normalizedRole === 'assistant');
  const hasCodeBlock = !isUser && messageContainsCodeBlock(message);

  const markdownComponents: Components = useMemo(
    () => createMarkdownComponents(true),
    [],
  );

  const renderMarkdown = (content: string, isStreaming?: boolean) => (
    <ReactMarkdown
      remarkPlugins={MARKDOWN_REMARK_PLUGINS}
      rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
      components={markdownComponents}
    >
      {withStreamingCursor(content, isStreaming)}
    </ReactMarkdown>
  );

  const renderPart = (part: MessagePart) => {
    switch (part.type) {
      case 'thinking':
        return <ThinkingBlock key={part.partId} part={part} />;

      case 'tool':
        return <ToolCard key={part.partId} part={part} />;

      case 'question':
        return (
          <QuestionCard
            key={part.partId}
            part={part}
            onAnswered={onQuestionAnswered}
            readonly={isHistoryAssistantReadonly}
          />
        );

      case 'permission':
        return (
          <PermissionCard
            key={part.partId}
            part={part}
            welinkSessionId={welinkSessionId}
            readonly={isHistoryAssistantReadonly}
          />
        );

      case 'file':
        return (
          <div key={part.partId} className="file-part">
            <span className="file-part__icon">馃搸</span>
            {part.fileUrl ? (
              <a href={part.fileUrl} target="_blank" rel="noopener noreferrer">
                {part.fileName ?? '鏂囦欢'}
              </a>
            ) : (
              <span>{part.fileName ?? '鏂囦欢'}</span>
            )}
          </div>
        );

      case 'error':
        return <ErrorBlock key={part.partId} part={part} />;

      case 'text':
      default:
        return (
          <div key={part.partId} className="text-part">
            {renderMarkdown(part.content, part.isStreaming)}
          </div>
        );
    }
  };

  const renderContent = () => {
    if (isPendingAssistant) {
      return (
        <div className="we-agent-message__pending">
          <img className="we-agent-message__pending-icon" src={generatingIcon} alt="" />
          <span className="we-agent-message__pending-text">{message.content}</span>
        </div>
      );
    }

    const normalizedParts = message.parts ? syncToolCallIdForQuestionParts(message.parts) : undefined;
    if (normalizedParts && normalizedParts.length > 0) {
      return (
        <div className="message-parts">
          {normalizedParts.map((part) => renderPart(part))}
        </div>
      );
    }

    if (message.content === '') {
      return null;
    }

    if (normalizedRole === 'assistant' || normalizedRole === 'tool') {
      return renderMarkdown(message.content, message.isStreaming);
    }
    return <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>;
  };

  const messageContent = renderContent();
  if (messageContent === null) {
    return null;
  }
  const messageTimeText = formatMessageTime(message.timestamp || new Date().getTime());
  const userName = weAgentUserName.trim();
  const assistantName = weAgentAssistantName.trim();
  const messageMetaText = `${isUser ? userName : assistantName} ${messageTimeText}`.trim();
  const resolvedUserAvatar = weAgentUserAvatar || userAvatar;
  const resolvedAssistantAvatar = weAgentAssistantAvatar || assistantAvatar;

  return (
    <div className={`message-block message-we-agent ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className={`we-agent-message ${isUser ? 'we-agent-message--user' : 'we-agent-message--assistant'}`}>
        <div className={`we-agent-message__meta ${isUser ? 'is-user' : 'is-assistant'}`}>
          {isUser ? (
            <>
              <span className="we-agent-message__meta-text">{messageMetaText}</span>
              <img className="we-agent-message__avatar" src={resolvedUserAvatar} alt="" />
            </>
          ) : (
            <>
              <img className="we-agent-message__avatar" src={resolvedAssistantAvatar} alt="" />
              <span className="we-agent-message__meta-text">{messageMetaText}</span>
            </>
          )}
        </div>
        <div
          className={[
            'we-agent-message__bubble',
            isUser ? 'is-user' : 'is-assistant',
            isPendingAssistant ? 'is-pending' : '',
            hasCodeBlock ? 'has-code-block' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="message-content">{messageContent}</div>
        </div>
      </div>
    </div>
  );
};
