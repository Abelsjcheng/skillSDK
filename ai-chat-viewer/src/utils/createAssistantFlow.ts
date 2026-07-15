import { isPcMiniApp } from '../constants';
import type { CreateDigitalTwinResult } from '../types/bridge';
import { handleCreateForOtherScenePc } from './assistantPcHandle';
import { reportCoreFlowError } from './telemetry';

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
  const isPc = isPcMiniApp();

  try {
    if (isPc) {
      handleCreateForOtherScenePc(result);
      return;
    }

    (window as any).HWH5.openIMChat({
      chatID: partnerAccount,
    });
    window.HWH5.close();
  } catch (error) {
    void reportCoreFlowError('flow_host_bridge_error', '宿主桥接错误', error, {
      page: 'createAssistant',
      stage: 'handleCreateForOtherScene',
      bridgeMethod: isPc ? 'handleCreateForOtherScenePc' : 'openIMChat',
      partnerAccount,
      isPc,
    });
    throw error;
  }
}
