import React from 'react';
import { Navigate, Route, Routes } from 'react-router';
import App from '../App';
import PersonalAssistantCreator from '../components/PersonalAssistantCreator';
import ActivateAssistant from '../pages/activateAssistant';
import AssistantDetail from '../pages/assistantDetail';
import SwitchAssistant from '../pages/switchAssistant';

const FULL_PAGE_ROUTE_STYLE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
};

export const AppRouter: React.FC = () => (
  <Routes>
    <Route path="/aiChat" element={<App />} />
    <Route
      path="/createAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <PersonalAssistantCreator />
        </div>
      )}
    />
    <Route
      path="/activateAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <ActivateAssistant />
        </div>
      )}
    />
    <Route
      path="/assistantDetail"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <AssistantDetail />
        </div>
      )}
    />
    <Route
      path="/switchAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <SwitchAssistant />
        </div>
      )}
    />
    <Route path="/" element={<Navigate to="/aiChat" replace />} />
    <Route path="*" element={<Navigate to="/aiChat" replace />} />
  </Routes>
);
