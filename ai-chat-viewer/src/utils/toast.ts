interface ToastOptions {
  duration?: number;
  toastClassName?: string;
  hideClassName?: string;
}

const DEFAULT_DURATION = 2000;

export function showToast(message: string, options?: ToastOptions): void {
  if (typeof document === 'undefined') {
    return;
  }

  const toastClassName = options?.toastClassName ?? 'copy-toast';
  const hideClassName = options?.hideClassName ?? 'copy-toast-hide';
  const duration = options?.duration ?? DEFAULT_DURATION;

  const toast = document.createElement('div');
  toast.className = toastClassName;
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add(hideClassName);
    window.setTimeout(() => toast.remove(), 300);
  }, duration);
}
