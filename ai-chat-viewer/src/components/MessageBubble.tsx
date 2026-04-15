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

function hasVisibleText(value?: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function shouldRenderPart(part: MessagePart): boolean {
  switch (part.type) {
    case 'text':
    case 'thinking':
    case 'error':
      return hasVisibleText(part.content);
    case 'tool':
      return hasVisibleText(part.content)
        || hasVisibleText(part.toolName)
        || hasVisibleText(part.title)
        || hasVisibleText(part.output)
        || hasVisibleText(part.error)
        || Boolean(part.input)
        || Boolean(part.status);
    case 'question':
      return hasVisibleText(part.content)
        || hasVisibleText(part.header)
        || hasVisibleText(part.question)
        || Boolean(part.options?.length)
        || hasVisibleText(part.output)
        || Boolean(part.answered);
    case 'permission':
      return hasVisibleText(part.content)
        || hasVisibleText(part.permType)
        || hasVisibleText(part.permissionId)
        || hasVisibleText(part.response)
        || Boolean(part.permResolved);
    case 'file':
      return hasVisibleText(part.content)
        || hasVisibleText(part.fileName)
        || hasVisibleText(part.fileUrl);
    default:
      return hasVisibleText(part.content);
  }
}

const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];

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
  const isHistoryAssistantReadonly = Boolean(message.isHistory && normalizedRole === 'assistant');
  const hasCodeBlock = !isUser && messageContainsCodeBlock(message);

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
      {content}
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
      ? syncToolCallIdForQuestionParts(message.parts).filter(shouldRenderPart)
      : undefined;
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
      return renderMarkdown(message.content);
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
            hasCodeBlock ? 'has-code-block' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="message-content">{messageContent}</div>
        </div>
      </div>
    </div>
  );
};
