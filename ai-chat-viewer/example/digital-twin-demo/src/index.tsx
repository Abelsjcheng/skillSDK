import React from 'react';
import { createRoot } from 'react-dom/client';
import { DigitalTwinCreator } from '../../../src/components/DigitalTwinCreator';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <main
        style={{
          minHeight: '100vh',
          background: '#f3f4f6',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <section
          style={{
            width: '500px',
            height: '490px',
            margin: '0 auto',
            background: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <DigitalTwinCreator />
        </section>
      </main>
    </React.StrictMode>,
  );
}

