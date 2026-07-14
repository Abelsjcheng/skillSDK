import type { SkillSession } from '../types/bridge';
import type { HistorySessionsCache } from '../types/components';
import { HISTORY_SESSIONS_PAGE_SIZE } from './session';

export function removeSessionFromHistoryCache(
  cache: HistorySessionsCache | null,
  sessionId: string,
): HistorySessionsCache | null {
  if (!cache || !sessionId) {
    return cache;
  }

  const nextContent = cache.content.filter((session) => session.welinkSessionId !== sessionId);
  if (nextContent.length === cache.content.length) {
    return cache;
  }

  const nextTotal = Math.max(cache.total - 1, nextContent.length);
  const pageSize = Math.max(cache.size || HISTORY_SESSIONS_PAGE_SIZE, 1);

  return {
    ...cache,
    content: nextContent,
    total: nextTotal,
    totalPages: Math.ceil(nextTotal / pageSize),
  };
}

export function resolveNextSessionAfterDelete(
  sessions: SkillSession[],
  deletedSessionId: string,
): SkillSession | null {
  if (!deletedSessionId) {
    return null;
  }

  const deletedIndex = sessions.findIndex((session) => session.welinkSessionId === deletedSessionId);
  if (deletedIndex < 0) {
    return null;
  }

  return sessions[deletedIndex + 1] ?? sessions[deletedIndex - 1] ?? null;
}
