import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import EditAssistantContent from '../components/assistant/EditAssistantContent';
import type { EditAssistantRouteState } from '../types/digitalTwin';
import { getQueryParam } from '../utils/hwext';

const EditAssistant: React.FC = () => {
  const location = useLocation();
  const routeState = location.state as EditAssistantRouteState | null;
  const querySource = useMemo(() => getQueryParam('source', location.search) ?? '', [location.search]);
  const source = routeState?.source === 'assistantDetail' || querySource === 'assistantDetail'
    ? 'assistantDetail'
    : 'external';
  const partnerAccount = useMemo(() => getQueryParam('partnerAccount', location.search) ?? '', [location.search]);
  const robotId = useMemo(() => getQueryParam('robotId', location.search) ?? '', [location.search]);

  return (
    <EditAssistantContent
      isPcMiniApp={false}
      source={source}
      initialDetail={routeState?.detail ?? null}
      partnerAccount={partnerAccount}
      robotId={robotId}
      onClose={() => {
        window.HWH5.navigateBack();
      }}
    />
  );
};

export default EditAssistant;
