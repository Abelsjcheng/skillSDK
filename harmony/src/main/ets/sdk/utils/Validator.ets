/**
 * Runtime parameter validators for SDK public APIs.
 */
type ValidatorValue = Object | string | number | boolean | bigint | Function | null | undefined;

export class Validator {
  static requireObject(value: ValidatorValue, paramName: string): void {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${paramName} must be an object`);
    }
  }

  static requireString(value: ValidatorValue, paramName: string): void {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${paramName} must be a non-empty string`);
    }
  }

  static requireNumber(value: ValidatorValue, paramName: string): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`${paramName} must be a valid number`);
    }
  }

  static requirePositiveInteger(value: ValidatorValue, paramName: string): void {
    this.requireNumber(value, paramName);
    if (!Number.isInteger(value as number) || (value as number) <= 0) {
      throw new Error(`${paramName} must be a positive integer`);
    }
  }

  static optionalPositiveInteger(value: ValidatorValue, paramName: string): void {
    if (value === null || value === undefined) {
      return;
    }
    this.requirePositiveInteger(value, paramName);
  }

  static requireNonNegativeInteger(value: ValidatorValue, paramName: string): void {
    this.requireNumber(value, paramName);
    if (!Number.isInteger(value as number) || (value as number) < 0) {
      throw new Error(`${paramName} must be a non-negative integer`);
    }
  }

  static optionalNonNegativeInteger(value: ValidatorValue, paramName: string): void {
    if (value === null || value === undefined) {
      return;
    }
    this.requireNonNegativeInteger(value, paramName);
  }

  static requireFunction(value: ValidatorValue, paramName: string): void {
    if (typeof value !== 'function') {
      throw new Error(`${paramName} must be a function`);
    }
  }

  static optionalFunction(value: ValidatorValue, paramName: string): void {
    if (value === null || value === undefined) {
      return;
    }
    this.requireFunction(value, paramName);
  }

  static requireEnum<T extends string>(value: ValidatorValue, allowed: T[], paramName: string): void {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      throw new Error(`${paramName} must be one of: ${allowed.join(', ')}`);
    }
  }

  static requireHttpUrl(value: ValidatorValue, paramName: string): void {
    this.requireString(value, paramName);
    const url = value as string;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(`${paramName} must start with http:// or https://`);
    }
  }

  static requireWebSocketUrl(value: ValidatorValue, paramName: string): void {
    this.requireString(value, paramName);
    const url = value as string;
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      throw new Error(`${paramName} must start with ws:// or wss://`);
    }
  }
}
