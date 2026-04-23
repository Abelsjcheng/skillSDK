import { createOpenCodeHwh5ext, resolveOpenCodeBridgeConfig } from './createOpencodeHwh5ext';

declare global {
  interface Window {
    __AI_CHAT_VIEWER_OPENCODE_BRIDGE__?: boolean;
  }
}

function parseUrlSearch(search: string): URLSearchParams {
  return new URLSearchParams(search.replace(/^[?#]/, ''));
}

function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const directValue = parseUrlSearch(window.location.search).get(name);
  if (directValue !== null) {
    return directValue;
  }

  const hashValue = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hashValue) {
    return null;
  }

  const questionIndex = hashValue.indexOf('?');
  if (questionIndex < 0) {
    return null;
  }

  return parseUrlSearch(hashValue.slice(questionIndex)).get(name);
}

function shouldInstallOpenCodeBridge(): boolean {
  const adapterType = (getQueryParam('adapter') || '').trim().toLowerCase();
  if (adapterType === 'opencode') {
    return true;
  }

  return getQueryParam('opencodeBridge') === '1';
}

function resolveBridgeLanguage(): string {
  const candidate = (
    getQueryParam('language')
    || getQueryParam('lang')
    || (typeof navigator !== 'undefined' ? navigator.language : '')
    || 'zh'
  ).trim().toLowerCase();

  return candidate.startsWith('en') ? 'en' : 'zh';
}

function ensureDefaultRoute(assistantAccount: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.location.hash) {
    return;
  }
  window.location.hash = `/weAgentCUI?assistantAccount=${encodeURIComponent(assistantAccount)}&adapter=opencode`;
}

function installMockHwh5Shell(config: ReturnType<typeof resolveOpenCodeBridgeConfig>): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.HWH5) {
    window.HWH5 = {
      close: () => undefined,
      openWebview: ({ uri }) => {
        window.open(uri, '_blank', 'noopener,noreferrer');
      },
      navigateBack: () => window.history.back(),
    };
  }

  if (typeof window.HWH5.showToast !== 'function') {
    window.HWH5.showToast = async ({ msg }) => {
      // eslint-disable-next-line no-console
      console.warn('[ai-chat-viewer][opencode] toast:', msg);
    };
  }

  if (typeof window.HWH5.reboot !== 'function') {
    window.HWH5.reboot = async () => undefined;
  }

  if (typeof window.HWH5.getDeviceInfo !== 'function') {
    window.HWH5.getDeviceInfo = async () => ({ statusBarHeight: 0 });
  }

  if (typeof window.HWH5.getAppInfo !== 'function') {
    window.HWH5.getAppInfo = async () => ({ language: resolveBridgeLanguage() });
  }

  if (typeof window.HWH5.getUserInfo !== 'function') {
    window.HWH5.getUserInfo = async () => ({
      uid: config.userId,
      userNameZH: config.userNameZH,
      userNameEN: config.userNameEN,
      corpUserId: config.corpUserId,
    });
  }

  if (typeof window.HWH5.getAccountInfo !== 'function') {
    window.HWH5.getAccountInfo = async () => config.userId;
  }
}

function installUserCookie(userId: string): void {
  if (typeof document === 'undefined' || !userId) {
    return;
  }
  document.cookie = `userId=${encodeURIComponent(userId)}; path=/`;
}

export function installOpencodeBridge(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!shouldInstallOpenCodeBridge()) {
    return;
  }
  if (window.__AI_CHAT_VIEWER_OPENCODE_BRIDGE__) {
    return;
  }

  const config = resolveOpenCodeBridgeConfig();
  installUserCookie(config.userId);
  installMockHwh5Shell(config);
  window.HWH5EXT = createOpenCodeHwh5ext(config);
  window.__AI_CHAT_VIEWER_OPENCODE_BRIDGE__ = true;
  ensureDefaultRoute(config.assistantAccount);
}
