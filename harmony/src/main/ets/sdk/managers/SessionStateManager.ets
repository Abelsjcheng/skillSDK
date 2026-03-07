/**
 * Session State Manager
 * 会话状态管理器，管理会话状态变更回调
 */

import { SessionStatus, SessionStatusResult, StreamMessage } from '../types';

export class SessionStateManager {
  // 会话状态变更回调映射 (sessionId -> callback)
  private statusCallbacks: Map<string, (result: SessionStatusResult) => void> = new Map();
  
  // 会话当前状态映射 (sessionId -> SessionStatus)
  private sessionStatuses: Map<string, SessionStatus> = new Map();
  
  private enableLog: boolean;

  constructor(enableLog: boolean = false) {
    this.enableLog = enableLog;
  }

  /**
   * 注册会话状态变更回调
   */
  registerCallback(sessionId: string, callback: (result: SessionStatusResult) => void): void {
    this.statusCallbacks.set(sessionId, callback);
    
    if (this.enableLog) {
      console.log(`[SessionStateManager] Callback registered for session: ${sessionId}`);
    }
  }

  /**
   * 移除会话状态变更回调
   */
  unregisterCallback(sessionId: string): void {
    this.statusCallbacks.delete(sessionId);
    this.sessionStatuses.delete(sessionId);
    
    if (this.enableLog) {
      console.log(`[SessionStateManager] Callback removed for session: ${sessionId}`);
    }
  }

  /**
   * 根据WebSocket消息更新会话状态并触发回调
   */
  updateStatusFromMessage(message: StreamMessage): void {
    const sessionId = message.sessionId;
    if (!sessionId) {
      return;
    }

    let newStatus: SessionStatus | null = null;

    switch (message.type) {
      case 'delta':
        newStatus = SessionStatus.EXECUTING;
        break;
      case 'done':
        newStatus = SessionStatus.COMPLETED;
        break;
      case 'error':
      case 'agent_offline':
        newStatus = SessionStatus.STOPPED;
        break;
      case 'agent_online':
        newStatus = SessionStatus.EXECUTING;
        break;
      default:
        return;
    }

    // 检查状态是否变化
    const currentStatus = this.sessionStatuses.get(sessionId);
    if (currentStatus === newStatus) {
      return; // 状态未变化，不触发回调
    }

    // 更新状态
    this.sessionStatuses.set(sessionId, newStatus);

    // 触发回调
    const callback = this.statusCallbacks.get(sessionId);
    if (callback) {
      try {
        callback({ status: newStatus });
        
        if (this.enableLog) {
          console.log(`[SessionStateManager] Status changed for session ${sessionId}: ${newStatus}`);
        }
      } catch (error) {
        if (this.enableLog) {
          console.error(`[SessionStateManager] Callback error: ${error}`);
        }
      }
    }
  }

  /**
   * 获取会话当前状态
   */
  getStatus(sessionId: string): SessionStatus | null {
    return this.sessionStatuses.get(sessionId) || null;
  }

  /**
   * 设置会话状态（手动设置）
   */
  setStatus(sessionId: string, status: SessionStatus): void {
    const currentStatus = this.sessionStatuses.get(sessionId);
    if (currentStatus === status) {
      return;
    }

    this.sessionStatuses.set(sessionId, status);

    const callback = this.statusCallbacks.get(sessionId);
    if (callback) {
      try {
        callback({ status: status });
        
        if (this.enableLog) {
          console.log(`[SessionStateManager] Status manually set for session ${sessionId}: ${status}`);
        }
      } catch (error) {
        if (this.enableLog) {
          console.error(`[SessionStateManager] Callback error: ${error}`);
        }
      }
    }
  }

  /**
   * 清除所有回调
   */
  clearAllCallbacks(): void {
    this.statusCallbacks.clear();
    this.sessionStatuses.clear();
    
    if (this.enableLog) {
      console.log('[SessionStateManager] All callbacks cleared');
    }
  }

  /**
   * 更新日志开关
   */
  setEnableLog(enable: boolean): void {
    this.enableLog = enable;
  }
}