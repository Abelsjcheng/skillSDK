import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ensureLanguageInitialized } from '../i18n/config';
import ActivateAssistant from '../pages/activateAssistant';
import AssistantDetail from '../pages/assistantDetail';
import CreateAssistantBasicPage from '../pages/createAssistantBasic';
import EditAssistant from '../pages/editAssistant';
import SelectAssistant from '../pages/selectAssistant';
import SelectBrainAssistantPage from '../pages/selectBrainAssistant';
import SwitchAssistant from '../pages/switchAssistant';
import WeAgentCUI from '../pages/weAgentCUI';

const FULL_PAGE_ROUTE_STYLE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
};

export const AppRouter: React.FC = () => {
  useEffect(() => {
    void ensureLanguageInitialized();
  }, []);

  return (
    <Routes>
      <Route path="/weAgentCUI" element={<WeAgentCUI />} />
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
        path="/editAssistant"
        element={(
          <div style={FULL_PAGE_ROUTE_STYLE}>
            <EditAssistant />
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
        path="/selectAssistant"
        element={(
          <div style={FULL_PAGE_ROUTE_STYLE}>
            <SelectAssistant />
          </div>
        )}
      />
      <Route path="/startAssistant" element={<Navigate to="/selectAssistant" replace />} />
      <Route path="/" element={<Navigate to="/weAgentCUI" replace />} />
      <Route path="*" element={<Navigate to="/weAgentCUI" replace />} />
    </Routes>
  );
};
