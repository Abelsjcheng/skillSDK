import React from 'react';
import { Navigate, Route, Routes } from 'react-router';
import App from '../App';
import PersonalAssistantCreator from '../components/PersonalAssistantCreator';
import ActivateAssistant from '../pages/activateAssistant';
import AssistantDetail from '../pages/assistantDetail';
import StartAssistant from '../pages/startAssistant';
import SwitchAssistant from '../pages/switchAssistant';
import WeAgentCUI from '../pages/weAgentCUI';

const FULL_PAGE_ROUTE_STYLE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
};

export const AppRouter: React.FC = () => (
  <Routes>
    <Route path="/aiChat" element={<App />} />
    <Route path="/weAgentCUI" element={<WeAgentCUI />} />
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
    <Route
      path="/startAssistant"
      element={(
        <div style={FULL_PAGE_ROUTE_STYLE}>
          <StartAssistant />
        </div>
      )}
    />
    <Route path="/" element={<Navigate to="/weAgentCUI" replace />} />
    <Route path="*" element={<Navigate to="/weAgentCUI" replace />} />
  </Routes>
);
