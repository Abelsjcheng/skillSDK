declare const __IS_PRO_ENV__: boolean | undefined;

function resolveIsProEnv(): boolean {
  return typeof __IS_PRO_ENV__ === 'boolean' ? __IS_PRO_ENV__ : true;
}

export const isProEnv = resolveIsProEnv();

export const APP_ID = isProEnv ? '921535418692659' : 'S008623';

export const HOST = `h5://${APP_ID}`;
