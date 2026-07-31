import type {
  GetWeAgentUnreadMessageResult,
  WeAgentSessionUnreadState,
} from '../types/bridge';
import type { WeAgentUnreadCache } from '../types/weAgentUnread';

export function createEmptyWeAgentUnreadCache(): WeAgentUnreadCache {
  return {
    redDotVisible: false,
    sessionsById: {},
  };
}

export function normalizeWeAgentUnreadCacheResult(
  result: GetWeAgentUnreadMessageResult,
): WeAgentUnreadCache {
  const nextSessionsById: Record<string, WeAgentSessionUnreadState> = {};
  const resultSessions = Array.isArray(result.sessions) ? result.sessions : [];

  resultSessions.forEach((session) => {
    nextSessionsById[session.welinkSessionId] = {
      welinkSessionId: session.welinkSessionId,
      hasUnRead: session.hasUnRead,
      maxSeq: session.maxSeq,
    };
  });

  return {
    redDotVisible: Boolean(result.redDotVisible),
    sessionsById: nextSessionsById,
  };
}

export function getWeAgentSessionUnreadState(
  state: WeAgentUnreadCache,
  sessionId: string | null | undefined,
): WeAgentSessionUnreadState | null {
  const normalizedSessionId = String(sessionId ?? '').trim();
  if (!normalizedSessionId) {
    return null;
  }

  return state.sessionsById[normalizedSessionId] ?? null;
}

export function markWeAgentSessionRead(
  state: WeAgentUnreadCache,
  sessionId: string | null | undefined,
  readSeq?: number,
): WeAgentUnreadCache {
  const normalizedSessionId = String(sessionId ?? '').trim();
  if (!normalizedSessionId) {
    return state;
  }

  const current = state.sessionsById[normalizedSessionId];
  const normalizedReadSeq = Number(readSeq);
  const nextMaxSeq = Number.isFinite(normalizedReadSeq) && normalizedReadSeq > 0
    ? normalizedReadSeq
    : current?.maxSeq ?? 0;
  const nextSessionsById = {
    ...state.sessionsById,
    [normalizedSessionId]: {
      welinkSessionId: normalizedSessionId,
      hasUnRead: false,
      maxSeq: Math.max(current?.maxSeq ?? 0, nextMaxSeq),
    },
  };

  return {
    ...state,
    sessionsById: nextSessionsById,
  };
}

export function unReadSessionDeleted(
  state: WeAgentUnreadCache,
  sessionId: string | null | undefined,
): WeAgentUnreadCache {
  const normalizedSessionId = String(sessionId ?? '').trim();
  if (!normalizedSessionId || !state.sessionsById[normalizedSessionId]) {
    return state;
  }

  const nextSessionsById = { ...state.sessionsById };
  delete nextSessionsById[normalizedSessionId];

  return {
    ...state,
    sessionsById: nextSessionsById,
  };
}
