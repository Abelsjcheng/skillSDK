/**
 * 助手在线状态管理 Hook
 * 先从存储读取，再调用接口更新
 */

import { useCallback, useEffect, useState } from 'react';
import { getOnlineStatus } from '../utils/hwext';
import {
  readAgentOnlineStatusStore,
  writeAgentOnlineStatusStore,
} from '../utils/agentOnlineStatusStore';

type AgentStatusMap = Record<string, boolean>;

export function useAgentOnlineStatus() {
  const [agentStatusMap, setAgentStatusMap] = useState<AgentStatusMap>({});
  const [isOpen, setIsOpen] = useState(false);

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

  // 初始化：先从存储读取，再调用接口更新
  useEffect(() => {
    const init = async () => {
      // 1. 先从存储读取
      const stored = await readAgentOnlineStatusStore();
      if (stored?.statuses) {
        setAgentStatusMap(stored.statuses);
      }

      // 2. 调用接口获取最新数据
      await fetchAllAgentStatus();

      // 3. 设置 isOpen=true
      setIsOpen(true);
    };
    init();
  }, [fetchAllAgentStatus]);

  // 注册 App 生命周期
  useEffect(() => {
    window.HWH5?.app?.({
      onShow: () => {
        // onShow 时注册网络状态监听
        window.HWH5?.onNetworkStatusChange?.((res) => {
          if (res.isConnected) {
            void fetchAllAgentStatus();
          }
        });
      },
      onHide: () => {
        // onHide 时取消网络状态监听
        window.HWH5?.unregisterNetworkListener?.().catch(() => {
          // ignore error
        });
      },
    });
  }, [fetchAllAgentStatus]);

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
