import { useEffect, useState } from 'react';
import { getStatusBarHeight } from './hwext';

export function useMobileStatusBarHeight(isPcMiniApp: boolean): number {
  const [statusBarHeight, setStatusBarHeight] = useState<number>(0);

  useEffect(() => {
    if (isPcMiniApp) {
      setStatusBarHeight(0);
      return;
    }

    let cancelled = false;

    const loadStatusBarHeight = async () => {
      try {
        const height = await getStatusBarHeight();
        if (!cancelled) {
          setStatusBarHeight(height);
        }
      } catch (error) {
        if (!cancelled) {
          setStatusBarHeight(0);
        }
        console.error('getStatusBarHeight failed:', error);
      }
    };

    void loadStatusBarHeight();

    return () => {
      cancelled = true;
    };
  }, [isPcMiniApp]);

  return statusBarHeight;
}
