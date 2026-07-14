import {
  removeSessionFromHistoryCache,
  resolveNextSessionAfterDelete,
} from '../utils/sessionDelete';
import type { SkillSession } from '../types/bridge';
import type { HistorySessionsCache } from '../types/components';

function createSession(id: string): SkillSession {
  return {
    welinkSessionId: id,
    userId: 'user-1',
    ak: 'ak-1',
    title: id,
    bussinessDomain: 'miniapp',
    bussinessType: 'direct',
    bussinessId: 'business-1',
    assistantAccount: 'assistant-1',
    status: 'active',
    toolSessionId: null,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  };
}

function createCache(content: SkillSession[]): HistorySessionsCache {
  return {
    content,
    page: 0,
    size: 50,
    total: content.length,
    totalPages: 1,
  };
}

describe('App session deletion helpers', () => {
  it('removes a deleted session and decrements total without dropping loaded siblings', () => {
    const cache = createCache([
      createSession('session-1'),
      createSession('session-2'),
      createSession('session-3'),
    ]);

    expect(removeSessionFromHistoryCache(cache, 'session-2')).toEqual(expect.objectContaining({
      total: 2,
      content: [
        expect.objectContaining({ welinkSessionId: 'session-1' }),
        expect.objectContaining({ welinkSessionId: 'session-3' }),
      ],
    }));
  });

  it('selects the session after the deleted current session first', () => {
    const sessions = [
      createSession('session-1'),
      createSession('session-2'),
      createSession('session-3'),
    ];

    expect(resolveNextSessionAfterDelete(sessions, 'session-2')?.welinkSessionId).toBe('session-3');
  });

  it('falls back to the session before the deleted current session', () => {
    const sessions = [
      createSession('session-1'),
      createSession('session-2'),
    ];

    expect(resolveNextSessionAfterDelete(sessions, 'session-2')?.welinkSessionId).toBe('session-1');
  });
});
