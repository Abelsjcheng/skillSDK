import {
  canConfirm,
  canProceedNext,
  hasInvalidDescription,
  hasInvalidName,
  validateAvatarFile,
} from '../digitalTwinValidation';

function createFile(size: number, name: string, type: string): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('digitalTwinValidation', () => {
  describe('canProceedNext', () => {
    it('returns false when name is empty', () => {
      expect(canProceedNext('', 'desc')).toBe(false);
    });

    it('returns false when description is empty', () => {
      expect(canProceedNext('name', '  ')).toBe(false);
    });

    it('returns true when both name and description are provided', () => {
      expect(canProceedNext('助手', '介绍')).toBe(true);
    });

    it('returns false when name length is out of range', () => {
      expect(canProceedNext('助', '介绍内容')).toBe(false);
      expect(canProceedNext('A'.repeat(51), '介绍内容')).toBe(false);
    });

    it('returns false when description length is out of range', () => {
      expect(canProceedNext('助手', '介')).toBe(false);
      expect(canProceedNext('助手', 'A'.repeat(257))).toBe(false);
    });

    it('returns false when name includes unsupported character', () => {
      expect(canProceedNext('助手@', '介绍内容')).toBe(false);
    });

    it('returns true when description includes common punctuation', () => {
      expect(canProceedNext('助手A1', '可处理中英文标点，支持!?.;:()【】《》')).toBe(true);
    });
  });

  describe('canConfirm', () => {
    it('returns true when brain type is custom', () => {
      expect(canConfirm('custom')).toBe(true);
    });

    it('returns false when brain type is internal and no assistant selected', () => {
      expect(canConfirm('internal')).toBe(false);
    });

    it('returns true when brain type is internal and assistant selected', () => {
      expect(canConfirm('internal', 'assistant-1')).toBe(true);
    });
  });

  describe('validateAvatarFile', () => {
    it('accepts valid png file under size limit', () => {
      const file = createFile(1024, 'avatar.png', 'image/png');
      expect(validateAvatarFile(file)).toEqual({ valid: true });
    });

    it('rejects file greater than or equal to 2MB', () => {
      const file = createFile(2 * 1024 * 1024, 'avatar.png', 'image/png');
      expect(validateAvatarFile(file)).toEqual({
        valid: false,
        code: 'size',
        reason: '图片大小需小于2MB',
      });
    });

    it('rejects unsupported extension', () => {
      const file = createFile(1024, 'avatar.webp', 'image/webp');
      expect(validateAvatarFile(file)).toEqual({
        valid: false,
        code: 'format',
        reason: '仅支持JPG/PNG格式',
      });
    });
  });

  describe('invalid-state helpers', () => {
    it('marks invalid name only when non-empty and invalid', () => {
      expect(hasInvalidName('')).toBe(false);
      expect(hasInvalidName('助')).toBe(true);
      expect(hasInvalidName('助手A1')).toBe(false);
    });

    it('marks invalid description only when non-empty and invalid', () => {
      expect(hasInvalidDescription('')).toBe(false);
      expect(hasInvalidDescription('介')).toBe(true);
      expect(hasInvalidDescription('说明🙂')).toBe(true);
      expect(hasInvalidDescription('说明：支持，。!?')).toBe(false);
    });
  });
});
