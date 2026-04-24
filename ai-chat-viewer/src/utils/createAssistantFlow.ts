import { isPcMiniApp } from '../constants';
import type { CreateDigitalTwinResult } from '../types/bridge';

export function resolvePartnerAccount(result: CreateDigitalTwinResult): string {
  const value = result?.partnerAccount;
  return typeof value === 'string' ? value.trim() : '';
}

export function closeCreateAssistantWindow(): void {
  if (typeof window !== 'undefined' && (window as any).Pedestal?.remote?.getCurrentWindow) {
    (window as any).Pedestal.remote.getCurrentWindow().close();
  }
}

export async function handleCreateForOtherScene(result: CreateDigitalTwinResult): Promise<void> {
  const partnerAccount = resolvePartnerAccount(result);

  if (isPcMiniApp()) {
    await (window as any)?.Pedestal?.callMethod?.('method://agentSkills/handleSdk', {
      owner: partnerAccount,
    });
    closeCreateAssistantWindow();
    return;
  }

  (window as any).HWH5.openIMChat({
    chatID: partnerAccount,
  });
  window.HWH5.close();
}
