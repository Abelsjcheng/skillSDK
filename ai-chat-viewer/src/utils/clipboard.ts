export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    typeof navigator !== 'undefined'
    && navigator.clipboard
    && typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback to document.execCommand below.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable in current environment.');
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';

  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error('Copy to clipboard failed.');
  }
}
