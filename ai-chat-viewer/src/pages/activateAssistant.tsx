import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import activateGuideMobile from '../imgs/activate-guide.png';
import activateGuidePc from '../imgs/activate-guide-pc.png';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { getWeAgentList, isPcMiniApp, openH5Webview, type WeAgentListItem } from '../utils/hwext';
import '../styles/ActivateAssistant.less';
import { APP_ID } from '../constants';

const CREATE_ASSISTANT_URI = `h5://${APP_ID}/index.html?from=weAgent#createAssistant`;
const SELECT_ASSISTANT_URI = `h5://${APP_ID}/index.html?from=weAgent#selectAssistant`;
const DEFAULT_LIST_QUERY = {
  pageSize: 20,
  pageNumber: 1,
};

const ActivateAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const activateGuideImage = isPc ? activateGuidePc : activateGuideMobile;
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
        navigate('/selectAssistant');
      }
      return;
    }

    const targetUri = latestList.length === 0 ? CREATE_ASSISTANT_URI : SELECT_ASSISTANT_URI;
    openH5Webview({ uri: targetUri });
  }, [assistantList, isPc, loadAssistantList, navigate]);

  return (
    <div className={`activate-assistant ${isPc ? 'activate-assistant--pc' : 'activate-assistant--mobile'}`}>
      <div className="activate-assistant__center">
        <section className="activate-assistant__content">
          <div className="activate-assistant__carousel">
            <img src={activateGuideImage} alt="激活助理引导图" className="activate-assistant__image" />
          </div>
        </section>

        <section className="activate-assistant__actions">
          <button
            type="button"
            className="activate-assistant__enable-btn"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleSelectAssistant();
              });
            }}
          >
            选择助理
          </button>
        </section>
      </div>
    </div>
  );
};

export default ActivateAssistant;
