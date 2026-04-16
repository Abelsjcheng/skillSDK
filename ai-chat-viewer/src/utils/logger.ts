export function WeLog(message: string): void {
  if (typeof window === 'undefined' || typeof window.HWH5?.log !== 'function') {
    return;
  }

  window.HWH5?.log({ content: `[WeAgentCUI] ${message}`, type: 'i' })
}
