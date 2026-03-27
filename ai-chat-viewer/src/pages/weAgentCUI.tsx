import React from 'react';
import App from '../App';
import { getQueryParam } from '../utils/hwext';

const WeAgentCUI: React.FC = () => {
  const assistantAccount = getQueryParam('assistantAccount') ?? '';

  return (
    <App
      variant="weAgentCUI"
      assistantAccount={assistantAccount}
    />
  );
};

export default WeAgentCUI;
