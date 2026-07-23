import React from 'react';
import AvatarImage from '../AvatarImage';
import defaultAvatar from '../../imgs/defaultAvatar.png';
import noSelectionIcon from '../../imgs/no_selection_icon.svg';
import selectionIcon from '../../imgs/selection_icon.svg';
import type { AssistantCardListProps } from '../../types/components';

const AssistantCardList: React.FC<AssistantCardListProps> = ({
  assistants,
  selectedAssistantId,
  onSelectAssistant,
}) => {
  const handleAssistantKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    assistantId: string,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onSelectAssistant(assistantId);
  };

  return (
    <div className="switch-assistant__list">
      {assistants.map((assistant) => (
        <article
          key={assistant.id}
          className={`switch-assistant__card${
            selectedAssistantId === assistant.id ? ' switch-assistant__card--selected' : ''
          }`}
          onClick={() => onSelectAssistant(assistant.id)}
          onKeyDown={(event) => handleAssistantKeyDown(event, assistant.id)}
          tabIndex={0}
          role="button"
          aria-pressed={selectedAssistantId === assistant.id}
        >
          <span className="switch-assistant__radio" aria-hidden="true">
            <img
              src={selectedAssistantId === assistant.id ? selectionIcon : noSelectionIcon}
              alt=""
              className="switch-assistant__radio-icon"
            />
          </span>
          <div className="switch-assistant__avatar">
            <AvatarImage
              src={assistant.icon}
              fallbackSrc={defaultAvatar}
              alt=""
              className="switch-assistant__avatar-img"
              aria-hidden="true"
              showOnlineStatus={true}
              isOnline={assistant.isOnline}
            />
          </div>
          <div className="switch-assistant__desc">
            <div className="switch-assistant__desc-row">
              <span className="switch-assistant__name">{assistant.name}</span>
              {assistant.tag ? <span className="switch-assistant__tag">{assistant.tag}</span> : null}
            </div>
            <p className="switch-assistant__summary">{assistant.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
};

export default AssistantCardList;
