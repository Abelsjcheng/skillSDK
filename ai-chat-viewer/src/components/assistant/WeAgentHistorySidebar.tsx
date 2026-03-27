import React, { useCallback, useEffect, useMemo, useState } from 'react';
import iconWeAgentHistory from '../../imgs/icon-we-agent-history.svg';
import { getHistorySessionsList, type SkillSession } from '../../utils/hwext';

type HistorySessionGroupKey = 'today' | 'yesterday' | 'sevenDaysAgo';

interface HistorySessionGroup {
  key: HistorySessionGroupKey;
  label: string;
  sessions: SkillSession[];
}

interface WeAgentHistorySidebarProps {
  assistantAccount?: string;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const HISTORY_SESSION_GROUP_ORDER: Array<{ key: HistorySessionGroupKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'sevenDaysAgo', label: '7天前' },
];

function getStartOfDayTimestamp(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function resolveHistorySessionGroupKey(updatedAt: string): HistorySessionGroupKey {
  const updatedTimestamp = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTimestamp)) {
    return 'sevenDaysAgo';
  }

  const todayStart = getStartOfDayTimestamp(new Date());
  const updatedStart = getStartOfDayTimestamp(new Date(updatedTimestamp));
  const dayDiff = Math.floor((todayStart - updatedStart) / DAY_MILLISECONDS);

  if (dayDiff <= 0) {
    return 'today';
  }
  if (dayDiff === 1) {
    return 'yesterday';
  }
  return 'sevenDaysAgo';
}

function groupHistorySessionsByUpdatedAt(sessions: SkillSession[]): HistorySessionGroup[] {
  const grouped = new Map<HistorySessionGroupKey, SkillSession[]>([
    ['today', []],
    ['yesterday', []],
    ['sevenDaysAgo', []],
  ]);

  const sortedSessions = [...sessions].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  sortedSessions.forEach((session) => {
    const key = resolveHistorySessionGroupKey(session.updatedAt);
    const list = grouped.get(key);
    if (list) {
      list.push(session);
    }
  });

  return HISTORY_SESSION_GROUP_ORDER
    .map(({ key, label }) => ({
      key,
      label,
      sessions: grouped.get(key) ?? [],
    }))
    .filter((group) => group.sessions.length > 0);
}

const WeAgentHistorySidebar: React.FC<WeAgentHistorySidebarProps> = ({ assistantAccount = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<SkillSession[]>([]);
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState('');

  const groupedHistorySessions = useMemo(
    () => groupHistorySessionsByUpdatedAt(historySessions),
    [historySessions],
  );

  useEffect(() => {
    setIsVisible(false);
    setIsLoading(false);
    setHistorySessions([]);
    setSelectedHistorySessionId('');
  }, [assistantAccount]);

  const handleOpen = useCallback(async () => {
    setIsVisible(true);
    setIsLoading(true);

    try {
      const currentAssistantAccount = assistantAccount.trim();
      const params = currentAssistantAccount
        ? { assistantAccount: currentAssistantAccount }
        : {};
      const result = await getHistorySessionsList(params);
      const sessions = Array.isArray(result.content) ? result.content : [];
      setHistorySessions(sessions);
    } catch (err) {
      console.error('Failed to load history sessions:', err);
      setHistorySessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [assistantAccount]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleSessionClick = useCallback((sessionId: string) => {
    setSelectedHistorySessionId(sessionId);
    // WeAgentCUI 保留扩展点：点击历史会话切换
  }, []);

  return (
    <>
      <button
        type="button"
        className="we-agent-cui-actions__button"
        onClick={handleOpen}
        aria-label="历史会话"
      >
        <img
          className="we-agent-cui-actions__icon"
          src={iconWeAgentHistory}
          alt=""
        />
      </button>
      {isVisible && (
        <div className="we-agent-history-sidebar" aria-label="历史会话侧边栏">
          <button
            type="button"
            className="we-agent-history-sidebar__mask"
            aria-label="关闭历史会话侧边栏"
            onClick={handleClose}
          />
          <aside
            className="we-agent-history-sidebar__panel"
            onClick={(event) => event.stopPropagation()}
          >
            {isLoading && (
              <div className="we-agent-history-sidebar__status">加载中...</div>
            )}
            {!isLoading && groupedHistorySessions.length === 0 && (
              <div className="we-agent-history-sidebar__status">暂无历史会话</div>
            )}
            {!isLoading && groupedHistorySessions.map((group) => (
              <section key={group.key} className="we-agent-history-sidebar__group">
                <div className="we-agent-history-sidebar__group-title">{group.label}</div>
                <div className="we-agent-history-sidebar__group-items">
                  {group.sessions.map((session) => {
                    const sessionId = session.welinkSessionId;
                    const sessionTitle = session.title?.trim() || '未命名会话';
                    const isSelected = selectedHistorySessionId === sessionId;

                    return (
                      <button
                        key={sessionId}
                        type="button"
                        className={[
                          'we-agent-history-sidebar__session-item',
                          isSelected ? 'is-selected' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => handleSessionClick(sessionId)}
                        title={sessionTitle}
                      >
                        {sessionTitle}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </aside>
        </div>
      )}
    </>
  );
};

export default WeAgentHistorySidebar;
