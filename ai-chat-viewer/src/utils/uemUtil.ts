import { WeAgentDetails } from '../types/bridge';
import { reportUemEvent } from './hwext';
import { WeLog } from './logger';

function createBaseUemData(): Record<string, unknown> {
  return {
    clientType: '',
    entry: 'WeAgent',
    operationTime: new Date().getTime(),
  };
}

function reportClickEvent(eventId: string, eventTitle: string): void {
  void reportUemEvent(eventId, eventTitle, createBaseUemData()).catch((error) => {
    WeLog(`uemUtil reportUemEvent failed | extra=${JSON.stringify({ eventId })} | error=${JSON.stringify(error)}`);
  });
}

export function reportSelectAssistantClick(): void {
  reportClickEvent('activate_select_assistant_click', '\u9009\u62e9\u52a9\u7406');
}

export function reportCreateAssistantClick(): void {
  reportClickEvent('select_assistant_create_click', '\u521b\u5efa\u52a9\u7406');
}

export function reportEnableNowClick(): void {
  reportClickEvent('select_assistant_start_click', '\u5f00\u59cb\u4f7f\u7528');
}

export function reportSwitchAssistantClick(): void {
  reportClickEvent('switch_assistant_confirm_click', '\u786e\u8ba4\u5207\u6362');
}

export function reportViewHistoryClick(assistantAccount: string): void {
  reportClickEvent('weagent_history_click', '\u5386\u53f2\u4f1a\u8bdd');
}

export function reportCreateSessionClick(detail: WeAgentDetails | null, error?: any): void {
  reportClickEvent('weagent_create_session_click', '\u521b\u5efa\u4f1a\u8bdd');
}
