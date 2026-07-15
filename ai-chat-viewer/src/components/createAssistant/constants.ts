import { HOST } from '../../constants';
import type { DefaultAvatarOption, InternalAssistantOption } from '../../types/digitalTwin';


export const DEFAULT_AVATARS: DefaultAvatarOption[] = [
  { id: 'avatar-1', image: '/v1/images/avatar-1.jpg' },
  { id: 'avatar-2', image: '/v1/images/avatar-2.jpg' },
  { id: 'avatar-3', image: '/v1/images/avatar-3.jpg' },
  { id: 'avatar-4', image: '/v1/images/avatar-4.jpg' },
];

export const DEFAULT_NEW_AVATARS: DefaultAvatarOption[] = [
  { id: 'avatar-1', image: '/v1/images/new-avatar-1.jpg' },
  { id: 'avatar-2', image: '/v1/images/new-avatar-2.jpg' },
  { id: 'avatar-3', image: '/v1/images/new-avatar-3.jpg' },
  { id: 'avatar-4', image: '/v1/images/new-avatar-4.jpg' },
];

export function resolveDefaultAvatarIdByIcon(icon: string | undefined | null): string | undefined {
  const normalizedIcon = (icon ?? '').trim();
  if (!normalizedIcon) {
    return undefined;
  }

  const matchedNewAvatar = DEFAULT_NEW_AVATARS.find((avatar) => avatar.image === normalizedIcon);
  if (matchedNewAvatar) {
    return matchedNewAvatar.id;
  }

  const matchedOldAvatar = DEFAULT_AVATARS.find((avatar) => avatar.image === normalizedIcon);
  return matchedOldAvatar?.id;
}

export const INTERNAL_ASSISTANTS: InternalAssistantOption[] = [
  { name: '助手', icon: '', bizRobotId: '1234' },
];

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveAssistantIconUrl(icon: string | undefined | null): string {
  const normalizedIcon = (icon ?? '').trim();
  if (!normalizedIcon) {
    return '';
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalizedIcon)) {
    return normalizedIcon;
  }

  if (normalizedIcon.startsWith('/')) {
    return `${trimTrailingSlash(HOST())}${normalizedIcon}`;
  }

  return normalizedIcon;
}
