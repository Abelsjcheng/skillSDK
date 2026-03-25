import React from 'react';
import AssistantSelectionPage from '../components/assistant/AssistantSelectionPage';
import { isPcMiniApp } from '../utils/hwext';

const SwitchAssistant: React.FC = () => {
  const isPc = isPcMiniApp();
  const handleCancelSelect = () => {};
  const handleConfirmSwitch = () => {};

  return (
    <AssistantSelectionPage
      title="切换助理"
      isPcMiniApp={isPc}
      leftButtonText="取消选择"
      rightButtonText="确认切换"
      onLeftButtonClick={handleCancelSelect}
      onRightButtonClick={handleConfirmSwitch}
    />
  );
};

export default SwitchAssistant;
