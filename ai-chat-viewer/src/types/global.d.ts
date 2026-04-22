import type { HWH5Bridge, HWH5EXT, Pedestal } from './bridge/hwext';

declare global {
  interface Window {
    HWH5EXT?: HWH5EXT;
    Pedestal?: Pedestal;
    HWH5: HWH5Bridge;
    onReceive?: (schema: string, payload: string) => void;
  }
}

export {};
