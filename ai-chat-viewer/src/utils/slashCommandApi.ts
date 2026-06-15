import type { SlashCommandItem, SlashCommandQueryParams } from '../types/slashCommand';
import { normalizeSlashCommands } from './slashCommand';
import { trackApiSlashCommandQuery } from './uemUtil';

const SLASH_COMMAND_QUERY_URL = '/api/v1/slash-commands/query';
const SLASH_COMMAND_QUERY_HEADERS = {
  'Content-Type': 'application/json',
};

export async function querySlashCommands(params: SlashCommandQueryParams): Promise<SlashCommandItem[]> {
  return trackApiSlashCommandQuery(params, (async () => {
    const fetchApi = window.HWH5?.fetch;
    if (typeof fetchApi !== 'function') {
      throw new Error('HWH5.fetch is not available.');
    }

    const response = await Promise.resolve(fetchApi(SLASH_COMMAND_QUERY_URL, {
      method: 'get',
      headers: SLASH_COMMAND_QUERY_HEADERS,
      body: JSON.stringify({ ak: params.ak }),
    }));

    if (!response || typeof response !== 'object') {
      throw new Error('Invalid slash command response.');
    }

    const result = typeof (response as { json?: unknown }).json === 'function'
      ? await (response as { json: () => Promise<unknown> | unknown }).json()
      : response;

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid slash command response.');
    }

    const parsedResult = result as { code?: unknown; message?: unknown; data?: unknown };
    if (parsedResult.code !== 200 || !Array.isArray(parsedResult.data)) {
      throw new Error(typeof parsedResult.message === 'string' ? parsedResult.message : 'Slash command query failed.');
    }

    return normalizeSlashCommands(parsedResult.data);
  })());
}
