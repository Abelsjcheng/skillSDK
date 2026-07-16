/**
 * 助手在线状态管理 Hook
 * 先从存储读取，再调用接口更新
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isPcMiniApp } from '../constants';
import {
  getOnlineStatus,
  isOnlineStatusEnabled,
  registerSessionListener,
  unregisterSessionListener,
} from '../utils/hwext';
import type { StreamMessage } from '../types';
import {
  readAgentOnlineStatusStore,
  writeAgentOnlineStatusStore,
} from '../utils/agentOnlineStatusStore';

type AgentStatusMap = Record<string, boolean>;

export function useAgentOnlineStatus() {
  const [agentStatusMap, setAgentStatusMap] = useState<AgentStatusMap>({});
  const [isOpen, setIsOpen] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);
  const initializedRef = useRef(false);

  // 更新单个助手状态（写入存储）
  const updateAgentStatus = useCallback(
    async (partnerAccount: string, isOnline: boolean) => {
      setAgentStatusMap((prev) => {
        const next = { ...prev, [partnerAccount]: isOnline };
        void writeAgentOnlineStatusStore({ statuses: next });
        return next;
      });
    },
    []
  );

  // 手动获取全量数据
  const fetchAllAgentStatus = useCallback(async () => {
    try {
      const result = await getOnlineStatus();
      if (result?.statuses) {
        setAgentStatusMap(result.statuses);
        await writeAgentOnlineStatusStore({ statuses: result.statuses });
      }
    } catch (error) {
      console.error('fetchAllAgentStatus failed:', error);
    }
  }, []);

  // 初始化/刷新：先查功能开关，再从存储读取，最后调接口更新
  const initAgentOnlineStatus = useCallback(async () => {
    // 防止移动端首次挂载时 useEffect 和 onShow 重复触发
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    // 1. 先查功能开关
    const enabled = await isOnlineStatusEnabled();
    setShowOnlineStatus(enabled);

    if (!enabled) {
      return; // 开关关闭，不拉数据
    }

    // 2. 从存储读取
    const stored = await readAgentOnlineStatusStore();
    if (stored?.statuses) {
      setAgentStatusMap(stored.statuses);
    }

    // 3. 调用接口获取最新数据
    await fetchAllAgentStatus();
  }, [fetchAllAgentStatus]);

  // 注册 Session Listener
  useEffect(() => {
    const SESSION_ID = 'config_agent';

    registerSessionListener({
      welinkSessionId: SESSION_ID,
      onMessage: (msg: StreamMessage) => {
        if (msg.type === 'agent.online') {
          updateAgentStatus(msg.partnerAccount ?? '', true);
        } else if (msg.type === 'agent.offline') {
          updateAgentStatus(msg.partnerAccount ?? '', false);
        }
      },
      onClose: () => {
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
        if (showOnlineStatus) {
          void fetchAllAgentStatus();
        }
      };
      window.addEventListener('agent_login', handleAgentLogin);
      return () => {
        window.removeEventListener('agent_login', handleAgentLogin);
      };
    } else {
      // 移动端监听 onShow
      window.HWH5?.app?.({
        onShow: () => {
          // 允许 onShow 后续重新初始化
          initializedRef.current = false;
          // 先重新初始化（查开关、读存储、拉数据）
          void initAgentOnlineStatus();
          // 再监听网络变化
          window.HWH5?.onNetworkStatusChange?.((res) => {
            if (res.isConnected && showOnlineStatus) {
              void fetchAllAgentStatus();
            }
          });
        },
        onHide: () => {
          window.HWH5?.unregisterNetworkListener?.().catch(() => {
            // ignore error
          });
        },
      });
    }
  }, [fetchAllAgentStatus, showOnlineStatus, initAgentOnlineStatus]);

  const resetIsOpen = useCallback(() => setIsOpen(false), []);

  return {
    agentStatusMap,
    isOpen,
    showOnlineStatus,
    fetchAllAgentStatus,
    updateAgentStatus,
    resetIsOpen,
    getAgentStatus: (partnerAccount: string) => agentStatusMap[partnerAccount],
  };
}
