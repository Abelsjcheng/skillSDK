import React from 'react';
import App from '../App';
import { getQueryParam } from '../utils/hwext';

const WeAgentCUI: React.FC = () => {
  const assistantAccount = getQueryParam('assistantAccount') ?? '';

  return (
    <App
      assistantAccount={assistantAccount}
    />
  );
};

export default WeAgentCUI;
