import warningIcon from '../imgs/warn_icon.svg';
import { isPcMiniApp } from '../constants';
import '../styles/Toast.less';

interface ToastOptions {
  duration?: number;
  toastClassName?: string;
  hideClassName?: string;
}

const DEFAULT_DURATION = 2000;
const DEFAULT_TOAST_CLASS_NAME = 'toast';
const DEFAULT_HIDE_CLASS_NAME = 'toast-hide';
const ICON_TOAST_CLASS_NAMES: Record<string, {
  icon: string;
  text: string;
}> = {
  toast: {
    icon: 'toast__icon',
    text: 'toast__text',
  },
};

export function showToast(message: string, options?: ToastOptions): void {
  if (typeof document === 'undefined') {
    return;
  }

  const toastClassName = options?.toastClassName ?? DEFAULT_TOAST_CLASS_NAME;
  const hideClassName = options?.hideClassName ?? DEFAULT_HIDE_CLASS_NAME;
  const duration = options?.duration ?? DEFAULT_DURATION;

  const toast = document.createElement('div');
  const isPc = isPcMiniApp();
  toast.className = [toastClassName, isPc ? 'toast--pc' : 'toast--mobile'].join(' ');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  let removeTimeoutId = 0;
  let hideTimeoutId = 0;

  const removeToast = () => {
    window.clearTimeout(hideTimeoutId);
    window.clearTimeout(removeTimeoutId);
    toast.classList.add(hideClassName);
    removeTimeoutId = window.setTimeout(() => toast.remove(), 300);
  };

  if (isPc) {
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
  } else {
    const text = document.createElement('span');
    text.className = 'toast__text';
    text.textContent = message;
    toast.appendChild(text);
  }

  document.body.appendChild(toast);
  hideTimeoutId = window.setTimeout(removeToast, duration);
}
