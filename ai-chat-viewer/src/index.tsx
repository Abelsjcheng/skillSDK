import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './i18n/config';
import { AppRouter } from './routes/AppRouter';
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
