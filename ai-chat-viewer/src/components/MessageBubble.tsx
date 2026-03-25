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
import type { AppVariant } from '../App';
import type { Message, MessagePart } from '../types';
import { normalizeRole, syncToolCallIdForQuestionParts } from '../utils/message';
import assistantAvatar from '../imgs/assistant-avatar.svg';
import userAvatar from '../imgs/switch-assistant-avatar.svg';
import 'katex/dist/katex.min.css';

interface MessageBubbleProps {
  message: Message;
  welinkSessionId: string;
  onCopy?: (content: string) => void;
  onSendToIM?: (content: string) => void;
  variant?: AppVariant;
}

const roleLabels: Record<string, string> = {
  user: '你',
  assistant: 'OpenCode',
  system: '系统',
  tool: '工具',
};

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
  onCopy,
  onSendToIM,
  variant = 'default',
}) => {
  const normalizedRole = normalizeRole(message.role);
  const isUser = normalizedRole === 'user';
  const isWeAgentCUI = variant === 'weAgentCUI';

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

  const handleCopy = () => {
    if (onCopy) {
      onCopy(message.content);
    } else {
      navigator.clipboard.writeText(message.content);
    }
  };

  const handleSendToIM = () => {
    if (onSendToIM) {
      onSendToIM(message.content);
    }
  };

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
          />
        );

      case 'permission':
        return (
          <PermissionCard
            key={part.partId}
            part={part}
            welinkSessionId={welinkSessionId}
          />
        );

      case 'file':
        return (
          <div key={part.partId} className="file-part">
            <span className="file-part__icon">📄</span>
            {part.fileUrl ? (
              <a href={part.fileUrl} target="_blank" rel="noopener noreferrer">
                {part.fileName ?? '文件'}
              </a>
            ) : (
              <span>{part.fileName ?? '文件'}</span>
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

  if (isWeAgentCUI) {
    const messageMetaText = `${isUser ? '测试' : '小米'} ${formatMessageTime(message.timestamp)}`;

    return (
      <div className={`message-block message-we-agent ${isUser ? 'message-user' : 'message-assistant'}`}>
        <div className={`we-agent-message ${isUser ? 'we-agent-message--user' : 'we-agent-message--assistant'}`}>
          <div className={`we-agent-message__meta ${isUser ? 'is-user' : 'is-assistant'}`}>
            {isUser ? (
              <>
                <span className="we-agent-message__meta-text">{messageMetaText}</span>
                <img className="we-agent-message__avatar" src={userAvatar} alt="" />
              </>
            ) : (
              <>
                <img className="we-agent-message__avatar" src={assistantAvatar} alt="" />
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
  }

  return (
    <div className={`message-block ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-content">
        {!isUser && (
          <div className="message-role-label">
            {roleLabels[normalizedRole] ?? message.role}
          </div>
        )}
        {messageContent}
      </div>
      {!isUser && !message.isStreaming && message.content && (
        <div className="message-actions">
          <button
            className="action-btn copy-btn"
            onClick={handleCopy}
            title="复制内容"
          >
            📋 复制
          </button>
          <button
            className="action-btn send-btn"
            onClick={handleSendToIM}
            title="发送到聊天"
          >
            ↗️ 发送
          </button>
        </div>
      )}
    </div>
  );
};
