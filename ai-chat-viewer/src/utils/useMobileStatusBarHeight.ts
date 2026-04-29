import { useEffect } from 'react';
import { getStatusBarHeight } from './hwext';
import { WeLog } from './logger';
import { showToast } from './toast';

let cachedHeight: number | null = null;
let loadingPromise: Promise<number> | null = null;

function applyMobileSafeTop(height: number): void {
  document.documentElement.style.setProperty('--mobile-safe-top', `${height}px`);
}

function loadStatusBarHeight(): Promise<number> {
  if (cachedHeight !== null) {
    return Promise.resolve(cachedHeight);
  }

  if (!loadingPromise) {
    loadingPromise = getStatusBarHeight()
      .catch((error) => {
        WeLog(`useMobileStatusBarHeight getStatusBarHeight failed | error=${JSON.stringify(error)}`);
        showToast('获取状态栏高度失败');
        return 0;
      })
      .then((height) => {
        cachedHeight = height;
        applyMobileSafeTop(height);
        return height;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }

  return loadingPromise;
}

export function useMobileStatusBarHeight(isPcMiniApp: boolean): number {
  useEffect(() => {
    if (isPcMiniApp) {
      return;
    }

    if (cachedHeight !== null) {
      applyMobileSafeTop(cachedHeight);
      return;
    }

    void loadStatusBarHeight();
  }, [isPcMiniApp]);

  return isPcMiniApp ? 0 : (cachedHeight ?? 0);
}
