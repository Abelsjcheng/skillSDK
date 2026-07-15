import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AssistantDetail from './assistantDetail';
import type { WeAgentDetails } from '../types/bridge';

const AssistantDetailRoute: React.FC = () => {
  const navigate = useNavigate();

  const handleEditAssistant = useCallback((detail: WeAgentDetails | null) => {
    navigate(
      {
        pathname: '/editAssistant',
      },
      {
        state: {
          source: 'assistantDetail',
          detail,
        },
      },
    );
  }, [navigate]);

  return <AssistantDetail onEditAssistant={handleEditAssistant} />;
};

export default AssistantDetailRoute;
