import React, { useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import CreateAssistantBasicPage from '../pages/createAssistantBasic';
import SelectBrainAssistantPage from '../pages/selectBrainAssistant';
import { isPcMiniApp } from '../constants';
import { getQueryParam } from '../utils/hwext';

const FULL_PAGE_ROUTE_STYLE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
};

const CreateAssistantBasicRoute: React.FC = () => {
  const location = useLocation();
  const isPc = isPcMiniApp();
  const qrcode = useMemo(() => getQueryParam('qrcode', location.search) ?? '', [location.search]);
  const pageKey = isPc ? (qrcode || 'defalut') : 'createAssistant';

  return <CreateAssistantBasicPage key={pageKey} />;
};

export const CreateAssistantPageRouter: React.FC = () => (
  <Routes>
    <Route
      path="/createAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <CreateAssistantBasicRoute />
        </div>
      )}
    />
    <Route
      path="/selectBrainAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <SelectBrainAssistantPage />
        </div>
      )}
    />
    <Route path="/" element={<Navigate to="/createAssistant" replace />} />
    <Route path="*" element={<Navigate to="/createAssistant" replace />} />
  </Routes>
);
