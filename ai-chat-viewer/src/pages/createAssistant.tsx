import { createRoot } from 'react-dom/client';
import PersonalAssistantCreator from '../components/PersonalAssistantCreator';
import { ensureLanguageInitialized } from '../i18n/config';

const rootElement = document.getElementById('root');

async function mountCreateAssistantPage(): Promise<void> {
  await ensureLanguageInitialized();

  if (!rootElement) {
    return;
  }

  const root = createRoot(rootElement);
  root.render(<PersonalAssistantCreator />);
}

void mountCreateAssistantPage();
