import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AssistantSelectionPage, { type AssistantItem } from '../components/assistant/AssistantSelectionPage';
import { resolveAssistantIconUrl } from '../components/createAssistant/constants';
import { dispatchSwitchAssistantCancelEvent, dispatchSwitchAssistantConfirmEvent } from '../utils/assistantHostBridge';
import { resolveAssistantTag } from '../utils/assistantTag';
import {
  buildCustomerServiceWebviewUri,
  buildOpenWeAgentCUIParams,
  getQueryParam,
  getWeAgentDetails,
  getWeAgentList,
  isPcMiniApp,
  MOCK_CUSTOMER_SERVICE_SOURCE_URL,
  openH5Webview,
  openWeAgentCUI,
  resolveRobotIdForOpenWeAgentCUI,
  resolveWeCodeUrlForOpenWeAgentCUI,
  type WeAgentListItem,
} from '../utils/hwext';
import { showToast } from '../utils/toast';

const DEFAULT_LIST_QUERY = {
  pageSize: 20,
  pageNumber: 1,
};
interface SwitchAssistantProps {
  defaultSelectedAssistantId?: string;
}

function toAssistantItems(list: WeAgentListItem[]): AssistantItem[] {
  return list.map((assistant) => ({
    id: assistant.partnerAccount,
    name: assistant.name ?? '',
    tag: resolveAssistantTag(assistant),
    description: assistant.description ?? '',
    icon: resolveAssistantIconUrl(assistant.icon),
  }));
}

const SwitchAssistant: React.FC<SwitchAssistantProps> = ({ defaultSelectedAssistantId }) => {
  const isPc = isPcMiniApp();
  const [assistantList, setAssistantList] = useState<WeAgentListItem[]>([]);
  const [selectedPartnerAccount, setSelectedPartnerAccount] = useState<string>('');

  const partnerAccount = useMemo(() => getQueryParam('partnerAccount') ?? '', []);
  const preferredDefaultPartnerAccount = useMemo(() => defaultSelectedAssistantId?.trim() ?? '', [defaultSelectedAssistantId]);
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
        if (preferredDefaultPartnerAccount && list.some((assistant) => assistant.partnerAccount === preferredDefaultPartnerAccount)) {
          return preferredDefaultPartnerAccount;
        }
        if (partnerAccount && list.some((assistant) => assistant.partnerAccount === partnerAccount)) {
          return partnerAccount;
        }
        return '';
      });
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
      const selectedAssistant = assistantList.find(
        (assistant) => assistant.partnerAccount === selectedPartnerAccount,
      );
      const detailResult = await getWeAgentDetails({ partnerAccount: selectedPartnerAccount });
      const detail = detailResult?.WeAgentDetailsArray?.[0];
      if (!detail) {
        console.warn('No we-agent detail found for partnerAccount:', selectedPartnerAccount);
        return;
      }
      const weCodeUrl = resolveWeCodeUrlForOpenWeAgentCUI(detail, selectedPartnerAccount);
      const robotId = resolveRobotIdForOpenWeAgentCUI({
        detailRobotId: detail.robotId,
        listRobotId: selectedAssistant?.robotId,
      });
      const params = buildOpenWeAgentCUIParams(weCodeUrl, selectedPartnerAccount, {
        bizRobotId: detail.bizRobotId,
        robotId,
      });
      await openWeAgentCUI(params);
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






