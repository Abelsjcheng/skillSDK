import React from 'react';
import type { AssistantItem } from '../../types/assistant';

interface AssistantCardListProps {
  assistants: AssistantItem[];
  selectedAssistantId: string;
  onSelectAssistant: (assistantId: string) => void;
}

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
          <div className="switch-assistant__avatar">
            {assistant.icon ? (
              <img
                src={assistant.icon}
                alt=""
                className="switch-assistant__avatar-img"
                aria-hidden="true"
              />
            ) : null}
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
