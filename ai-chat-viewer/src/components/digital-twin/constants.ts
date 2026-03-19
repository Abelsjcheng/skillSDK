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

function createAssistantIcon(bg: string): string {
  return createSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <rect width="20" height="20" rx="6" fill="${bg}" />
      <circle cx="10" cy="10" r="4" fill="#ffffff" fill-opacity="0.95" />
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
  { id: 'assistant-writing', label: '写作助手', icon: createAssistantIcon('#0D94FF') },
  { id: 'assistant-meeting', label: '会议助手', icon: createAssistantIcon('#0EA5A4') },
  { id: 'assistant-coding', label: '编码助手', icon: createAssistantIcon('#7C3AED') },
  { id: 'assistant-analysis', label: '分析助手', icon: createAssistantIcon('#EA580C') },
  { id: 'assistant-plan', label: '计划助手', icon: createAssistantIcon('#2563EB') },
  { id: 'assistant-office', label: '办公助手', icon: createAssistantIcon('#4F46E5') },
];

export const BRAIN_ILLUSTRATION = createSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#EFF6FF" />
        <stop offset="100%" stop-color="#DBEAFE" />
      </linearGradient>
    </defs>
    <rect width="640" height="160" rx="0" fill="url(#g1)" />
    <circle cx="116" cy="80" r="52" fill="#BFDBFE" fill-opacity="0.75" />
    <circle cx="518" cy="54" r="34" fill="#93C5FD" fill-opacity="0.5" />
    <circle cx="546" cy="115" r="22" fill="#60A5FA" fill-opacity="0.55" />
    <text x="320" y="90" text-anchor="middle" font-size="24" font-weight="700" fill="#1D4ED8">DIGITAL TWIN</text>
  </svg>
`);



