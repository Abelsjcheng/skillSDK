import React, { useCallback, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';
import '../styles/Content.less';

interface ContentProps {
  messages: Message[];
  welinkSessionId: string;
  isLoading: boolean;
  onCopy: (content: string) => void;
  onSendToIM: (content: string) => void;
}

export const Content: React.FC<ContentProps> = ({
  messages,
  welinkSessionId,
  isLoading,
  onCopy,
  onSendToIM,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();

    // Run again in the next frame and a short delay to absorb layout changes.
    const rafId = window.requestAnimationFrame(scrollToBottom);
    const timerId = window.setTimeout(scrollToBottom, 80);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [messages, scrollToBottom]);

  if (isLoading) {
    return (
      <div className="content">
        <div className="loading-container">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
          &nbsp;加载消息中...
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="content">
        <div className="empty-container">
          <span className="emoji">💬</span>
          <span>发送一条消息开始对话</span>
        </div>
      </div>
    );
  }

  return (
    <div className="content" ref={containerRef}>
      <div className="messages-container">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            welinkSessionId={welinkSessionId}
            onCopy={onCopy}
            onSendToIM={onSendToIM}
          />
        ))}
      </div>
    </div>
  );
};
