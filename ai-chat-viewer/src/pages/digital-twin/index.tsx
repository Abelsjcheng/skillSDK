import React from 'react';
import { createRoot } from 'react-dom/client';
import DigitalTwinCreator from '../../components/DigitalTwinCreator';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<DigitalTwinCreator />);
}
