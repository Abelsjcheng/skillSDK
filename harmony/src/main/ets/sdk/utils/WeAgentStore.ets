import preferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';
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
  private context: common.UIAbilityContext | undefined;
  private prefInstance: preferences.Preferences | null = null;
  private readonly fallback: Record<string, string> = {};

  constructor(context?: common.UIAbilityContext, userId?: string) {
    this.userId = userId ?? MOCK_USER_ID;
    this.context = context;
  }

  updateContext(context?: common.UIAbilityContext): void {
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

  private putJson(key: string, value: WeAgentDetails | WeAgent[]): void {
    const encoded = JSON.stringify(value);
    const pref = this.getPreferencesInstance();
    if (pref !== null) {
      try {
        pref.putSync(key, encoded);
        pref.flushSync();
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
        const value = pref.getSync(key, '');
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
          return String(value);
        }
      } catch (_error) {
        // Ignore and use fallback.
      }
    }
    return this.fallback[key] ?? null;
  }

  private getPreferencesInstance(): preferences.Preferences | null {
    if (this.prefInstance !== null) {
      return this.prefInstance;
    }
    if (this.context === undefined || this.context === null) {
      return null;
    }

    try {
      const storeName = `${STORE_NAME_PREFIX}${this.userId}`;
      const options: preferences.Options = { name: storeName };
      this.prefInstance = preferences.getPreferencesSync(this.context, options);
    } catch (_error) {
      this.prefInstance = null;
    }
    return this.prefInstance;
  }
}
