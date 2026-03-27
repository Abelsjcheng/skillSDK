import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './routes/AppRouter';
import { HashRouter } from './routes/HashRouter';
import { installJsApiMock } from './mocks/installJsApiMock';

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
