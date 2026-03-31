import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { ToolCard } from './ToolCard';
import { ThinkingBlock } from './ThinkingBlock';
import { QuestionCard } from './QuestionCard';
import { PermissionCard } from './PermissionCard';
import type { Message, MessagePart } from '../types';
import { normalizeRole, syncToolCallIdForQuestionParts } from '../utils/message';
import assistantAvatar from '../imgs/assistant-avatar.svg';
import userAvatar from '../imgs/switch-assistant-avatar.svg';
import 'katex/dist/katex.min.css';

interface MessageBubbleProps {
  message: Message;
  welinkSessionId: string;
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  welinkSessionId,
  weAgentUserName = '',
  weAgentUserAvatar = '',
  weAgentAssistantName = '',
  weAgentAssistantAvatar = '',
}) => {
  const normalizedRole = normalizeRole(message.role);
  const isUser = normalizedRole === 'user';
  const isHistoryAssistantReadonly = Boolean(message.isHistory && normalizedRole === 'assistant');

  const markdownComponents: Components = useMemo(
    () => ({
      code({ className, children, ...rest }) {
        const match = /language-(\w+)/.exec(className ?? '');
        const codeString = String(children).replace(/\n$/, '');
        if (match) {
          return <CodeBlock code={codeString} language={match[1]} />;
        }
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        );
      },
    }),
    [],
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
            welinkSessionId={welinkSessionId}
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

      case 'text':
      default:
        return (
          <div key={part.partId} className="text-part">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
              components={markdownComponents}
            >
              {part.content}
            </ReactMarkdown>
            {part.isStreaming && <span className="streaming-cursor" />}
          </div>
        );
    }
  };

  const renderContent = () => {
    const normalizedParts = message.parts ? syncToolCallIdForQuestionParts(message.parts) : undefined;
    if (normalizedParts && normalizedParts.length > 0) {
      return (
        <div className="message-parts">
          {normalizedParts.map((part) => renderPart(part))}
        </div>
      );
    }

    if (normalizedRole === 'assistant' || normalizedRole === 'tool') {
      return (
        <>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
          {message.isStreaming && <span className="streaming-cursor" />}
        </>
      );
    }
    return <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>;
  };

  const messageContent = renderContent();
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
        <div className={`we-agent-message__bubble ${isUser ? 'is-user' : 'is-assistant'}`}>
          <div className="message-content">{messageContent}</div>
        </div>
      </div>
    </div>
  );
};
