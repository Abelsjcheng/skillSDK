import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { APP_ID, isPcMiniApp } from '../constants';
import activateGuideMobileEn from '../imgs/activate-guide-en.png';
import activateGuideMobile from '../imgs/activate-guide.png';
import activateGuidePcEn from '../imgs/activate-guide-pc-en.png';
import activateGuidePc from '../imgs/activate-guide-pc.png';
import type { WeAgentListItem } from '../types/bridge';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { getWeAgentList, openH5Webview, reportUemEvent } from '../utils/hwext';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';
import '../styles/ActivateAssistant.less';
import { openWeAgentDialogPc } from '../utils/assistantPcHandle';

const CREATE_ASSISTANT_URI = `h5://${APP_ID()}/index.html?from=weAgent#createAssistant`;
const SELECT_ASSISTANT_URI = `h5://${APP_ID()}/index.html?from=weAgent#selectAssistant`;
const DEFAULT_LIST_QUERY = {
  pageSize: 20,
  pageNumber: 1,
};

const ActivateAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.resolvedLanguage === 'en' || i18n.language === 'en';
  const activateGuideImage = isPc
    ? isEnglish
      ? activateGuidePcEn
      : activateGuidePc
    : isEnglish
      ? activateGuideMobileEn
      : activateGuideMobile;
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);

  const loadAssistantList = useCallback(async (): Promise<WeAgentListItem[]> => {
    try {
      const result = await getWeAgentList(DEFAULT_LIST_QUERY);
      const list = result && Array.isArray(result.content) ? result.content : [];
      setAssistantList(list);
      return list;
    } catch (error) {
      WeLog(`ActivateAssistant getWeAgentList failed | extra=${JSON.stringify(DEFAULT_LIST_QUERY)} | error=${JSON.stringify(error)}`);
      showToast(t('activateAssistant.loadFailed'));
      setAssistantList([]);
      return [];
    }
  }, [t]);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleSelectAssistant = useCallback(async () => {
    const latestList = assistantList.length > 0 ? assistantList : await loadAssistantList();
    if (isPc) {
      if (latestList.length > 0) {
        window.location.hash = '#selectAssistant';
      } else {
        openWeAgentDialogPc('weAgentPc')
      }
      return;
    }

    const targetUri = latestList.length === 0 ? CREATE_ASSISTANT_URI : SELECT_ASSISTANT_URI;
    openH5Webview({ uri: targetUri });
  }, [assistantList, isPc, loadAssistantList, navigate]);

  const reportSelectAssistantClick = useCallback(() => {
    void reportUemEvent('activate_select_assistant_click', '选择助理', {
      clientType: '',
      entry: 'WeAgent',
      operationTime: new Date().getTime(),
    });
  }, []);

  return (
    <div className={`activate-assistant ${isPc ? 'activate-assistant--pc' : 'activate-assistant--mobile'}`}>
      <div className="activate-assistant__center">
        <section className="activate-assistant__content">
          <div className="activate-assistant__carousel">
            <img src={activateGuideImage} alt={t('activateAssistant.guideAlt')} className="activate-assistant__image" draggable="false" />
          </div>
        </section>

        <section className="activate-assistant__actions">
          <button
            type="button"
            className="activate-assistant__enable-btn"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                reportSelectAssistantClick();
                void handleSelectAssistant();
              });
            }}
          >
            {t('activateAssistant.selectAssistant')}
          </button>
        </section>
      </div>
    </div>
  );
};

export default ActivateAssistant;
