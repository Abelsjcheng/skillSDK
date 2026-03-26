import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AssistantSelectionPage, { type AssistantItem } from '../components/assistant/AssistantSelectionPage';
import {
  buildOpenWeAgentCUIParams,
  getQueryParam,
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

const SwitchAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);
  const [selectedPartnerAccount, setSelectedPartnerAccount] = useState<string>('');

  const partnerAccount = useMemo(() => getQueryParam('partnerAccount') ?? '', []);
  const assistantItems = useMemo(() => toAssistantItems(assistantList), [assistantList]);

  const loadAssistantList = useCallback(async (): Promise<void> => {
    try {
      const result = await getWeAgentList(DEFAULT_LIST_QUERY);
      const list = result && Array.isArray(result.content) ? result.content : [];
      setAssistantList(list);
      setSelectedPartnerAccount((current) => {
        if (list.some((assistant) => assistant.partnerAccount === current)) {
          return current;
        }
        if (partnerAccount && list.some((assistant) => assistant.partnerAccount === partnerAccount)) {
          return partnerAccount;
        }
        return '';
      });
    } catch (error) {
      console.error('getWeAgentList failed in SwitchAssistant:', error);
      setAssistantList([]);
      setSelectedPartnerAccount('');
    }
  }, [partnerAccount]);

  useEffect(() => {
    void loadAssistantList();
  }, [loadAssistantList]);

  const handleCancelSelect = useCallback(() => {
    setSelectedPartnerAccount('');
  }, []);

  const handleConfirmSwitch = useCallback(async () => {
    if (!selectedPartnerAccount) return;

    try {
      const detailResult = await getWeAgentDetails({ partnerAccounts: [selectedPartnerAccount] });
      const detail = detailResult?.WeAgentDetailsArray?.[0];
      if (!detail) {
        console.warn('No we-agent detail found for partnerAccount:', selectedPartnerAccount);
        return;
      }
      const params = buildOpenWeAgentCUIParams(detail.weCodeUrl, selectedPartnerAccount);
      await openWeAgentCUI(params);
    } catch (error) {
      console.error('openWeAgentCUI failed in SwitchAssistant:', error);
    }
  }, [selectedPartnerAccount]);

  return (
    <AssistantSelectionPage
      title="切换助理"
      isPcMiniApp={isPc}
      leftButtonText="取消选择"
      rightButtonText="确认切换"
      onLeftButtonClick={handleCancelSelect}
      onRightButtonClick={handleConfirmSwitch}
      assistants={assistantItems}
      selectedAssistantId={selectedPartnerAccount}
      onSelectAssistant={setSelectedPartnerAccount}
      rightButtonDisabled={!selectedPartnerAccount}
    />
  );
};

export default SwitchAssistant;
