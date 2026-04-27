import React from 'react';
import App from '../App';
import { useLocation } from 'react-router-dom';
import { getQueryParam } from '../utils/hwext';

const WeAgentCUI: React.FC = () => {
  const location = useLocation()
  const assistantAccount = getQueryParam('assistantAccount', location.search) ?? '';

  return (
    <App
      key={assistantAccount || 'default-assitant'}
      assistantAccount={assistantAccount}
    />
  );
};

export default WeAgentCUI;
