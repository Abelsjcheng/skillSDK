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

  info(message: string): void {
    if (this.enabled) {
      console.info(`[${this.prefix}] ${message}`);
    }
  }

  warn(message: string): void {
    if (this.enabled) {
      console.warn(`[${this.prefix}] ${message}`);
    }
  }

  error(message: string): void {
    if (this.enabled) {
      console.error(`[${this.prefix}] ${message}`);
    }
  }

  debug(message: string): void {
    if (this.enabled) {
      console.debug(`[${this.prefix}] ${message}`);
    }
  }
}
