/**
 * WebSocket 管理器
 * 基于 HarmonyOS API 20 WebSocket 接口实现
 */
import { webSocket } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { util } from '@kit.ArkTS';
import {
  StreamMessage,
  StreamMessageCallback,
  SessionStatus,
  SessionStatusCallback,
  SessionStatusResult,
  SessionError
} from '../types';
import { StreamingMessageCache } from '../utils/streamingMessageCache';

/**
 * WebSocket 连接状态
 */
enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  CLOSING = 'CLOSING'
}

/**
 * WebSocket 管理器类
 * 负责管理 WebSocket 连接、消息收发和事件处理
 */
export class WebSocketManager {
  private ws: webSocket.WebSocket | null = null;
  private sessionId: string = '';
  private host: string = '';
  private messageCallback: StreamMessageCallback | null = null;
  private statusCallback: SessionStatusCallback | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private isClosing: boolean = false;
  private streamingCache: StreamingMessageCache | null = null;

  /**
   * 连接 WebSocket
   * @param sessionId 会话ID
   * @param host WebSocket 主机地址
   * @param onMessage 消息回调
   * @param onStatus 状态回调
   * @returns Promise<boolean> 连接结果
   */
  connect(
    sessionId: string,
    host: string,
    onMessage?: StreamMessageCallback,
    onStatus?: SessionStatusCallback
  ): Promise<boolean> {
    this.sessionId = sessionId;
    this.host = host;
    this.messageCallback = onMessage || null;
    this.statusCallback = onStatus || null;
    this.streamingCache = new StreamingMessageCache(sessionId);

    return new Promise((resolve, reject) => {
      try {
        // 创建 WebSocket 实例 (API 20 接口)
        this.ws = webSocket.createWebSocket();
        this.connectionState = ConnectionState.CONNECTING;

        // 设置事件处理器
        this.setupEventHandlers(resolve, reject);

        // 构建 WebSocket URL
        const url = `ws://${host}:8082/ws/skill/stream/${sessionId}`;

        // 发起连接
        this.ws.connect(url, (err: BusinessError, value: boolean) => {
          if (err) {
            this.connectionState = ConnectionState.DISCONNECTED;
            reject(new Error(`WebSocket connect failed: ${err.message}`));
            return;
          }
          // 连接成功，等待 'open' 事件
        });
      } catch (e) {
        this.connectionState = ConnectionState.DISCONNECTED;
        reject(e);
      }
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(
    resolve: (value: boolean) => void,
    reject: (reason: Error) => void
  ): void {
    if (!this.ws) {
      return;
    }

    // 连接打开事件
    this.ws.on('open', (err: BusinessError, value: Object) => {
      if (err) {
        this.connectionState = ConnectionState.DISCONNECTED;
        reject(new Error(`WebSocket open failed: ${err.message}`));
        return;
      }
      this.connectionState = ConnectionState.CONNECTED;
      this.isClosing = false;
      resolve(true);
    });

    // 消息接收事件
    this.ws.on('message', (err: BusinessError, value: string | ArrayBuffer) => {
      if (err) {
        console.error('WebSocket message error:', JSON.stringify(err));
        return;
      }
      this.handleMessage(value);
    });

    // 连接关闭事件
    this.ws.on('close', (err: BusinessError, value: webSocket.CloseResult) => {
      this.connectionState = ConnectionState.DISCONNECTED;
      console.log(`WebSocket closed. Code: ${value.code}, Reason: ${value.reason}`);
      
      // 非主动关闭时触发停止状态回调
      if (!this.isClosing && this.statusCallback) {
        this.statusCallback({ status: SessionStatus.STOPPED });
      }
    });

    // 错误事件
    this.ws.on('error', (err: BusinessError) => {
      this.connectionState = ConnectionState.DISCONNECTED;
      console.error('WebSocket error:', JSON.stringify(err));
      
      if (this.statusCallback) {
        this.statusCallback({ status: SessionStatus.STOPPED });
      }
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(value: string | ArrayBuffer): void {
    try {
      let message: StreamMessage;
      
      if (typeof value === 'string') {
        message = JSON.parse(value) as StreamMessage;
      } else if (value instanceof ArrayBuffer) {
        const decoder = new util.TextDecoder('utf-8');
        const text = decoder.decodeToString(new Uint8Array(value));
        message = JSON.parse(text) as StreamMessage;
      } else {
        return;
      }

      if (this.streamingCache) {
        this.streamingCache.updateFromStreamMessage(message);
      }

      if (this.messageCallback) {
        this.messageCallback(message);
      }

      this.updateStatusByMessageType(message.type);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }

  /**
   * 根据消息类型更新会话状态
   */
  private updateStatusByMessageType(type: string): void {
    if (!this.statusCallback) {
      return;
    }

    switch (type) {
      case 'delta':
        this.statusCallback({ status: SessionStatus.EXECUTING });
        break;
      case 'done':
        this.statusCallback({ status: SessionStatus.COMPLETED });
        break;
      case 'error':
        this.statusCallback({ status: SessionStatus.STOPPED });
        break;
      case 'agent_offline':
        this.statusCallback({ status: SessionStatus.STOPPED });
        break;
      case 'agent_online':
        this.statusCallback({ status: SessionStatus.EXECUTING });
        break;
    }
  }

  /**
   * 发送消息
   * @param data 要发送的数据
   * @returns Promise<boolean> 发送结果
   */
  send(data: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.connectionState !== ConnectionState.CONNECTED) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      this.ws.send(data, (err: BusinessError, value: boolean) => {
        if (err) {
          reject(new Error(`Send failed: ${err.message}`));
          return;
        }
        resolve(value);
      });
    });
  }

  /**
   * 关闭 WebSocket 连接
   */
  close(): void {
    if (!this.ws || this.connectionState === ConnectionState.DISCONNECTED) {
      return;
    }

    this.isClosing = true;
    this.connectionState = ConnectionState.CLOSING;

    const closeOptions: webSocket.WebSocketCloseOptions = {
      code: 1000,
      reason: 'Client closing connection'
    };

    this.ws.close(closeOptions, (err: BusinessError, value: boolean) => {
      if (err) {
        console.error('WebSocket close error:', JSON.stringify(err));
      }
      this.connectionState = ConnectionState.DISCONNECTED;
      this.ws = null;
    });
  }

  /**
   * 检查连接是否活跃
   */
  isActive(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 设置消息回调
   */
  setMessageCallback(callback: StreamMessageCallback): void {
    this.messageCallback = callback;
  }

  /**
   * 设置状态回调
   */
  setStatusCallback(callback: SessionStatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 获取流式消息缓存
   */
  getStreamingCache(): StreamingMessageCache | null {
    return this.streamingCache;
  }
}