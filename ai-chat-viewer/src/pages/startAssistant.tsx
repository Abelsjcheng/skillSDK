import React, { useState } from 'react';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import switchAssistantAvatar from '../imgs/switch-assistant-avatar.svg';
import '../styles/StartAssistant.less';
import '../styles/SwitchAssistant.less';
import { isPcMiniApp } from '../utils/hwext';

interface AssistantItem {
  id: string;
  name: string;
  tag: string;
  description: string;
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

const StartAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');

  const handleCreateAssistant = () => {};
  const handleEnableNow = () => {};
  const handleAssistantKeyDown = (event: React.KeyboardEvent<HTMLElement>, assistantId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setSelectedAssistantId(assistantId);
  };

  if (!isPc) {
    return (
      <AssistantSelectionPage
        title="启动助理"
        isPcMiniApp={isPc}
        leftButtonText="创建助理"
        rightButtonText="立即启用"
        onLeftButtonClick={handleCreateAssistant}
        onRightButtonClick={handleEnableNow}
      />
    );
  }

  return (
    <div className="start-assistant--pc">
      <div className="start-assistant__panel">
        <header className="start-assistant__header">
          <h1 className="start-assistant__title">启用助理</h1>
        </header>

        <main className="start-assistant__content">
          <div className="switch-assistant__list">
            {ASSISTANT_LIST.map((assistant) => (
              <article
                key={assistant.id}
                className={`switch-assistant__card${
                  selectedAssistantId === assistant.id ? ' switch-assistant__card--selected' : ''
                }`}
                onClick={() => setSelectedAssistantId(assistant.id)}
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

        <footer className="start-assistant__actions">
          <button
            type="button"
            className="start-assistant__action-btn start-assistant__action-btn--create"
            onClick={handleCreateAssistant}
          >
            创建助理
          </button>
          <button
            type="button"
            className="start-assistant__action-btn start-assistant__action-btn--enable"
            onClick={handleEnableNow}
          >
            立即启用
          </button>
        </footer>
      </div>
    </div>
  );
};

export default StartAssistant;
