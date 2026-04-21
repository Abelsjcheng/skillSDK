import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CreateAssistantBasicPage from '../pages/createAssistantBasic';
import SelectBrainAssistantPage from '../pages/selectBrainAssistant';

const FULL_PAGE_ROUTE_STYLE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
};

export const CreateAssistantPageRouter: React.FC = () => (
  <Routes>
    <Route
      path="/createAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <CreateAssistantBasicPage />
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
