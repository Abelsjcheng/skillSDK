import type { MouseEvent } from 'react';

export interface MarkdownLinkClickDetail {
  url: string;
  text: string;
  messageId?: string;
  source?: string;
}

const MARKDOWN_LINK_CLICK_EVENT = 'ai-chat-viewer:markdown-link-click';

export function isWebUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://example.com');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function handleMarkdownLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  url: string,
  detail: MarkdownLinkClickDetail,
): void {
  if (!isWebUrl(url)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (typeof window === 'undefined') {
    return;
  }

  const customEvent = new CustomEvent<MarkdownLinkClickDetail>(MARKDOWN_LINK_CLICK_EVENT, {
    cancelable: true,
    detail,
  });

  window.dispatchEvent(customEvent);
}
