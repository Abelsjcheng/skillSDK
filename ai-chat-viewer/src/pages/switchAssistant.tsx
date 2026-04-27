import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import { isPcMiniApp } from '../constants';
import { ensureLanguageInitialized } from '../i18n/config';
import type { WeAgentListItem } from '../types/bridge';
import type { SwitchAssistantProps } from '../types/pages';
import { dispatchSwitchAssistantCancelEvent, dispatchSwitchAssistantConfirmEvent } from '../utils/assistantHostBridge';
import {
  DEFAULT_ASSISTANT_LIST_QUERY,
  mapWeAgentListToAssistantItems,
  openAssistantByPartnerAccount,
  resolveSelectableAssistantId,
} from '../utils/assistantSelection';
import { WeLog } from '../utils/logger';
import {
  CUSTOMER_SERVICE_WEBVIEW_URI,
  getQueryParam,
  getWeAgentDetails,
  getWeAgentList,
  openH5Webview,
  reportUemEvent,
} from '../utils/hwext';
import { showToast } from '../utils/toast';
import { handleServiceClickPc } from '../utils/assistantPcHandle';

const SwitchAssistant: React.FC<SwitchAssistantProps> = ({ defaultSelectedAssistantId }) => {
  const isPc = isPcMiniApp();
  const { t } = useTranslation();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);
  const [selectedPartnerAccount, setSelectedPartnerAccount] = useState<string>('');

  const partnerAccount = useMemo(() => getQueryParam('partnerAccount') ?? '', []);
  const preferredDefaultPartnerAccount = useMemo(
    () => defaultSelectedAssistantId?.trim() ?? '',
    [defaultSelectedAssistantId],
  );
  const assistantItems = useMemo(
    () => mapWeAgentListToAssistantItems(assistantList),
    [assistantList],
  );

  useEffect(() => {
    void ensureLanguageInitialized();
  }, []);

  const loadAssistantList = useCallback(async (): Promise<void> => {
    try {
      const result = await getWeAgentList(DEFAULT_ASSISTANT_LIST_QUERY);
      const list = result && Array.isArray(result.content) ? result.content : [];
      setAssistantList(list);
      setSelectedPartnerAccount((current) => resolveSelectableAssistantId(
        list,
        current,
        preferredDefaultPartnerAccount,
        partnerAccount,
      ));
    } catch (error) {
      WeLog(`SwitchAssistant getWeAgentList failed | extra=${JSON.stringify(DEFAULT_ASSISTANT_LIST_QUERY)} | error=${JSON.stringify(error)}`);
      showToast(t('switchAssistant.loadFailed'));
      setAssistantList([]);
      setSelectedPartnerAccount('');
    }
  }, [partnerAccount, preferredDefaultPartnerAccount, t]);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleConfirmSwitch = useCallback(async () => {
    if (!selectedPartnerAccount) return;

    try {
      const opened = await openAssistantByPartnerAccount(assistantList, selectedPartnerAccount);
      if (!opened) {
        return;
      }
      window.HWH5.close();
    } catch (error) {
      WeLog(`SwitchAssistant openWeAgentCUI failed | extra=${JSON.stringify({ selectedPartnerAccount })} | error=${JSON.stringify(error)}`);
      showToast(t('switchAssistant.openFailed'));
    }
  }, [assistantList, selectedPartnerAccount, t]);

  const handleLeftButtonClick = useCallback(() => {
    if (isPc) {
      dispatchSwitchAssistantCancelEvent(selectedPartnerAccount);
      setSelectedPartnerAccount('');
      return;
    }
    window.HWH5.close();
  }, [isPc, selectedPartnerAccount]);

  const handleRightButtonClick = useCallback(async () => {
    void reportUemEvent('switch_assistant_confirm_click', '确认切换', {
      clientType: '',
      entry: 'WeAgent',
      operationTime: new Date().getTime(),
    }).catch((error) => {
      WeLog(`SwitchAssistant reportUemEvent failed | extra=${JSON.stringify({
        eventId: 'switch_assistant_confirm_click',
      })} | error=${JSON.stringify(error)}`);
    });

    if (!selectedPartnerAccount) return;

    if (isPc) {
      try {
        const detailResult = await getWeAgentDetails({ partnerAccounts: [selectedPartnerAccount] });
        const detail = detailResult?.weAgentDetailsArray?.[0];
        dispatchSwitchAssistantConfirmEvent(selectedPartnerAccount);
      } catch (error) {
        dispatchSwitchAssistantConfirmEvent({});
      }
      return;
    }

    void handleConfirmSwitch();
  }, [assistantList.length, handleConfirmSwitch, isPc, partnerAccount, selectedPartnerAccount]);

  const handleServiceClick = useCallback(() => {
    if (isPc) {
      handleServiceClickPc();
      return;
    }
    openH5Webview({
      uri: CUSTOMER_SERVICE_WEBVIEW_URI,
    });
  }, []);

  return (
    <AssistantSelectionPage
      title={t('switchAssistant.title')}
      isPcMiniApp={isPc}
      leftButtonText={t('switchAssistant.cancelSelect')}
      rightButtonText={t('switchAssistant.confirmSwitch')}
      defaultSelectedAssistantId={preferredDefaultPartnerAccount}
      onLeftButtonClick={handleLeftButtonClick}
      onRightButtonClick={handleRightButtonClick}
      onService={handleServiceClick}
      assistants={assistantItems}
      selectedAssistantId={selectedPartnerAccount}
      onSelectAssistant={setSelectedPartnerAccount}
      rightButtonDisabled={!selectedPartnerAccount}
    />
  );
};

export default SwitchAssistant;
