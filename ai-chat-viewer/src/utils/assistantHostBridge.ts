import type { SwitchAssistantEventDetail } from '../types/bridge';

export const ASSISTANT_CLOSE_EVENT = 'weAgent:assistant-close';
export const SWITCH_ASSISTANT_SELECT_EVENT = 'weAgent:switch-assistant-select';
export const SWITCH_ASSISTANT_CANCEL_EVENT = 'weAgent:switch-assistant-cancel';
export const SWITCH_ASSISTANT_CONFIRM_EVENT = 'weAgent:switch-assistant-confirm';

function dispatchHostEvent(eventName: string, detail?: SwitchAssistantEventDetail): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (detail === undefined) {
    window.dispatchEvent(new CustomEvent(eventName));
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function dispatchAssistantCloseEvent(): void {
  dispatchHostEvent(ASSISTANT_CLOSE_EVENT);
}

export function dispatchSwitchAssistantSelectEvent(partnerAccount: string): void {
  dispatchHostEvent(SWITCH_ASSISTANT_SELECT_EVENT, { partnerAccount });
}

export function dispatchSwitchAssistantCancelEvent(partnerAccount: string): void {
  dispatchHostEvent(SWITCH_ASSISTANT_CANCEL_EVENT, { partnerAccount });
}

export function dispatchSwitchAssistantConfirmEvent(detail: any): void {
  dispatchHostEvent(SWITCH_ASSISTANT_CONFIRM_EVENT, { detail });
}
