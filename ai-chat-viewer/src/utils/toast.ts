import warningIcon from '../imgs/warn_icon.svg';
import '../styles/Toast.less';

interface ToastOptions {
  duration?: number;
  toastClassName?: string;
  hideClassName?: string;
}

const DEFAULT_DURATION = 2000;
const DEFAULT_TOAST_CLASS_NAME = 'toast';
const DEFAULT_HIDE_CLASS_NAME = 'toast-hide';
const ICON_TOAST_CLASS_NAMES: Record<string, { icon: string; text: string }> = {
  toast: {
    icon: 'toast__icon',
    text: 'toast__text',
  },
};

function normalizeMessage(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getErrorToastMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === 'string') {
    return normalizeMessage(error) || fallbackMessage;
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const candidateMessages = [
      errorRecord.errorMessage,
      errorRecord.message,
      errorRecord.msg,
      errorRecord.code,
    ];

    for (const candidate of candidateMessages) {
      const normalized = normalizeMessage(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  return fallbackMessage;
}

export function showErrorToast(error: unknown, fallbackMessage: string): void {
  showToast(getErrorToastMessage(error, fallbackMessage));
}

export function showToast(message: string, options?: ToastOptions): void {
  if (typeof document === 'undefined') {
    return;
  }

  const toastClassName = options?.toastClassName ?? DEFAULT_TOAST_CLASS_NAME;
  const hideClassName = options?.hideClassName ?? DEFAULT_HIDE_CLASS_NAME;
  const duration = options?.duration ?? DEFAULT_DURATION;

  const toast = document.createElement('div');
  toast.className = toastClassName;
  const iconToastClassNames = ICON_TOAST_CLASS_NAMES[toastClassName];

  if (iconToastClassNames) {
    const icon = document.createElement('img');
    icon.className = iconToastClassNames.icon;
    icon.src = warningIcon;
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = iconToastClassNames.text;
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
  } else {
    toast.textContent = message;
  }

  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add(hideClassName);
    window.setTimeout(() => toast.remove(), 300);
  }, duration);
}
