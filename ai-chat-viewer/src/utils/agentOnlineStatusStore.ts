/**
 * 助手在线状态存储模块
 * 参考 slashCommandStore.ts 模式：memoryStore + 持久化存储
 */

import { readFromStore, writeToStore } from './storage';

export interface AgentOnlineStatusData {
  statuses: Record<string, boolean>; // { [partnerAccount]: isOnline }
}

const STORAGE_KEY = 'agent_online_status';
const memoryStore = new Map<string, AgentOnlineStatusData>();

export async function readAgentOnlineStatusStore(): Promise<AgentOnlineStatusData | null> {
  return readFromStore<AgentOnlineStatusData>(STORAGE_KEY, memoryStore, ['statuses']);
}

export function writeAgentOnlineStatusStore(data: AgentOnlineStatusData): void {
  writeToStore(STORAGE_KEY, data, memoryStore);
}

export function getAgentOnlineStatusFromMemory(): AgentOnlineStatusData | null {
  return memoryStore.get(STORAGE_KEY) ?? null;
}

export function clearAgentOnlineStatusMemoryStore(): void {
  memoryStore.clear();
}
