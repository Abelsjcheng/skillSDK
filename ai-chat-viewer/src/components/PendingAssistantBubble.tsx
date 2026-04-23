import React from 'react';
import { useTranslation } from 'react-i18next';
import defaultAvatar from '../imgs/defaultAvatar.png';
import generatingIcon from '../imgs/generating_icon.png';
import type { PendingAssistantBubbleProps } from '../types/components';
import AvatarImage from './AvatarImage';

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

  return (
    <div className="message-block message-we-agent message-assistant">
      <div className="we-agent-message we-agent-message--assistant">
        <div className="we-agent-message__meta is-assistant">
          <AvatarImage
            className="we-agent-message__avatar"
            src={weAgentAssistantAvatar}
            fallbackSrc={defaultAvatar}
            alt=""
          />
          <span className="we-agent-message__meta-text">{messageMetaText}</span>
        </div>
        <div className="we-agent-message__bubble is-assistant is-pending">
          <div className="message-content">
            <div className="we-agent-message__pending">
              <img className="we-agent-message__pending-icon" src={generatingIcon} alt="" draggable="false" />
              <span className="we-agent-message__pending-text">{t('pending.generating')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
