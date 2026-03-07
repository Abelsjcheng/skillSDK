/**
 * Validator
 * 参数验证工具类
 */

export class Validator {
  /**
   * 验证必填字符串参数
   */
  static requireString(value: unknown, paramName: string): void {
    if (value === undefined || value === null || value === '') {
      throw new Error(`${paramName} is required and must be a non-empty string`);
    }
    if (typeof value !== 'string') {
      throw new Error(`${paramName} must be a string`);
    }
  }

  /**
   * 验证必填数字参数
   */
  static requireNumber(value: unknown, paramName: string): void {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${paramName} must be a valid number`);
    }
  }

  /**
   * 验证可选数字参数
   */
  static optionalNumber(value: unknown, paramName: string): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`${paramName} must be a valid number if provided`);
      }
    }
  }

  /**
   * 验证必填布尔参数
   */
  static requireBoolean(value: unknown, paramName: string): void {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    if (typeof value !== 'boolean') {
      throw new Error(`${paramName} must be a boolean`);
    }
  }

  /**
   * 验证函数参数
   */
  static requireFunction(value: unknown, paramName: string): void {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    if (typeof value !== 'function') {
      throw new Error(`${paramName} must be a function`);
    }
  }

  /**
   * 验证可选函数参数
   */
  static optionalFunction(value: unknown, paramName: string): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'function') {
        throw new Error(`${paramName} must be a function if provided`);
      }
    }
  }

  /**
   * 验证枚举值
   */
  static requireEnum<T extends string | number>(
    value: unknown,
    enumObj: object,
    paramName: string
  ): void {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    
    const enumValues = Object.values(enumObj);
    if (!enumValues.includes(value)) {
      throw new Error(
        `${paramName} must be one of: ${enumValues.join(', ')}`
      );
    }
  }

  /**
   * 验证URL格式
   */
  static requireUrl(value: unknown, paramName: string): void {
    this.requireString(value, paramName);
    
    try {
      new URL(value as string);
    } catch {
      throw new Error(`${paramName} must be a valid URL`);
    }
  }

  /**
   * 验证WebSocket URL格式
   */
  static requireWebSocketUrl(value: unknown, paramName: string): void {
    this.requireString(value, paramName);
    
    const str = value as string;
    if (!str.startsWith('ws://') && !str.startsWith('wss://')) {
      throw new Error(`${paramName} must be a valid WebSocket URL (ws:// or wss://)`);
    }
  }

  /**
   * 验证对象参数
   */
  static requireObject(value: unknown, paramName: string): void {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${paramName} must be an object`);
    }
  }

  /**
   * 验证数组参数
   */
  static requireArray(value: unknown, paramName: string): void {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`${paramName} must be an array`);
    }
  }
}