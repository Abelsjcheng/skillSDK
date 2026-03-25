import React, { useState } from 'react';
import switchAssistantAvatar from '../../imgs/switch-assistant-avatar.svg';
import '../../styles/SwitchAssistant.less';
import AssistantPageHeader from './AssistantPageHeader';

interface AssistantItem {
  id: string;
  name: string;
  tag: string;
  description: string;
}

interface AssistantSelectionPageProps {
  title: string;
  isPcMiniApp?: boolean;
  leftButtonText: string;
  rightButtonText: string;
  onLeftButtonClick?: () => void;
  onRightButtonClick?: () => void;
}

const ASSISTANT_LIST: AssistantItem[] = [
  { id: 'assistant-1', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
  { id: 'assistant-2', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
  { id: 'assistant-3', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
  { id: 'assistant-4', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
  { id: 'assistant-5', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
  { id: 'assistant-6', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
  { id: 'assistant-7', name: '编程助理', tag: '某某助手', description: '设计师一枚，擅长代码实现与技术方案整理' },
];

const noop = () => {};

const AssistantSelectionPage: React.FC<AssistantSelectionPageProps> = ({
  title,
  isPcMiniApp = false,
  leftButtonText,
  rightButtonText,
  onLeftButtonClick = noop,
  onRightButtonClick = noop,
}) => {
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');

  const handleSelectAssistant = (assistantId: string) => {
    setSelectedAssistantId(assistantId);
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
          {ASSISTANT_LIST.map((assistant) => (
            <article
              key={assistant.id}
              className={`switch-assistant__card${
                selectedAssistantId === assistant.id ? ' switch-assistant__card--selected' : ''
              }`}
              onClick={() => handleSelectAssistant(assistant.id)}
              onKeyDown={(event) => handleAssistantKeyDown(event, assistant.id)}
              tabIndex={0}
              role="button"
              aria-pressed={selectedAssistantId === assistant.id}
            >
              <div className="switch-assistant__avatar">
                <img src={switchAssistantAvatar} alt="" className="switch-assistant__avatar-img" aria-hidden="true" />
              </div>
              <div className="switch-assistant__desc">
                <div className="switch-assistant__desc-row">
                  <span className="switch-assistant__name">{assistant.name}</span>
                  <span className="switch-assistant__tag">{assistant.tag}</span>
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
        >
          {rightButtonText}
        </button>
      </footer>
    </div>
  );
};

export default AssistantSelectionPage;
