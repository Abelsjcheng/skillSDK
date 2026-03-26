import React from 'react';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import { isPcMiniApp } from '../utils/hwext';

interface SwitchAssistantProps {
  defaultSelectedAssistantId?: string;
}

const SwitchAssistant: React.FC<SwitchAssistantProps> = ({
  defaultSelectedAssistantId,
}) => {
  const isPc = isPcMiniApp();

  return (
    <AssistantSelectionPage
      title="切换助理"
      isPcMiniApp={isPc}
      leftButtonText="取消选择"
      rightButtonText="确认切换"
      defaultSelectedAssistantId={defaultSelectedAssistantId}
    />
  );
};

export default SwitchAssistant;
