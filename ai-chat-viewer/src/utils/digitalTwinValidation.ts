import type { BrainType } from '../types/digitalTwin';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

type AvatarValidationErrorCode = 'size' | 'format';

type AvatarValidationResult =
  | { valid: true }
  | { valid: false; reason: string; code: AvatarValidationErrorCode };

export function canProceedNext(name: string, description: string): boolean {
  return Boolean(name.trim() && description.trim());
}

export function canConfirm(brainType?: BrainType, bizRobotId?: string): boolean {
  if (!brainType) return false;
  if (brainType === 'custom') return true;
  return Boolean(bizRobotId?.trim());
}

export function validateAvatarFile(file: File): AvatarValidationResult {
  if (file.size >= MAX_AVATAR_SIZE) {
    return { valid: false, reason: '图片大小需小于2MB', code: 'size' };
  }

  const fileType = file.type.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(fileType)) {
    return { valid: true };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: true };
  }

  return { valid: false, reason: '仅支持JPG/PNG格式', code: 'format' };
}
