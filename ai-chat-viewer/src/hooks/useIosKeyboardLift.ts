import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { isIosMobileDevice } from '../constants';
import { getDeviceInfo } from '../utils/hwext';
import { WeLog } from '../utils/logger';

type UseIosKeyboardLiftResult = {
  isIosKeyboardLiftEnabled: boolean;
  keyboardHeight: number;
  keyboardContainerStyle: CSSProperties | undefined;
};

export function useIosKeyboardLift(): UseIosKeyboardLiftResult {
  const isIosKeyboardLiftEnabled = isIosMobileDevice();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isIosKeyboardLiftEnabled) {
      setKeyboardHeight(0);
      window.HWH5?.offKeyboardHeightChange?.();
      return;
    }

    if (typeof window === 'undefined' || typeof window.HWH5?.onKeyboardHeightChange !== 'function') {
      return;
    }

    let safeAreaInsetBottom = 0;
    const handleKeyboardHeightChange = (res: { height: number }) => {
      let nextHeight = typeof res?.height === 'number' && Number.isFinite(res.height) ? res.height : 0;
      nextHeight = nextHeight - 49 - safeAreaInsetBottom / window.devicePixelRatio;
      setKeyboardHeight(nextHeight > 0 ? nextHeight : 0);
    };

    const setupKeyboardHeightListener = async () => {
      try {
        await window.HWH5?.disableAutoPushUpPage?.({ status: true });
        const deviceInfo = await getDeviceInfo();
        safeAreaInsetBottom = deviceInfo.safeAreaInsetBottom;
      } catch (error) {
        WeLog(`useIosKeyboardLift setupKeyboardHeightListener failed | error=${JSON.stringify(error)}`);
      }

      window.HWH5.onKeyboardHeightChange?.(handleKeyboardHeightChange);
    };

    void setupKeyboardHeightListener();

    return () => {
      window.HWH5?.offKeyboardHeightChange?.();
      setKeyboardHeight(0);
    };
  }, [isIosKeyboardLiftEnabled]);

  return {
    isIosKeyboardLiftEnabled,
    keyboardHeight,
    keyboardContainerStyle: isIosKeyboardLiftEnabled && keyboardHeight > 0
      ? { height: `calc(100vh - ${keyboardHeight}px)` }
      : undefined,
  };
}
