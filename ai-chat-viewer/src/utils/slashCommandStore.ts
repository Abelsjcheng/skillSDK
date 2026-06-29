import type { SlashCommandItem, SlashCommandStoreValue } from '../types/slashCommand';
import { normalizeSlashCommands } from './slashCommand';

const SLASH_COMMAND_TTL_MS = 10 * 60 * 1000;
const memoryStore = new Map<string, SlashCommandStoreValue>();

interface SlashCommandStoreOptions {
  partnerAccount: string;
  isPcMiniApp: boolean;
  ignoreExpiry?: boolean;
}

interface WriteSlashCommandStoreOptions {
  partnerAccount: string;
  isPcMiniApp: boolean;
  commands: SlashCommandItem[];
}

export function getSlashCommandStorageKey(partnerAccount: string): string {
  return `slash_commands:${partnerAccount.trim()}`;
}

function parseStorageData(data: unknown): SlashCommandStoreValue | null {
  const rawData = typeof data === 'string' ? JSON.parse(data) : data;
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const value = rawData as Partial<SlashCommandStoreValue>;
  if (typeof value.partnerAccount !== 'string' || typeof value.expiresAt !== 'number') {
    return null;
  }

  return {
    partnerAccount: value.partnerAccount,
    expiresAt: value.expiresAt,
    commands: normalizeSlashCommands(value.commands),
  };
}

function isStoreValueAvailable(value: SlashCommandStoreValue | null, ignoreExpiry?: boolean): value is SlashCommandStoreValue {
  if (!value || value.commands.length === 0) {
    return false;
  }
  return Boolean(ignoreExpiry) || value.expiresAt > Date.now();
}

async function readMobileStorage(key: string): Promise<unknown> {
  const getStorage = window.HWH5?.getStorage;
  if (typeof getStorage !== 'function') {
    return null;
  }
  const result = await Promise.resolve(getStorage(key));
  if (result && typeof result === 'object' && 'data' in result) {
    return (result as { data?: unknown }).data;
  }
  return result;
}

async function writeMobileStorage(key: string, value: SlashCommandStoreValue): Promise<void> {
  const setStorage = window.HWH5?.setStorage;
  if (typeof setStorage !== 'function') {
    return;
  }
  await Promise.resolve(setStorage({ key, data: JSON.stringify(value) }));
}

function readPcStorage(key: string): unknown {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage.getItem(key);
}

function writePcStorage(key: string, value: SlashCommandStoreValue): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function readSlashCommandStore(options: SlashCommandStoreOptions): Promise<SlashCommandItem[] | null> {
  const partnerAccount = options.partnerAccount.trim();
  if (!partnerAccount) {
    return null;
  }

  const key = getSlashCommandStorageKey(partnerAccount);
  const memoryValue = memoryStore.get(key) ?? null;
  if (isStoreValueAvailable(memoryValue, options.ignoreExpiry)) {
    return memoryValue.commands;
  }

  try {
    const rawData = options.isPcMiniApp ? readPcStorage(key) : await readMobileStorage(key);
    const value = parseStorageData(rawData);
    if (value?.partnerAccount === partnerAccount) {
      memoryStore.set(key, value);
    }
    return isStoreValueAvailable(value, options.ignoreExpiry) ? value.commands : null;
  } catch (_error) {
    return null;
  }
}

export async function writeSlashCommandStore(options: WriteSlashCommandStoreOptions): Promise<void> {
  const partnerAccount = options.partnerAccount.trim();
  const commands = normalizeSlashCommands(options.commands);
  if (!partnerAccount || commands.length === 0) {
    return;
  }

  const key = getSlashCommandStorageKey(partnerAccount);
  const value: SlashCommandStoreValue = {
    partnerAccount,
    expiresAt: Date.now() + SLASH_COMMAND_TTL_MS,
    commands,
  };

  memoryStore.set(key, value);

  try {
    if (options.isPcMiniApp) {
      writePcStorage(key, value);
      return;
    }
    await writeMobileStorage(key, value);
  } catch (_error) {
    // Memory store remains available for the current page lifecycle.
  }
}

export function clearSlashCommandMemoryStore(): void {
  memoryStore.clear();
}
