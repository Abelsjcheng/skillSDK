import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import activateGuide1 from '../imgs/activate-guide-1.svg';
import { getWeAgentList, isPcMiniApp, openH5Webview, type WeAgentListItem } from '../utils/hwext';
import '../styles/ActivateAssistant.less';

const CREATE_ASSISTANT_URI = 'h5://123456/html/index.html?from=weAgent#createAssistant';
const START_ASSISTANT_URI = 'h5://123456/html/index.html?from=weAgent#startAssistant';
const DEFAULT_LIST_QUERY = {
  pageSize: 20,
  pageNumber: 1,
};

const ActivateAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);

  const loadAssistantList = useCallback(async (): Promise<WeAgentListItem[]> => {
    try {
      const result = await getWeAgentList(DEFAULT_LIST_QUERY);
      const list = result && Array.isArray(result.content) ? result.content : [];
      setAssistantList(list);
      return list;
    } catch (error) {
      console.error('getWeAgentList failed in ActivateAssistant:', error);
      setAssistantList([]);
      return [];
    }
  }, []);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleSelectAssistant = useCallback(async () => {
    const latestList = assistantList.length > 0 ? assistantList : await loadAssistantList();
    if (isPc) {
      if (latestList.length > 0) {
        navigate('/startAssistant');
      }
      return;
    }

    const targetUri = latestList.length === 0 ? CREATE_ASSISTANT_URI : START_ASSISTANT_URI;
    openH5Webview({ uri: targetUri });
  }, [assistantList, isPc, loadAssistantList, navigate]);

  return (
    <div className="activate-assistant">
      <section className="activate-assistant__content">
        <div className="activate-assistant__carousel">
          <img src={activateGuide1} alt="激活助理引导图" className="activate-assistant__image" />
        </div>
      </section>

      <section className="activate-assistant__actions">
        <button type="button" className="activate-assistant__enable-btn" onClick={handleSelectAssistant}>
          选择助理
        </button>
      </section>
    </div>
  );
};

export default ActivateAssistant;
