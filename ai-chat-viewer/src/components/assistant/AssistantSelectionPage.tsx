import React, { useMemo, useState } from 'react';
import '../../styles/SwitchAssistant.less';
import AssistantPageHeader from './AssistantPageHeader';

export interface AssistantItem {
  id: string;
  name: string;
  tag: string;
  description: string;
  icon?: string;
}

interface AssistantSelectionPageProps {
  title: string;
  isPcMiniApp?: boolean;
  leftButtonText: string;
  rightButtonText: string;
  onLeftButtonClick?: () => void;
  onRightButtonClick?: () => void;
  assistants?: AssistantItem[];
  selectedAssistantId?: string;
  onSelectAssistant?: (assistantId: string) => void;
  rightButtonDisabled?: boolean;
}

const EMPTY_ASSISTANT_LIST: AssistantItem[] = [];
const noop = () => {};

const AssistantSelectionPage: React.FC<AssistantSelectionPageProps> = ({
  title,
  isPcMiniApp = false,
  leftButtonText,
  rightButtonText,
  onLeftButtonClick = noop,
  onRightButtonClick = noop,
  assistants,
  selectedAssistantId,
  onSelectAssistant,
  rightButtonDisabled = false,
}) => {
  const [internalSelectedAssistantId, setInternalSelectedAssistantId] = useState<string>('');
  const isSelectionControlled = selectedAssistantId !== undefined;
  const currentSelectedAssistantId = isSelectionControlled ? selectedAssistantId : internalSelectedAssistantId;
  const assistantList = useMemo(() => assistants ?? EMPTY_ASSISTANT_LIST, [assistants]);

  const handleSelectAssistant = (assistantId: string) => {
    if (!isSelectionControlled) {
      setInternalSelectedAssistantId(assistantId);
    }
    onSelectAssistant?.(assistantId);
  };

  const handleAssistantKeyDown = (event: React.KeyboardEvent<HTMLElement>, assistantId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleSelectAssistant(assistantId);
  };

  return (
    <div className="switch-assistant">
      <AssistantPageHeader title={title} isPcMiniApp={isPcMiniApp} />

      <main className="switch-assistant__content">
        <div className="switch-assistant__list">
          {assistantList.map((assistant) => (
            <article
              key={assistant.id}
              className={`switch-assistant__card${
                currentSelectedAssistantId === assistant.id ? ' switch-assistant__card--selected' : ''
              }`}
              onClick={() => handleSelectAssistant(assistant.id)}
              onKeyDown={(event) => handleAssistantKeyDown(event, assistant.id)}
              tabIndex={0}
              role="button"
              aria-pressed={currentSelectedAssistantId === assistant.id}
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
      </main>

      <footer className="switch-assistant__actions">
        <button
          type="button"
          className="switch-assistant__action-btn switch-assistant__action-btn--cancel"
          onClick={onLeftButtonClick}
        >
          {leftButtonText}
        </button>
        <button
          type="button"
          className="switch-assistant__action-btn switch-assistant__action-btn--confirm"
          onClick={onRightButtonClick}
          disabled={rightButtonDisabled}
        >
          {rightButtonText}
        </button>
      </footer>
    </div>
  );
};

export default AssistantSelectionPage;
