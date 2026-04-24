import preferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';
import { WeAgent, WeAgentDetails, WeAgentDetailsArray } from '../types';

const MOCK_USER_ID = 'mock_user_id';
const STORE_NAME_PREFIX = 'skill_sdk_we_agent_';
const KEY_CURRENT_DETAIL = 'current_we_agent_detail';
const KEY_LIST_CACHE = 'we_agent_list_cache';
const KEY_DETAILS_CACHE = 'we_agent_details';

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

  clearCurrentDetail(): void {
    this.removeValue(KEY_CURRENT_DETAIL);
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

  hasListCache(): boolean {
    return this.getString(KEY_LIST_CACHE) !== null;
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

  saveDetailsByPartnerAccount(partnerAccount: string, detail: WeAgentDetails | null): void {
    if (detail === null) {
      return;
    }
    const cache = this.loadDetailsCache();
    cache[partnerAccount] = detail;
    this.putJson(KEY_DETAILS_CACHE, cache);
  }

  loadDetailsByPartnerAccount(partnerAccount: string): WeAgentDetails | null {
    const cache = this.loadDetailsCache();
    const value = cache[partnerAccount];
    if (value === undefined) {
      return null;
    }
    return value;
  }

  updateCachedDetails(
    partnerAccount: string | undefined,
    robotId: string | undefined,
    name: string,
    icon: string,
    description: string
  ): void {
    const currentDetail = this.loadCurrentDetail();
    if (currentDetail !== null && this.matchesDetail(currentDetail, partnerAccount, robotId)) {
      currentDetail.name = name;
      currentDetail.icon = icon;
      currentDetail.desc = description;
      this.saveCurrentDetail(currentDetail);
    }

    const cache = this.loadDetailsCache();
    let updated = false;
    if (partnerAccount !== undefined) {
      const cachedDetail = cache[partnerAccount];
      if (cachedDetail !== undefined && this.matchesDetail(cachedDetail, partnerAccount, undefined)) {
        cachedDetail.name = name;
        cachedDetail.icon = icon;
        cachedDetail.desc = description;
        updated = true;
      }
    } else if (robotId !== undefined) {
      Object.keys(cache).some((key: string): boolean => {
        const cachedDetail = cache[key];
        if (!this.matchesDetail(cachedDetail, undefined, robotId)) {
          return false;
        }
        cachedDetail.name = name;
        cachedDetail.icon = icon;
        cachedDetail.desc = description;
        updated = true;
        return true;
      });
    }

    if (updated) {
      this.putJson(KEY_DETAILS_CACHE, cache);
    }
  }

  private putJson(
    key: string,
    value: WeAgentDetails | WeAgent[] | WeAgentDetailsArray | Record<string, WeAgentDetails>
  ): void {
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

  private removeValue(key: string): void {
    const pref = this.getPreferencesInstance();
    if (pref !== null) {
      try {
        pref.deleteSync(key);
        pref.flushSync();
      } catch (_error) {
        // Fall back to in-memory cache.
      }
    }
    delete this.fallback[key];
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

  private loadDetailsCache(): Record<string, WeAgentDetails> {
    const raw = this.getString(KEY_DETAILS_CACHE);
    if (raw === null || raw.trim() === '') {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const result: Record<string, WeAgentDetails> = {};
      Object.keys(parsed as Record<string, Object>).forEach((key: string) => {
        const value = (parsed as Record<string, Object>)[key];
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = value as WeAgentDetails;
        }
      });
      return result;
    } catch (_error) {
      return {};
    }
  }

  private matchesDetail(
    detail: WeAgentDetails | null | undefined,
    partnerAccount: string | undefined,
    robotId: string | undefined
  ): boolean {
    if (detail === null || detail === undefined) {
      return false;
    }
    if (partnerAccount !== undefined) {
      return this.normalize(detail.partnerAccount) === partnerAccount;
    }
    return robotId !== undefined && this.normalize(detail.id) === robotId;
  }

  private normalize(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
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
