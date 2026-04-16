import React from 'react';
import { useTranslation } from 'react-i18next';
import assistantAvatar from '../imgs/assistant-avatar.svg';
import generatingIcon from '../imgs/generating_icon.png';

interface PendingAssistantBubbleProps {
  startedAt: number;
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

export const PendingAssistantBubble: React.FC<PendingAssistantBubbleProps> = ({
  startedAt,
  weAgentAssistantName = '',
  weAgentAssistantAvatar = '',
}) => {
  const { t } = useTranslation();
  const assistantName = weAgentAssistantName.trim();
  const messageMetaText = `${assistantName} ${formatMessageTime(startedAt || Date.now())}`.trim();
  const resolvedAssistantAvatar = weAgentAssistantAvatar || assistantAvatar;

  return (
    <div className="message-block message-we-agent message-assistant">
      <div className="we-agent-message we-agent-message--assistant">
        <div className="we-agent-message__meta is-assistant">
          <img className="we-agent-message__avatar" src={resolvedAssistantAvatar} alt="" />
          <span className="we-agent-message__meta-text">{messageMetaText}</span>
        </div>
        <div className="we-agent-message__bubble is-assistant is-pending">
          <div className="message-content">
            <div className="we-agent-message__pending">
              <img className="we-agent-message__pending-icon" src={generatingIcon} alt="" />
              <span className="we-agent-message__pending-text">{t('pending.generating')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
