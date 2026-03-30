/**
 * Runtime type conversion helpers for SDK params.
 */
type ConvertibleValue = string | number | boolean | bigint | Object | null | undefined;

export class TypeConverter {
  static toRequiredString(value: ConvertibleValue, fieldName: string): string {
    const converted = this.toOptionalString(value, fieldName);
    if (converted === undefined) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return converted;
  }

  static toOptionalString(value: ConvertibleValue, fieldName: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    let text: string;
    if (typeof value === 'string') {
      text = value;
    } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      text = String(value);
    } else {
      throw new Error(`${fieldName} must be a string`);
    }

    const trimmed = text.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  static toNonNegativeInt(value: ConvertibleValue, defaultValue: number, fieldName: string): number {
    const converted = this.toOptionalInteger(value, fieldName);
    if (converted === undefined) {
      return Math.max(defaultValue, 0);
    }
    return Math.max(converted, 0);
  }

  static toPositiveInt(value: ConvertibleValue, defaultValue: number, fieldName: string): number {
    const safeDefault = defaultValue > 0 ? defaultValue : 1;
    const converted = this.toOptionalInteger(value, fieldName);
    if (converted === undefined) {
      return safeDefault;
    }
    return converted > 0 ? converted : safeDefault;
  }

  static requireInteger(value: ConvertibleValue, fieldName: string): number {
    const converted = this.toOptionalInteger(value, fieldName);
    if (converted === undefined) {
      throw new Error(`${fieldName} is required`);
    }
    return converted;
  }

  static toRequiredStringArray(value: ConvertibleValue, fieldName: string): string[] {
    if (value === undefined || value === null) {
      throw new Error(`${fieldName} is required`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`${fieldName} must be a string array`);
    }

    const typedArray = value as Array<ConvertibleValue>;
    const result: string[] = [];
    for (const item of typedArray) {
      const converted = this.toOptionalString(item, fieldName);
      if (converted === undefined) {
        throw new Error(`${fieldName} must contain non-empty strings`);
      }
      result.push(converted);
    }

    if (result.length === 0) {
      throw new Error(`${fieldName} is required`);
    }
    return result;
  }

  static toOptionalInteger(value: ConvertibleValue, fieldName: string): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`${fieldName} must be an integer`);
      }
      if (!Number.isInteger(value)) {
        throw new Error(`${fieldName} must be an integer`);
      }
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return undefined;
      }
      const converted = Number(trimmed);
      if (!Number.isFinite(converted) || !Number.isInteger(converted)) {
        throw new Error(`${fieldName} must be an integer`);
      }
      return converted;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    throw new Error(`${fieldName} must be an integer`);
  }
}
