import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import { isPcMiniApp } from '../constants';
import { ensureLanguageInitialized } from '../i18n/config';
import type { WeAgentListItem } from '../types/bridge';
import type { SwitchAssistantProps } from '../types/pages';
import { dispatchSwitchAssistantConfirmEvent } from '../utils/assistantHostBridge';
import {
  DEFAULT_ASSISTANT_LIST_QUERY,
  mapWeAgentListToAssistantItems,
  openAssistantByPartnerAccount,
  resolveSelectableAssistantId,
} from '../utils/assistantSelection';
import { WeLog } from '../utils/logger';
import { reportCoreFlowError } from '../utils/telemetry';
import {
  CUSTOMER_SERVICE_WEBVIEW_URI,
  getQueryParam,
  getWeAgentDetails,
  getWeAgentList,
  openH5Webview,
} from '../utils/hwext';
import { showToast } from '../utils/toast';
import { handleServiceClickPc } from '../utils/assistantPcHandle';
import { reportSwitchAssistantClick } from '../utils/uemUtil';

const SwitchAssistant: React.FC<SwitchAssistantProps> = ({ defaultSelectedAssistantId }) => {
  const isPc = isPcMiniApp();
  const { t, i18n } = useTranslation();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);
  const [selectedPartnerAccount, setSelectedPartnerAccount] = useState<string>('');

  const partnerAccount = useMemo(() => getQueryParam('partnerAccount') ?? '', []);
  const preferredDefaultPartnerAccount = useMemo(
    () => defaultSelectedAssistantId?.trim() ?? '',
    [defaultSelectedAssistantId],
  );
  const assistantItems = useMemo(
    () => mapWeAgentListToAssistantItems(assistantList, i18n.resolvedLanguage ?? i18n.language),
    [assistantList, i18n.language, i18n.resolvedLanguage],
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
        void reportCoreFlowError(
          'flow_open_weagent_error',
          '打开 WeAgentCUI 失败',
          new Error('openAssistantByPartnerAccount returned false'),
          {
            page: 'switchAssistant',
            stage: 'openAssistantByPartnerAccount',
            selectedPartnerAccount,
            isPc,
          },
        );
        return;
      }
      window.HWH5.close();
    } catch (error) {
      WeLog(`SwitchAssistant openWeAgentCUI failed | extra=${JSON.stringify({ selectedPartnerAccount })} | error=${JSON.stringify(error)}`);
      void reportCoreFlowError('flow_open_weagent_error', '打开 WeAgentCUI 失败', error, {
        page: 'switchAssistant',
        stage: 'openAssistantByPartnerAccount',
        selectedPartnerAccount,
        isPc,
      });
      showToast(t('switchAssistant.openFailed'));
    }
  }, [assistantList, isPc, selectedPartnerAccount, t]);

  const handleRightButtonClick = useCallback(async () => {
    reportSwitchAssistantClick();

    if (!selectedPartnerAccount) return;

    if (isPc) {
      try {
        await getWeAgentDetails({ partnerAccounts: [selectedPartnerAccount] });
        dispatchSwitchAssistantConfirmEvent(selectedPartnerAccount);
      } catch (error) {
        void reportCoreFlowError('flow_open_weagent_error', '打开 WeAgentCUI 失败', error, {
          page: 'switchAssistant',
          stage: 'getWeAgentDetailsBeforePcSwitch',
          selectedPartnerAccount,
          isPc,
        });
        dispatchSwitchAssistantConfirmEvent({});
      }
      return;
    }

    void handleConfirmSwitch();
  }, [handleConfirmSwitch, isPc, selectedPartnerAccount]);

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
      rightButtonText={t('switchAssistant.confirmSwitch')}
      defaultSelectedAssistantId={preferredDefaultPartnerAccount}
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
