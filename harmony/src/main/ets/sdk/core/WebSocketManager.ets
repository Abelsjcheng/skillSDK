/**
 * WebSocket Manager
 * WebSocket管理器，基于HarmonyOS @kit.NetworkKit实现
 * 单例模式 - 客户端只需建立一个WebSocket连接即可接收所有会话的消息推送
 */

import { webSocket } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { StreamMessage, SessionListener, SkillSDKConfig } from '../types';

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: webSocket.WebSocket | null = null;
  private wsUrl: string;
  private enableLog: boolean;
  private isConnected: boolean = false;
  
  // 会话监听器映射 (sessionId -> listener[])
  private sessionListeners: Map<string, SessionListener[]> = new Map();
  
  // 内部缓存监听器 - 用于缓存流式消息数据
  private internalCacheListener: ((message: StreamMessage) => void) | null = null;
  
  private constructor(config: SkillSDKConfig) {
    this.wsUrl = config.wsUrl;
    this.enableLog = config.enableLog || false;
  }

  /**
   * 获取单例实例
   */
  static getInstance(config: SkillSDKConfig): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager(config);
    }
    return WebSocketManager.instance;
  }

  /**
   * 设置内部缓存监听器
   */
  setInternalCacheListener(listener: (message: StreamMessage) => void): void {
    this.internalCacheListener = listener;
  }

  /**
   * 连接WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.ws) {
      if (this.enableLog) {
        console.log('[WebSocketManager] Already connected');
      }
      return;
    }

    try {
      this.ws = webSocket.createWebSocket();
      this.setupEventHandlers();
      
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not created'));
          return;
        }

        this.ws.connect(this.wsUrl, (err: BusinessError, value: boolean) => {
          if (!err) {
            if (this.enableLog) {
              console.log('[WebSocketManager] Connected successfully');
            }
            this.isConnected = true;
            resolve();
          } else {
            if (this.enableLog) {
              console.error(`[WebSocketManager] Connect failed: ${JSON.stringify(err)}`);
            }
            reject(new Error(err.message));
          }
        });
      });
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) {
      return;
    }

    // 连接打开事件
    this.ws.on('open', (err: BusinessError, value: Object) => {
      if (err) {
        if (this.enableLog) {
          console.error(`[WebSocketManager] Open error: ${JSON.stringify(err)}`);
        }
        this.notifyError(err.message, 'CONNECTION_ERROR');
        return;
      }
      if (this.enableLog) {
        console.log('[WebSocketManager] Connection opened');
      }
      this.isConnected = true;
    });

    // 消息接收事件
    this.ws.on('message', (err: BusinessError, value: string | ArrayBuffer) => {
      if (err) {
        if (this.enableLog) {
          console.error(`[WebSocketManager] Message error: ${JSON.stringify(err)}`);
        }
        this.notifyError(err.message, 'MESSAGE_ERROR');
        return;
      }

      try {
        const messageStr = typeof value === 'string' ? value : this.arrayBufferToString(value);
        const message: StreamMessage = JSON.parse(messageStr);
        
        if (this.enableLog) {
          console.log(`[WebSocketManager] Received message: ${messageStr}`);
        }

        // 1. 首先通知内部缓存监听器
        if (this.internalCacheListener) {
          this.internalCacheListener(message);
        }

        // 2. 然后分发给会话监听器
        this.dispatchMessage(message);
      } catch (error) {
        if (this.enableLog) {
          console.error(`[WebSocketManager] Parse message error: ${error}`);
        }
      }
    });

    // 连接关闭事件
    this.ws.on('close', (err: BusinessError, value: webSocket.CloseResult) => {
      if (this.enableLog) {
        console.log(`[WebSocketManager] Connection closed: code=${value.code}, reason=${value.reason}`);
      }
      this.isConnected = false;
      this.notifyAllClose(`Connection closed: ${value.reason}`);
    });

    // 错误事件
    this.ws.on('error', (err: BusinessError) => {
      if (this.enableLog) {
        console.error(`[WebSocketManager] Error: ${JSON.stringify(err)}`);
      }
      this.notifyError(err.message, 'SOCKET_ERROR');
    });
  }

  /**
   * 分发消息到对应的会话监听器
   */
  private dispatchMessage(message: StreamMessage): void {
    const sessionId = message.sessionId;
    if (!sessionId) {
      return;
    }

    const listeners = this.sessionListeners.get(sessionId);
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => {
        try {
          listener.onMessage(message);
        } catch (error) {
          if (this.enableLog) {
            console.error(`[WebSocketManager] Listener callback error: ${error}`);
          }
        }
      });
    }
  }

  /**
   * 通知所有监听器错误
   */
  private notifyError(message: string, code: string): void {
    this.sessionListeners.forEach((listeners) => {
      listeners.forEach(listener => {
        if (listener.onError) {
          try {
            listener.onError({
              code: code,
              message: message,
              timestamp: Date.now()
            });
          } catch (error) {
            if (this.enableLog) {
              console.error(`[WebSocketManager] Error callback failed: ${error}`);
            }
          }
        }
      });
    });
  }

  /**
   * 通知所有监听器连接关闭
   */
  private notifyAllClose(reason: string): void {
    this.sessionListeners.forEach((listeners) => {
      listeners.forEach(listener => {
        if (listener.onClose) {
          try {
            listener.onClose(reason);
          } catch (error) {
            if (this.enableLog) {
              console.error(`[WebSocketManager] Close callback failed: ${error}`);
            }
          }
        }
      });
    });
  }

  /**
   * 注册会话监听器
   */
  registerSessionListener(sessionId: string, listener: SessionListener): void {
    if (!this.sessionListeners.has(sessionId)) {
      this.sessionListeners.set(sessionId, []);
    }
    const listeners = this.sessionListeners.get(sessionId)!;
    
    // 检查是否已存在相同的监听器
    const exists = listeners.some(l => l.onMessage === listener.onMessage);
    if (!exists) {
      listeners.push(listener);
      if (this.enableLog) {
        console.log(`[WebSocketManager] Listener registered for session: ${sessionId}`);
      }
    }
  }

  /**
   * 移除会话监听器
   */
  unregisterSessionListener(sessionId: string, listener: Partial<SessionListener>): void {
    const listeners = this.sessionListeners.get(sessionId);
    if (!listeners) {
      return;
    }

    const index = listeners.findIndex(l => l.onMessage === listener.onMessage);
    if (index !== -1) {
      listeners.splice(index, 1);
      if (this.enableLog) {
        console.log(`[WebSocketManager] Listener removed for session: ${sessionId}`);
      }
      
      // 如果没有监听器了，移除整个会话
      if (listeners.length === 0) {
        this.sessionListeners.delete(sessionId);
      }
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (!this.ws || !this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        resolve();
        return;
      }

      this.ws.close((err: BusinessError) => {
        if (!err) {
          if (this.enableLog) {
            console.log('[WebSocketManager] Disconnected successfully');
          }
          this.isConnected = false;
          this.ws = null;
          resolve();
        } else {
          if (this.enableLog) {
            console.error(`[WebSocketManager] Disconnect failed: ${JSON.stringify(err)}`);
          }
          reject(new Error(err.message));
        }
      });
    });
  }

  /**
   * 检查连接状态
   */
  isActive(): boolean {
    return this.isConnected && this.ws !== null;
  }

  /**
   * ArrayBuffer转字符串
   */
  private arrayBufferToString(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let result = '';
    for (let i = 0; i < uint8Array.length; i++) {
      result += String.fromCharCode(uint8Array[i]);
    }
    return result;
  }

  /**
   * 清理所有监听器
   */
  clearAllListeners(): void {
    this.sessionListeners.clear();
    if (this.enableLog) {
      console.log('[WebSocketManager] All listeners cleared');
    }
  }
}