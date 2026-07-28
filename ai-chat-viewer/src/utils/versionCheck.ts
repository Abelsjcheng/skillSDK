import {
  isAndroidMobileDevice,
  isHarmonyMobileDevice,
  isIosMobileDevice,
  isPcMiniApp,
} from '../constants';
import { getAppInfo } from './hwext';

type ClientPlatform = 'android' | 'ios' | 'harmony' | 'pc' | 'unknown';
type MinVersionMap = Record<string, string>;

const QRCODE_CREATE_ASSISTANT_MIN_VERSION: MinVersionMap = {
  android: '5.83.0',
  ios: '5.83.0',
  harmony: '1.29.0',
};

const ASSISTANT_EDIT_MIN_VERSION: MinVersionMap = {
  android: '5.85.0',
  ios: '5.85.0',
  harmony: '1.31.0',
};
const WE_AGENT_ONLINE_MIN_VERSION: MinVersionMap = {
  android: '5.86.0',
  ios: '5.86.0',
  harmony: '1.32.0',
};
export function compareVersion(newVersion: string, oldVersion: string): number {
  const v1 = newVersion.split('.');
  const v2 = oldVersion.split('.');
  const len = Math.max(v1.length, v2.length);

  while (v1.length < len) {
    v1.push('0');
  }
  while (v2.length < len) {
    v2.push('0');
  }

  for (let i = 0; i < len; i += 1) {
    const num1 = parseInt(v1[i], 10);
    const num2 = parseInt(v2[i], 10);

    if (num1 > num2) {
      return 1;
    }
    if (num1 < num2) {
      return -1;
    }
  }

  return 0;
}

function getCurrentPlatform(): ClientPlatform {
  if (isPcMiniApp()) {
    return 'pc';
  }

  if (isHarmonyMobileDevice()) {
    return 'harmony';
  }

  if (isIosMobileDevice()) {
    return 'ios';
  }

  if (isAndroidMobileDevice()) {
    return 'android';
  }

  return 'unknown';
}

async function canUseByMinVersion(minVersion: MinVersionMap): Promise<boolean> {
  if (isPcMiniApp()) {
    return true;
  }

  const platform = getCurrentPlatform();
  const targetVersion = minVersion[platform];
  if (!targetVersion) {
    return true;
  }

  const { versionName = '' } = await getAppInfo();
  const currentVersion = versionName.trim();
  if (!currentVersion) {
    return true;
  }

  return compareVersion(currentVersion, targetVersion) >= 0;
}

export const canIUse = {
  // 助理详情页移动端编辑入口版本判断。
  assistantEdit: () => canUseByMinVersion(ASSISTANT_EDIT_MIN_VERSION),
  // 扫码创建助理流程版本判断。
  qrcodeCreateAssistant: () => canUseByMinVersion(QRCODE_CREATE_ASSISTANT_MIN_VERSION),
  // WeAgent 在线状态版本判断。
  weAgentOnline: () => canUseByMinVersion(WE_AGENT_ONLINE_MIN_VERSION),
};
