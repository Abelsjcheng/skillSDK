import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const AIChatViewerModule = require('../../../dist/lib/index.js');
const AIChatViewerExport =
  AIChatViewerModule.default ||
  AIChatViewerModule.AIChatViewer ||
  AIChatViewerModule;

const AssistantDetail =
  AIChatViewerModule.AssistantDetail ||
  (AIChatViewerExport && AIChatViewerExport.AssistantDetail);

const SwitchAssistant =
  AIChatViewerModule.SwitchAssistant ||
  (AIChatViewerExport && AIChatViewerExport.SwitchAssistant);

const rootElement = document.getElementById('root');

const AssistantComponentsDemo: React.FC = () => {
  const [page, setPage] = useState<'detail' | 'switch'>('detail');

  if (!AssistantDetail || !SwitchAssistant) {
    return (
      <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
        组件导出不可用，请先执行 `npm run build:lib`
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '20px',
        boxSizing: 'border-box',
        background: '#f3f4f6',
      }}
    >
      <section
        style={{
          width: '500px',
          height: '560px',
          margin: '0 auto',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: '56px',
            minHeight: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            background: '#ffffff',
          }}
        >
          <button type="button" onClick={() => setPage('detail')}>
            AssistantDetail
          </button>
          <button type="button" onClick={() => setPage('switch')}>
            SwitchAssistant
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {page === 'detail' ? <AssistantDetail /> : <SwitchAssistant />}
        </div>
      </section>
    </main>
  );
};

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AssistantComponentsDemo />
    </React.StrictMode>,
  );
}
