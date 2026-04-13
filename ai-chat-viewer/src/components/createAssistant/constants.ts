import { HOST } from '../../constants';
import type { DefaultAvatarOption, InternalAssistantOption } from '../../types/digitalTwin';

function createSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createAvatar(bg: string, fg: string, text: string): string {
  return createSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="24" fill="${bg}" />
      <circle cx="40" cy="30" r="13" fill="${fg}" fill-opacity="0.75" />
      <rect x="21" y="49" width="38" height="17" rx="8.5" fill="${fg}" fill-opacity="0.75" />
      <text x="40" y="16" text-anchor="middle" font-size="10" fill="#ffffff">${text}</text>
    </svg>
  `);
}

export const DEFAULT_AVATARS: DefaultAvatarOption[] = [
  { id: 'avatar-1', image: createAvatar('#0D94FF', '#D8EEFF', 'A1') },
  { id: 'avatar-2', image: createAvatar('#0EA5A4', '#B7F3EF', 'A2') },
  { id: 'avatar-3', image: createAvatar('#7C3AED', '#E4D9FF', 'A3') },
  { id: 'avatar-4', image: createAvatar('#EA580C', '#FFE1CD', 'A4') },
];

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
    return `${trimTrailingSlash(HOST)}${normalizedIcon}`;
  }

  return normalizedIcon;
}
