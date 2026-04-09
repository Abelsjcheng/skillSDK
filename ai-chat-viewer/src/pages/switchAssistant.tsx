import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import { isPcMiniApp } from '../constants';
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
      showToast('获取助理列表失败');
      setAssistantList([]);
      setSelectedPartnerAccount('');
    }
  }, [partnerAccount, preferredDefaultPartnerAccount]);

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
      showToast('打开助理失败');
    }
  }, [assistantList, selectedPartnerAccount]);

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
      title="切换助理"
      isPcMiniApp={isPc}
      leftButtonText="取消选择"
      rightButtonText="确认切换"
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
