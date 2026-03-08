import { Logger } from '../utils/Logger';
import {
  OnSkillWecodeStatusChangeParams,
  SkillWecodeStatus,
  SkillWecodeStatusResult
} from '../types';

/**
 * Miniapp status callback manager.
 */
export class WeCodeStateManager {
  private readonly logger: Logger;
  private callbacks: Array<(result: SkillWecodeStatusResult) => void> = [];

  constructor(enableLog: boolean = false) {
    this.logger = new Logger('WeCodeStateManager', enableLog);
  }

  setEnableLog(enable: boolean): void {
    this.logger.setEnabled(enable);
  }

  register(params: OnSkillWecodeStatusChangeParams): void {
    const exists = this.callbacks.some((cb) => cb === params.callback);
    if (!exists) {
      this.callbacks.push(params.callback);
    }
  }

  notify(status: SkillWecodeStatus, message?: string): void {
    const payload: SkillWecodeStatusResult = {
      status,
      timestamp: Date.now(),
      message
    };
    for (const callback of this.callbacks) {
      try {
        callback(payload);
      } catch (error) {
        this.logger.warn('miniapp status callback failed', error);
      }
    }
  }

  clearAll(): void {
    this.callbacks = [];
  }
}
