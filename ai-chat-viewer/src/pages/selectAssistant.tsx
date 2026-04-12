import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import AssistantCardList from '../components/assistant/AssistantCardList';
import { isPcMiniApp } from '../constants';
import { useI18n } from '../i18n';
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
import {
  buildCustomerServiceWebviewUri,
  getWeAgentList,
  MOCK_CUSTOMER_SERVICE_SOURCE_URL,
  openH5Webview,
  type WeAgentListItem,
} from '../utils/hwext';
import { showToast } from '../utils/toast';

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
  const { t } = useI18n();
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
      console.error('getWeAgentList failed in SelectAssistant:', error);
      showToast(t('selectAssistant.loadFailed'));
      setAssistantList([]);
      setSelectedAssistantId('');
    }
  }, [t]);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleCreateAssistant = useCallback(() => {
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
      console.error('openWeAgentCUI failed in SelectAssistant:', error);
      showToast(t('selectAssistant.openFailed'));
    }
  }, [assistantList, selectedAssistantId, t]);

  const handleServiceClick = useCallback(() => {
    openH5Webview({
      uri: buildCustomerServiceWebviewUri(MOCK_CUSTOMER_SERVICE_SOURCE_URL),
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
