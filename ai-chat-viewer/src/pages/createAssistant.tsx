import { createRoot } from 'react-dom/client';
import PersonalAssistantCreator from '../components/PersonalAssistantCreator';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<PersonalAssistantCreator />);
}
