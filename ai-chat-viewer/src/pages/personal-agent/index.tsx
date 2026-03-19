import React from 'react';
import { createRoot } from 'react-dom/client';
import PersonalAgentCreator from '../../components/PersonalAgentCreator';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <PersonalAgentCreator />
    </React.StrictMode>,
  );
}
