import i18n from '../i18n/config';
import type { BrainType, GetFilePathResult } from '../types/digitalTwin';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const DESCRIPTION_MIN_LENGTH = 2;
const DESCRIPTION_MAX_LENGTH = 256;

const NAME_ALLOWED_PATTERN = /^[A-Za-z0-9\u4E00-\u9FFF]+$/;
const DESCRIPTION_ALLOWED_PATTERN =
  /^[A-Za-z0-9\u4E00-\u9FFF\s,.!?;:'"()\-_/\\@#$%^&*+=~`|<>[\]{}，。！？；：、（）【】《》“”‘’…·]+$/;

type AvatarValidationErrorCode = 'size' | 'format';

type AvatarValidationResult =
  | { valid: true }
  | { valid: false; reason: string; code: AvatarValidationErrorCode };

export function canProceedNext(name: string, description: string): boolean {
  return isValidName(name) && isValidDescription(description);
}

export function isValidName(value: string): boolean {
  const normalizedValue = value.trim();
  const length = normalizedValue.length;
  if (length < NAME_MIN_LENGTH || length > NAME_MAX_LENGTH) {
    return false;
  }
  return NAME_ALLOWED_PATTERN.test(normalizedValue);
}

export function isValidDescription(value: string): boolean {
  const normalizedValue = value.trim();
  const length = normalizedValue.length;
  if (length < DESCRIPTION_MIN_LENGTH || length > DESCRIPTION_MAX_LENGTH) {
    return false;
  }
  return DESCRIPTION_ALLOWED_PATTERN.test(normalizedValue);
}

export function hasInvalidName(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  return !isValidName(value);
}

export function hasInvalidDescription(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  return !isValidDescription(value);
}

export function canConfirm(brainType?: BrainType, bizRobotId?: string): boolean {
  if (!brainType) return false;
  if (brainType === 'custom') return true;
  return Boolean(bizRobotId?.trim());
}

export function validateAvatarFile(file: GetFilePathResult): AvatarValidationResult {
  const ext = file.filePath.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: true };
  }

  return { valid: false, reason: i18n.t('createAssistant.invalidAvatarFormat'), code: 'format' };
}
