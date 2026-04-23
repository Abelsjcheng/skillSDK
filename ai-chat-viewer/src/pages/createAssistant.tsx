import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ensureLanguageInitialized } from '../i18n/config';
import { CreateAssistantPageRouter } from '../routes/CreateAssistantPageRouter';
import { WeLog } from '../utils/logger';
const rootElement = document.getElementById('root');

async function mountCreateAssistantPage(): Promise<void> {
  await ensureLanguageInitialized();

  if (!rootElement) {
    return;
  }

  const root = createRoot(rootElement);
  root.render(
    <HashRouter>
      <CreateAssistantPageRouter />
    </HashRouter>,
  );
}

void mountCreateAssistantPage().catch(error => {
  WeLog(`CreateAssistant mountCreateAssistantPage failed | error=${JSON.stringify(error)}`);
});
