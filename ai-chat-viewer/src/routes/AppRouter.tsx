import React from 'react';
import { Navigate, Route, Routes } from 'react-router';
import App from '../App';
import PersonalAssistantCreator from '../components/PersonalAssistantCreator';

const CREATE_ASSISTANT_ROUTE_PAGE_STYLE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
};

export const AppRouter: React.FC = () => (
  <Routes>
    <Route path="/aiChat" element={<App />} />
    <Route
      path="/createAssistant"
      element={(
        <div style={CREATE_ASSISTANT_ROUTE_PAGE_STYLE}>
          <PersonalAssistantCreator />
        </div>
      )}
    />
    <Route path="/" element={<Navigate to="/aiChat" replace />} />
    <Route path="*" element={<Navigate to="/aiChat" replace />} />
  </Routes>
);
