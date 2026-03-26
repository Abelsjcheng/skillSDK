/**
 * Lightweight logger with runtime switch.
 */
export class Logger {
  private readonly prefix: string;
  private enabled: boolean;

  constructor(prefix: string, enabled: boolean = false) {
    this.prefix = prefix;
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  info(message: string, ...args: Object[]): void {
    if (this.enabled) {
      console.info(`[${this.prefix}] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: Object[]): void {
    if (this.enabled) {
      console.warn(`[${this.prefix}] ${message}`, ...args);
    }
  }

  error(message: string, ...args: Object[]): void {
    if (this.enabled) {
      console.error(`[${this.prefix}] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: Object[]): void {
    if (this.enabled) {
      console.debug(`[${this.prefix}] ${message}`, ...args);
    }
  }
}
