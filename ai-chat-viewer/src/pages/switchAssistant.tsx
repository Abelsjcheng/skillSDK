import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import { isPcMiniApp } from '../constants';
import { ensureLanguageInitialized } from '../i18n/config';
import { dispatchSwitchAssistantCancelEvent, dispatchSwitchAssistantConfirmEvent } from '../utils/assistantHostBridge';
import {
  DEFAULT_ASSISTANT_LIST_QUERY,
  mapWeAgentListToAssistantItems,
  openAssistantByPartnerAccount,
  resolveSelectableAssistantId,
} from '../utils/assistantSelection';
import {
  buildCustomerServiceWebviewUri,
  getQueryParam,
  getWeAgentList,
  MOCK_CUSTOMER_SERVICE_SOURCE_URL,
  openH5Webview,
  type WeAgentListItem,
} from '../utils/hwext';
import { showToast } from '../utils/toast';

interface SwitchAssistantProps {
  defaultSelectedAssistantId?: string;
}

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
      console.error('getWeAgentList failed in SwitchAssistant:', error);
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
      console.error('openWeAgentCUI failed in SwitchAssistant:', error);
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

  const handleRightButtonClick = useCallback(() => {
    if (!selectedPartnerAccount) return;

    if (isPc) {
      dispatchSwitchAssistantConfirmEvent(selectedPartnerAccount);
      return;
    }

    void handleConfirmSwitch();
  }, [handleConfirmSwitch, isPc, selectedPartnerAccount]);

  const handleServiceClick = useCallback(() => {
    openH5Webview({
      uri: buildCustomerServiceWebviewUri(MOCK_CUSTOMER_SERVICE_SOURCE_URL),
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
