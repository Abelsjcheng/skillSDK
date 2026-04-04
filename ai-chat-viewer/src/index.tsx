import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './routes/AppRouter';
import { HashRouter } from './routes/HashRouter';
import { installOpencodeBridge } from './opencode/installOpencodeBridge';
import { installJsApiMock } from './mocks/installJsApiMock';

installOpencodeBridge();
installJsApiMock();

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <HashRouter>
      <AppRouter />
    </HashRouter>
  );
}
