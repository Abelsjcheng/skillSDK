import type { GetSessionMessageHistoryResponse } from '../types';
import type { SkillSession } from './hwext';

export function ensureSessionTimestamps(session: SkillSession): SkillSession {
  const now = new Date().toISOString();
  const createdAt = session?.createdAt?.trim() ? session.createdAt : now;
  const updatedAt = session?.updatedAt?.trim() ? session.updatedAt : createdAt;

  if (createdAt === session?.createdAt && updatedAt === session?.updatedAt) {
    return session;
  }

  return {
    ...session,
    createdAt,
    updatedAt,
  };
}

export function hasMoreHistoryByCursor(result: GetSessionMessageHistoryResponse): boolean {
  return result.hasMore;
}

export function isSessionClosed(status: string | null | undefined): boolean {
  const normalizedStatus = (status ?? '').trim().toLowerCase();
  return normalizedStatus === 'close' || normalizedStatus === 'closed';
}

export function getSessionUpdatedAtTimestamp(session: SkillSession): number {
  const timestamp = new Date(session.updatedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getLatestAvailableSessionByUpdatedAt(sessions: SkillSession[]): SkillSession | null {
  const availableSessions = sessions.filter((session) => !isSessionClosed(session.status));
  if (availableSessions.length === 0) {
    return null;
  }

  return [...availableSessions].sort(
    (left, right) => getSessionUpdatedAtTimestamp(right) - getSessionUpdatedAtTimestamp(left),
  )[0] ?? null;
}
