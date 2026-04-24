import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import AssistantCardList from '../components/assistant/AssistantCardList';
import { isPcMiniApp } from '../constants';
import type { WeAgentListItem } from '../types/bridge';
import type { AssistantItem } from '../types/assistant';
import '../styles/StartAssistant.less';
import '../styles/SwitchAssistant.less';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import {
  DEFAULT_ASSISTANT_LIST_QUERY,
  mapWeAgentListToAssistantItems,
  openAssistantByPartnerAccount,
  resolveSelectableAssistantId,
} from '../utils/assistantSelection';
import { WeLog } from '../utils/logger';
import {
  CUSTOMER_SERVICE_WEBVIEW_URI,
  getWeAgentList,
  openH5Webview,
} from '../utils/hwext';
import { showToast } from '../utils/toast';
import { handleServiceClickPc, openWeAgentDialogPc } from '../utils/assistantPcHandle';

const CREATE_ASSISTANT_ROUTE = '/createAssistant';

function buildCreateAssistantSearch(): string {
  const params = new URLSearchParams();
  params.set('from', 'weAgent');
  params.set('_ts', String(Date.now()));
  return `?${params.toString()}`;
}

const SelectAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');

  const assistantItems = useMemo<AssistantItem[]>(
    () => mapWeAgentListToAssistantItems(assistantList),
    [assistantList],
  );

  const loadAssistantList = useCallback(async (): Promise<void> => {
    try {
      const result = await getWeAgentList(DEFAULT_ASSISTANT_LIST_QUERY);
      const list = result && Array.isArray(result.content) ? result.content : [];
      setAssistantList(list);
      setSelectedAssistantId((current) => resolveSelectableAssistantId(list, current));
    } catch (error) {
      WeLog(`SelectAssistant getWeAgentList failed | extra=${JSON.stringify(DEFAULT_ASSISTANT_LIST_QUERY)} | error=${JSON.stringify(error)}`);
      showToast(t('selectAssistant.loadFailed'));
      setAssistantList([]);
      setSelectedAssistantId('');
    }
  }, [t]);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleCreateAssistant = useCallback(() => {
    if (isPc) {
      openWeAgentDialogPc("weAgentPc");
    }
    const search = buildCreateAssistantSearch();
    const targetHash = `#${CREATE_ASSISTANT_ROUTE}${search}`;

    navigate({
      pathname: CREATE_ASSISTANT_ROUTE,
      search,
    });

    window.setTimeout(() => {
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      window.location.reload();
    }, 0);
  }, [navigate]);

  const handleEnableNow = useCallback(async () => {
    if (!selectedAssistantId) return;

    try {
      const opened = await openAssistantByPartnerAccount(assistantList, selectedAssistantId);
      if (!opened) {
        return;
      }
      window.HWH5.close();
    } catch (error) {
      WeLog(`SelectAssistant openWeAgentCUI failed | extra=${JSON.stringify({ selectedAssistantId })} | error=${JSON.stringify(error)}`);
      showToast(t('selectAssistant.openFailed'));
    }
  }, [assistantList, selectedAssistantId, t]);

  const handleServiceClick = useCallback(() => {
    if (isPc) {
      handleServiceClickPc();
      return;
    }
    openH5Webview({
      uri: CUSTOMER_SERVICE_WEBVIEW_URI,
    });
  }, []);

  if (!isPc) {
    return (
      <AssistantSelectionPage
        title={t('selectAssistant.title')}
        isPcMiniApp={isPc}
        leftButtonText={t('selectAssistant.createAssistant')}
        rightButtonText={t('selectAssistant.startUsing')}
        onLeftButtonClick={handleCreateAssistant}
        onRightButtonClick={handleEnableNow}
        onService={handleServiceClick}
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
          <h1 className="start-assistant__title">{t('selectAssistant.title')}</h1>
        </header>

        <main className="start-assistant__content">
          <AssistantCardList
            assistants={assistantItems}
            selectedAssistantId={selectedAssistantId}
            onSelectAssistant={setSelectedAssistantId}
          />
        </main>

        <footer className="start-assistant__actions">
          <button
            type="button"
            className="start-assistant__action-btn start-assistant__action-btn--create"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                handleCreateAssistant();
              });
            }}
          >
            {t('selectAssistant.createAssistant')}
          </button>
          <button
            type="button"
            className="start-assistant__action-btn start-assistant__action-btn--enable"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleEnableNow();
              });
            }}
            disabled={!selectedAssistantId}
          >
            {t('selectAssistant.startUsing')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SelectAssistant;
