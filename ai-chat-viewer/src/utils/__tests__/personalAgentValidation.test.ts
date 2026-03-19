import { canConfirm, canProceedNext, validateAvatarFile } from '../personalAgentValidation';

function createFile(size: number, name: string, type: string): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('personalAgentValidation', () => {
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
        reason: '图片大小需小于2MB',
      });
    });

    it('rejects unsupported extension', () => {
      const file = createFile(1024, 'avatar.webp', 'image/webp');
      expect(validateAvatarFile(file)).toEqual({
        valid: false,
        reason: '仅支持JPG/PNG格式',
      });
    });
  });
});

