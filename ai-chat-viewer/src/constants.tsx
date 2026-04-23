declare const __IS_PRO_ENV__: boolean | undefined;
export function isPcMiniApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return false;
}

function resolveIsProEnv(): boolean {
  if (isPcMiniApp()) {
    try {
      const _APPENV = localStorage.getItem("_APPENV") || 'PROD';
      if (_APPENV === 'uat') {
        return false;
      } else {
        return true;
      }
    } catch (error) {
      return true
    }
  }
  return typeof __IS_PRO_ENV__ === 'boolean' ? __IS_PRO_ENV__ : true;
}

export const isProEnv = resolveIsProEnv;

export const APP_ID =()=> isProEnv() ? '921535418692659' : 'S008623';

export const HOST = ()=>`h5://${APP_ID()}`;


export function isIosMobileDevice(): boolean {
  if (!navigator) {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|mac/i.test(userAgent)) {
    return true;
  }

  return false;
}
