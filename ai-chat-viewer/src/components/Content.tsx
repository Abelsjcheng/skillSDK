import React, { useCallback, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';
import '../styles/Content.less';

const TOP_LOAD_THRESHOLD = 24;

interface ContentProps {
  messages: Message[];
  welinkSessionId: string;
  isLoading: boolean;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  onLoadMoreHistory: () => void;
  onCopy: (content: string) => void;
  onSendToIM: (content: string) => void;
}

export const Content: React.FC<ContentProps> = ({
  messages,
  welinkSessionId,
  isLoading,
  isLoadingHistory,
  hasMoreHistory,
  onLoadMoreHistory,
  onCopy,
  onSendToIM,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const preservingAnchorRef = useRef<{
    active: boolean;
    messageId: string | null;
    offsetTop: number;
  }>({
    active: false,
    messageId: null,
    offsetTop: 0,
  });

  const getMessageOffsetTop = useCallback((messageId: string | null): number | null => {
    if (!messageId) return null;
    const container = containerRef.current;
    if (!container) return null;
    const messageElement = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    return messageElement ? messageElement.offsetTop : null;
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (preservingAnchorRef.current.active) return;
    if (isLoadingHistory || !hasMoreHistory) return;
    if (container.scrollTop > TOP_LOAD_THRESHOLD) return;

    const anchorId = messages[0]?.id ?? null;
    const anchorOffsetTop = getMessageOffsetTop(anchorId);
    preservingAnchorRef.current = {
      active: true,
      messageId: anchorId,
      offsetTop: anchorOffsetTop ?? 0,
    };

    onLoadMoreHistory();
  }, [getMessageOffsetTop, hasMoreHistory, isLoadingHistory, messages, onLoadMoreHistory]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    if (preservingAnchorRef.current.active) {
      const { messageId, offsetTop } = preservingAnchorRef.current;
      const nextOffsetTop = getMessageOffsetTop(messageId);
      if (nextOffsetTop !== null) {
        container.scrollTop += nextOffsetTop - offsetTop;
      }
      preservingAnchorRef.current.active = false;
      preservingAnchorRef.current.messageId = null;
      return undefined;
    }

    scrollToBottom();

    // Run again in the next frame and a short delay to absorb layout changes.
    const rafId = window.requestAnimationFrame(scrollToBottom);
    const timerId = window.setTimeout(scrollToBottom, 80);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [getMessageOffsetTop, messages, scrollToBottom]);

  useEffect(() => {
    if (!isLoadingHistory && preservingAnchorRef.current.active) {
      preservingAnchorRef.current.active = false;
      preservingAnchorRef.current.messageId = null;
    }
  }, [isLoadingHistory]);

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
    <div className="content" ref={containerRef} onScroll={handleScroll}>
      <div className="messages-container">
        {isLoadingHistory && (
          <div className="history-status">加载历史消息中...</div>
        )}
        {!isLoadingHistory && !hasMoreHistory && (
          <div className="history-status history-status--end">没有更多消息</div>
        )}
        {messages.map((message) => (
          <div key={message.id} data-message-id={message.id}>
            <MessageBubble
              message={message}
              welinkSessionId={welinkSessionId}
              onCopy={onCopy}
              onSendToIM={onSendToIM}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
