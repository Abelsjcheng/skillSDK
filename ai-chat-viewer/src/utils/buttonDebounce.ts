import type { MouseEvent as ReactMouseEvent } from 'react';

export const DEFAULT_BUTTON_DEBOUNCE_DELAY_MS = 600;

const lastClickAtMap = new WeakMap<HTMLButtonElement, number>();

export const runButtonClickWithDebounce = (
  event: ReactMouseEvent<HTMLButtonElement>,
  callback: () => void,
  delayMs = DEFAULT_BUTTON_DEBOUNCE_DELAY_MS,
): void => {
  const targetButton = event.currentTarget;
  if (!targetButton || targetButton.disabled) {
    return;
  }

  const now = Date.now();
  const lastClickAt = lastClickAtMap.get(targetButton);
  if (typeof lastClickAt === 'number' && now - lastClickAt < delayMs) {
    return;
  }

  lastClickAtMap.set(targetButton, now);
  callback();
};
