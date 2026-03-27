import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import AssistantSelectionPage, { type AssistantItem } from '../components/assistant/AssistantSelectionPage';
import '../styles/StartAssistant.less';
import '../styles/SwitchAssistant.less';
import {
  buildOpenWeAgentCUIParams,
  getWeAgentDetails,
  getWeAgentList,
  isPcMiniApp,
  openWeAgentCUI,
  type WeAgentListItem,
} from '../utils/hwext';

const DEFAULT_LIST_QUERY = {
  pageSize: 20,
  pageNumber: 1,
};

function toAssistantItems(list: WeAgentListItem[]): AssistantItem[] {
  return list.map((assistant) => ({
    id: assistant.partnerAccount,
    name: assistant.name ?? '',
    tag: assistant.bizRobotName || assistant.bizRobotNameEn || '',
    description: assistant.description ?? '',
    icon: assistant.icon ?? '',
  }));
}

const StartAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');

  const assistantItems = useMemo(() => toAssistantItems(assistantList), [assistantList]);

  const loadAssistantList = useCallback(async (): Promise<void> => {
    try {
      const result = await getWeAgentList(DEFAULT_LIST_QUERY);
      const list = result && Array.isArray(result.content) ? result.content : [];
      setAssistantList(list);
      setSelectedAssistantId((current) => (
        list.some((assistant) => assistant.partnerAccount === current) ? current : ''
      ));
    } catch (error) {
      console.error('getWeAgentList failed in StartAssistant:', error);
      setAssistantList([]);
      setSelectedAssistantId('');
    }
  }, []);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleCreateAssistant = useCallback(() => {
    navigate('/createAssistant?from=weAgent');
  }, [navigate]);

  const handleEnableNow = useCallback(async () => {
    if (!selectedAssistantId) return;

    try {
      const detailResult = await getWeAgentDetails({ partnerAccount: selectedAssistantId });
      const detail = detailResult?.WeAgentDetailsArray?.[0];
      if (!detail) {
        console.warn('No we-agent detail found for partnerAccount:', selectedAssistantId);
        return;
      }
      const params = buildOpenWeAgentCUIParams(detail.weCodeUrl, selectedAssistantId);
      await openWeAgentCUI(params);
    } catch (error) {
      console.error('openWeAgentCUI failed in StartAssistant:', error);
    }
  }, [selectedAssistantId]);

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
        assistants={assistantItems}
        selectedAssistantId={selectedAssistantId}
        onSelectAssistant={setSelectedAssistantId}
        rightButtonDisabled={!selectedAssistantId}
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
            {assistantItems.map((assistant) => (
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
            disabled={!selectedAssistantId}
          >
            立即启用
          </button>
        </footer>
      </div>
    </div>
  );
};

export default StartAssistant;
