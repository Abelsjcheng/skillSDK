import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import assistantAvatar from '../imgs/assistant-avatar.svg';
import type { Message, QuestionAnswerSubmission } from '../types';
import { MessageBubble } from './MessageBubble';
import '../styles/Content.less';

const TOP_LOAD_THRESHOLD = 24;
const BOTTOM_AUTO_SCROLL_THRESHOLD = 24;

interface ContentProps {
  messages: Message[];
  welinkSessionId: string;
  scrollToBottomSignal?: number;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  onLoadMoreHistory: () => void;
  onQuestionAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  weAgentUserName?: string;
  weAgentUserAvatar?: string;
  weAgentAssistantName?: string;
  weAgentAssistantDescription?: string;
  weAgentAssistantAvatar?: string;
}

export const Content: React.FC<ContentProps> = ({
  messages,
  welinkSessionId,
  scrollToBottomSignal = 0,
  isLoadingHistory,
  hasMoreHistory,
  onLoadMoreHistory,
  onQuestionAnswered,
  weAgentUserName = '',
  weAgentUserAvatar = '',
  weAgentAssistantName = '',
  weAgentAssistantDescription = '',
  weAgentAssistantAvatar = '',
}) => {
  const { t } = useTranslation();
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
  const shouldAutoScrollRef = useRef(true);

  const welcomeTitle = weAgentUserName ? t('weAgent.welcomeMorning', { name: weAgentUserName }) : '';
  const welcomeSubtitle = [weAgentAssistantName, weAgentAssistantDescription].filter(Boolean).join(' | ');
  const welcomeAvatar = weAgentAssistantAvatar || assistantAvatar;

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
    const distanceToBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    shouldAutoScrollRef.current = distanceToBottom <= BOTTOM_AUTO_SCROLL_THRESHOLD;
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

    if (!shouldAutoScrollRef.current) {
      return undefined;
    }

    scrollToBottom();

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

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [welinkSessionId]);

  useEffect(() => {
    if (scrollToBottomSignal <= 0) {
      return undefined;
    }

    scrollToBottom();

    const rafId = window.requestAnimationFrame(scrollToBottom);
    const timerId = window.setTimeout(scrollToBottom, 80);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [scrollToBottom, scrollToBottomSignal]);

  if (messages.length === 0) {
    return (
      <div className="content content--we-agent-cui">
        <div className="we-agent-cui-welcome">
          <div className="we-agent-cui-welcome__avatar-wrap" aria-hidden="true">
            <img src={welcomeAvatar} alt="" className="we-agent-cui-welcome__avatar" />
          </div>
          {welcomeTitle ? <div className="we-agent-cui-welcome__title">{welcomeTitle}</div> : null}
          {welcomeSubtitle ? <div className="we-agent-cui-welcome__subtitle">{welcomeSubtitle}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="content content--we-agent-cui"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="messages-container messages-container--we-agent-cui">
        {!isLoadingHistory && !hasMoreHistory && (
          <div className="history-status history-status--end">{t('weAgent.noMoreMessages')}</div>
        )}
        {messages.map((message) => (
          <div key={message.id} data-message-id={message.id}>
            <MessageBubble
              message={message}
              welinkSessionId={welinkSessionId}
              onQuestionAnswered={onQuestionAnswered}
              weAgentUserName={weAgentUserName}
              weAgentUserAvatar={weAgentUserAvatar}
              weAgentAssistantName={weAgentAssistantName}
              weAgentAssistantAvatar={weAgentAssistantAvatar}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
