import preferences from '@ohos.data.preferences';
import { WeAgent, WeAgentDetails } from '../types';

const MOCK_USER_ID = 'mock_user_id';
const STORE_NAME_PREFIX = 'skill_sdk_we_agent_';
const KEY_CURRENT_DETAIL = 'current_we_agent_detail';
const KEY_LIST_CACHE = 'we_agent_list_cache';

/**
 * Preferences-backed store for V2 assistant cache.
 * Data is isolated by mock user id.
 */
export class WeAgentStore {
  private readonly userId: string;
  private context: object | undefined;
  private prefInstance: any = null;
  private readonly fallback: Record<string, string> = {};

  constructor(context?: object, userId?: string) {
    this.userId = userId ?? MOCK_USER_ID;
    this.context = context;
  }

  updateContext(context?: object): void {
    this.context = context;
    this.prefInstance = null;
  }

  saveCurrentDetail(detail: WeAgentDetails): void {
    this.putJson(KEY_CURRENT_DETAIL, detail);
  }

  loadCurrentDetail(): WeAgentDetails | null {
    const raw = this.getString(KEY_CURRENT_DETAIL);
    if (raw === null || raw.trim() === '') {
      return null;
    }
    try {
      return JSON.parse(raw) as WeAgentDetails;
    } catch (_error) {
      return null;
    }
  }

  saveList(list: WeAgent[]): void {
    this.putJson(KEY_LIST_CACHE, list);
  }

  loadList(): WeAgent[] {
    const raw = this.getString(KEY_LIST_CACHE);
    if (raw === null || raw.trim() === '') {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as WeAgent[]) : [];
    } catch (_error) {
      return [];
    }
  }

  private putJson(key: string, value: unknown): void {
    const encoded = JSON.stringify(value);
    const pref = this.getPreferencesInstance();
    if (pref !== null) {
      try {
        if (typeof pref.putSync === 'function') {
          pref.putSync(key, encoded);
          if (typeof pref.flushSync === 'function') {
            pref.flushSync();
          }
        } else if (typeof pref.putStringSync === 'function') {
          pref.putStringSync(key, encoded);
          if (typeof pref.flushSync === 'function') {
            pref.flushSync();
          }
        } else if (typeof pref.put === 'function') {
          void pref.put(key, encoded).then(() => {
            if (typeof pref.flush === 'function') {
              return pref.flush();
            }
            return undefined;
          });
        }
      } catch (_error) {
        // Fall back to in-memory cache.
      }
    }
    this.fallback[key] = encoded;
  }

  private getString(key: string): string | null {
    const pref = this.getPreferencesInstance();
    if (pref !== null) {
      try {
        if (typeof pref.getSync === 'function') {
          const value = pref.getSync(key, '');
          if (typeof value === 'string') {
            return value;
          }
        } else if (typeof pref.getStringSync === 'function') {
          const value = pref.getStringSync(key, '');
          if (typeof value === 'string') {
            return value;
          }
        }
      } catch (_error) {
        // Ignore and use fallback.
      }
    }
    return this.fallback[key] ?? null;
  }

  private getPreferencesInstance(): any {
    if (this.prefInstance !== null) {
      return this.prefInstance;
    }
    if (this.context === undefined || this.context === null) {
      return null;
    }

    try {
      const storeName = `${STORE_NAME_PREFIX}${this.userId}`;
      const prefsApi = preferences as unknown as Record<string, unknown>;
      if (typeof prefsApi.getPreferencesSync === 'function') {
        const fn = prefsApi.getPreferencesSync as (ctx: object, name: string) => unknown;
        this.prefInstance = fn(this.context, storeName);
      }
    } catch (_error) {
      this.prefInstance = null;
    }
    return this.prefInstance;
  }
}
