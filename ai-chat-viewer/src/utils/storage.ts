/**
 * 持久化存储工具
 * 参考 slashCommandStore.ts 模式：PC: localStorage, Mobile: HWH5.getStorage/setStorage
 */

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

function writeMobileStorage(key: string, value: unknown): void {
  const setStorage = window.HWH5?.setStorage;
  if (typeof setStorage !== 'function') {
    return;
  }
  void Promise.resolve(setStorage({ key, data: JSON.stringify(value) }));
}

function readPcStorage(key: string): unknown {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage.getItem(key);
}

function writePcStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function parseStorageData<T extends object>(data: unknown, requiredKeys?: (keyof T)[]): T | null {
  if (!data) return null;
  const rawData = typeof data === 'string' ? JSON.parse(data) : data;
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }
  const value = rawData as Partial<T>;
  if (requiredKeys) {
    for (const key of requiredKeys) {
      if (value[key] === undefined) {
        return null;
      }
    }
  }
  return value as T;
}

export async function readFromStore<T extends object>(
  key: string,
  memoryStore: Map<string, T>,
  requiredKeys?: (keyof T)[]
): Promise<T | null> {
  // 1. 先从 memoryStore 取
  const memoryValue = memoryStore.get(key);
  if (memoryValue) return memoryValue;

  // 2. 从持久化存储取
  try {
    const isPcMiniApp = window.HWH5 === undefined;
    const rawData = isPcMiniApp ? readPcStorage(key) : await readMobileStorage(key);
    const value = parseStorageData<T>(rawData, requiredKeys);
    if (value) {
      memoryStore.set(key, value);
    }
    return value;
  } catch {
    return null;
  }
}

export function writeToStore<T extends object>(key: string, value: T, memoryStore: Map<string, T>): void {
  // 1. 更新 memoryStore
  memoryStore.set(key, value);

  // 2. 异步写入持久化存储
  try {
    const isPcMiniApp = window.HWH5 === undefined;
    if (isPcMiniApp) {
      writePcStorage(key, value);
    } else {
      writeMobileStorage(key, value);
    }
  } catch {
    // memoryStore 已更新，持久化失败可接受
  }
}
