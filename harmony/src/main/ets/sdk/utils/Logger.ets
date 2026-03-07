/**
 * Logger
 * 日志工具类
 */

export class Logger {
  private prefix: string;
  private enableLog: boolean;

  constructor(prefix: string, enableLog: boolean = false) {
    this.prefix = prefix;
    this.enableLog = enableLog;
  }

  /**
   * 设置日志开关
   */
  setEnableLog(enable: boolean): void {
    this.enableLog = enable;
  }

  /**
   * 信息日志
   */
  info(message: string, ...args: unknown[]): void {
    if (this.enableLog) {
      console.info(`[${this.prefix}] ${message}`, ...args);
    }
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.enableLog) {
      console.warn(`[${this.prefix}] ${message}`, ...args);
    }
  }

  /**
   * 错误日志
   */
  error(message: string, ...args: unknown[]): void {
    if (this.enableLog) {
      console.error(`[${this.prefix}] ${message}`, ...args);
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.enableLog) {
      console.debug(`[${this.prefix}] ${message}`, ...args);
    }
  }

  /**
   * 普通日志
   */
  log(message: string, ...args: unknown[]): void {
    if (this.enableLog) {
      console.log(`[${this.prefix}] ${message}`, ...args);
    }
  }
}