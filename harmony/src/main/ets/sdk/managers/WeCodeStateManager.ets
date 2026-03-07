/**
 * WeCode State Manager
 * 小程序状态管理器，管理小程序状态变更回调
 */

import { SkillWecodeStatus, SkillWecodeStatusResult } from '../types';

export class WeCodeStateManager {
  // 小程序状态变更回调列表
  private wecodeStatusCallbacks: ((result: SkillWecodeStatusResult) => void)[] = [];
  
  private enableLog: boolean;

  constructor(enableLog: boolean = false) {
    this.enableLog = enableLog;
  }

  /**
   * 注册小程序状态变更回调
   */
  registerCallback(callback: (result: SkillWecodeStatusResult) => void): void {
    // 检查是否已存在相同的回调
    const exists = this.wecodeStatusCallbacks.some(cb => cb === callback);
    if (!exists) {
      this.wecodeStatusCallbacks.push(callback);
      
      if (this.enableLog) {
        console.log('[WeCodeStateManager] Callback registered');
      }
    }
  }

  /**
   * 移除小程序状态变更回调
   */
  unregisterCallback(callback: (result: SkillWecodeStatusResult) => void): void {
    const index = this.wecodeStatusCallbacks.indexOf(callback);
    if (index !== -1) {
      this.wecodeStatusCallbacks.splice(index, 1);
      
      if (this.enableLog) {
        console.log('[WeCodeStateManager] Callback removed');
      }
    }
  }

  /**
   * 触发小程序状态变更回调
   */
  notifyStatusChange(status: SkillWecodeStatus, message?: string): void {
    const result: SkillWecodeStatusResult = {
      status: status,
      timestamp: Date.now(),
      message: message
    };

    this.wecodeStatusCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        if (this.enableLog) {
          console.error(`[WeCodeStateManager] Callback error: ${error}`);
        }
      }
    });

    if (this.enableLog) {
      console.log(`[WeCodeStateManager] Status changed: ${status}`);
    }
  }

  /**
   * 清除所有回调
   */
  clearAllCallbacks(): void {
    this.wecodeStatusCallbacks = [];
    
    if (this.enableLog) {
      console.log('[WeCodeStateManager] All callbacks cleared');
    }
  }

  /**
   * 更新日志开关
   */
  setEnableLog(enable: boolean): void {
    this.enableLog = enable;
  }
}