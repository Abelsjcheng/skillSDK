import type { GetFilePathResult } from '../../types/digitalTwin';
import {
  canConfirm,
  canProceedNext,
  hasInvalidDescription,
  hasInvalidName,
  validateAvatarFile,
} from '../digitalTwinValidation';

function createFilePathResult(filePath: string): GetFilePathResult {
  return { filePath };
}

describe('digitalTwinValidation', () => {
  describe('canProceedNext', () => {
    it('returns false when name is empty', () => {
      expect(canProceedNext('', 'desc')).toBe(false);
    });

    it('returns false when description is empty', () => {
      expect(canProceedNext('name', '  ')).toBe(false);
    });

    it('returns true when both name and description are valid', () => {
      expect(canProceedNext('helper01', 'valid description')).toBe(true);
    });

    it('returns false when name length is out of range', () => {
      expect(canProceedNext('a', 'valid description')).toBe(false);
      expect(canProceedNext('A'.repeat(51), 'valid description')).toBe(false);
    });

    it('returns false when description length is out of range', () => {
      expect(canProceedNext('helper01', 'a')).toBe(false);
      expect(canProceedNext('helper01', 'A'.repeat(257))).toBe(false);
    });

    it('returns false when name includes unsupported character', () => {
      expect(canProceedNext('helper@', 'valid description')).toBe(false);
    });

    it('returns true when description includes allowed punctuation', () => {
      expect(canProceedNext('helper01', 'supports punctuation, .!?;:()[]{}')).toBe(true);
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
    it('accepts valid png file path', () => {
      const file = createFilePathResult('avatar.png');
      expect(validateAvatarFile(file)).toEqual({ valid: true });
    });

    it('rejects unsupported extension', () => {
      const file = createFilePathResult('avatar.webp');
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
      expect(hasInvalidName('a')).toBe(true);
      expect(hasInvalidName('helper01')).toBe(false);
    });

    it('marks invalid description only when non-empty and invalid', () => {
      expect(hasInvalidDescription('')).toBe(false);
      expect(hasInvalidDescription('a')).toBe(true);
      expect(hasInvalidDescription('valid description')).toBe(false);
      expect(hasInvalidDescription('emoji test 🙂')).toBe(true);
    });
  });
});
