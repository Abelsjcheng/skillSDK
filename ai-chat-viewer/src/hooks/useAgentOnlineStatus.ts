/**
 * 助手在线状态管理 Hook
 * 先从存储读取，再调用接口更新
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isPcMiniApp } from '../constants';
import {
  getOnlineStatus,
  getWeAgentList,
  registerSessionListener,
  unregisterSessionListener,
} from '../utils/hwext';
import type { StreamMessage } from '../types';
import type { WeAgentListItem } from '../types/bridge/hwext';
import { DEFAULT_ASSISTANT_LIST_QUERY } from '../utils/assistantSelection';
import {
  readAgentOnlineStatusStore,
  writeAgentOnlineStatusStore,
} from '../utils/agentOnlineStatusStore';
import { WeLog } from '../utils/logger';

type AgentStatusMap = Record<string, boolean>;

export interface UseAgentOnlineStatusOptions {
  /** 初始化时是否全量查询在线状态，默认 false */
  fetchOnInit?: boolean;
}

export function useAgentOnlineStatus(options: UseAgentOnlineStatusOptions = {}) {
  const { fetchOnInit = false } = options;
  const [agentStatusMap, setAgentStatusMap] = useState<AgentStatusMap>({});
  const [isOpen, setIsOpen] = useState(false);
  const initializedRef = useRef(false);

  // 更新单个助手状态（写入存储）
  const updateAgentStatus = useCallback(
    async (partnerAccount: string, isOnline: boolean) => {
      WeLog(`[AgentStatus] update status | partnerAccount=${partnerAccount} | isOnline=${isOnline}`);
      setAgentStatusMap((prev) => {
        const next = { ...prev, [partnerAccount]: isOnline };
        void writeAgentOnlineStatusStore({ statuses: next });
        return next;
      });
    },
    []
  );

  // 手动获取全量数据
  const fetchAllAgentStatus = useCallback(async (assistantList?: WeAgentListItem[]) => {
    try {
      // 如果传入了列表，直接用；否则重新获取
      const list = assistantList ?? (await getWeAgentList(DEFAULT_ASSISTANT_LIST_QUERY)).content;
      const assistantAccountList = list.map((item) => item.partnerAccount);
      WeLog(`[AgentStatus] fetchAllAgentStatus | count=${assistantAccountList.length}`);

      const result = await getOnlineStatus(assistantAccountList);
      if (result && result.length > 0) {
        const statuses: Record<string, boolean> = {};
        result.forEach((a) => {
          statuses[a.assistantAccount] = a.status === 'ONLINE';
        });
        setAgentStatusMap(statuses);
        writeAgentOnlineStatusStore({ statuses });
        WeLog(`[AgentStatus] fetchAllAgentStatus success | updated=${result.length}`);
      }
    } catch (error) {
      WeLog(`[AgentStatus] fetchAllAgentStatus failed | error=${String(error)}`);
    }
  }, []);

  // 初始化/刷新：从存储读取， optionally 全量查询
  const initAgentOnlineStatus = useCallback(async () => {
    // 防止移动端首次挂载时 useEffect 和 onShow 重复触发
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    WeLog(`[AgentStatus] initAgentOnlineStatus start`);
    // 从存储读取
    const stored = await readAgentOnlineStatusStore();
    if (stored?.statuses) {
      WeLog(`[AgentStatus] initAgentOnlineStatus from storage | count=${Object.keys(stored.statuses).length}`);
      setAgentStatusMap(stored.statuses);
    } else {
      WeLog(`[AgentStatus] initAgentOnlineStatus no storage data`);
    }

    // 如果配置了 fetchOnInit，则全量查询
    if (fetchOnInit) {
      WeLog(`[AgentStatus] initAgentOnlineStatus fetchOnInit=true, calling fetchAllAgentStatus`);
      await fetchAllAgentStatus();
    }
  }, [fetchOnInit]);

  // 注册 Session Listener
  useEffect(() => {
    const SESSION_ID = 'config_agent';
    WeLog(`[AgentStatus] registerSessionListener | welinkSessionId=${SESSION_ID}`);

    registerSessionListener({
      welinkSessionId: SESSION_ID,
      onMessage: (msg: StreamMessage) => {
        if (!isOpen) {
          WeLog(`[AgentStatus] onMessage | isOpen=${isOpen} fetchAllAgentStatus`);
          setIsOpen(true);
          void fetchAllAgentStatus();
        }
        if (msg.type === 'agent.online') {
          WeLog(`[AgentStatus] onMessage | isOpen=${isOpen} assistantAccount=${msg.assistantAccount}`);
          updateAgentStatus(msg.assistantAccount ?? '', true);
        } else if (msg.type === 'agent.offline') {
          WeLog(`[AgentStatus] onMessage | isOpen=${isOpen} assistantAccount=${msg.assistantAccount}`);
          updateAgentStatus(msg.assistantAccount ?? '', false);
        }
      },
      onClose: () => {
        WeLog(`[AgentStatus] onClose`);
        resetIsOpen();
      },
    });

    // 组件卸载时取消注册
    return () => {
      unregisterSessionListener({ welinkSessionId: SESSION_ID });
    };
  }, [updateAgentStatus]);

  // 初始化
  useEffect(() => {
    void initAgentOnlineStatus();
  }, [initAgentOnlineStatus]);

  // 注册 App 生命周期
  useEffect(() => {
    if (isPcMiniApp()) {
      // PC 端监听自定义事件，允许多次触发直接拉数据
      const handleAgentLogin = () => {
        WeLog(`[handleAgentLogin] agent_login`);
        void fetchAllAgentStatus();
      };
      window.addEventListener('agent_login', handleAgentLogin);
      return () => {
        window.removeEventListener('agent_login', handleAgentLogin);
      };
    } else {
      // 移动端监听 onShow
      window.HWH5?.app?.({
        onShow: () => {
          WeLog(`[app] onShow`);
          // 允许 onShow 后续重新初始化
          initializedRef.current = false;
          // 先重新初始化（读存储、拉数据）
          void initAgentOnlineStatus();
          // 再监听网络变化
          window.HWH5?.onNetworkStatusChange?.((res) => {
            WeLog(`[app] onNetworkStatusChange isConnected=${res.isConnected}`);
            if (res.isConnected) {
              void fetchAllAgentStatus();
            }
          });
        },
        onHide: () => {
          WeLog(`[app] onNetworkStatusChange onHide`);
          window.HWH5?.unregisterNetworkListener?.().catch(() => {
            // ignore error
          });
        },
      });
    }
  }, [fetchAllAgentStatus, initAgentOnlineStatus]);

  const resetIsOpen = useCallback(() => setIsOpen(false), []);

  return {
    agentStatusMap,
    isOpen,
    fetchAllAgentStatus,
    updateAgentStatus,
    resetIsOpen,
    getAgentStatus: (partnerAccount: string) => agentStatusMap[partnerAccount],
  };
}
