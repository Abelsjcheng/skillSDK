import { webSocket } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Logger } from '../utils/Logger';
import {
  SessionError,
  SessionListener,
  SkillSDKConfig,
  StreamMessage,
  SkillSdkException
} from '../types';

type MessageHandler = (message: StreamMessage) => void;

/**
 * Singleton WebSocket manager.
 * One connection is shared by all sessions and listeners.
 */
export class WebSocketManager {
  private static instance: WebSocketManager | null = null;

  private socket: webSocket.WebSocket | null = null;
  private wsUrl: string;
  private readonly logger: Logger;
  private connected: boolean = false;
  private messageHandler: MessageHandler | null = null;
  private listenersBySession: Map<string, SessionListener[]> = new Map();

  private constructor(config: SkillSDKConfig) {
    this.wsUrl = this.resolveWsUrl(config);
    this.logger = new Logger('WebSocketManager', config.enableLog ?? false);
  }

  static getInstance(config: SkillSDKConfig): WebSocketManager {
    if (WebSocketManager.instance === null) {
      WebSocketManager.instance = new WebSocketManager(config);
    }
    return WebSocketManager.instance;
  }

  static destroyInstance(): void {
    WebSocketManager.instance = null;
  }

  updateConfig(config: Partial<SkillSDKConfig>): void {
    if (config.wsUrl !== undefined || config.baseUrl !== undefined) {
      const merged: SkillSDKConfig = {
        baseUrl: config.baseUrl ?? '',
        wsUrl: config.wsUrl,
        enableLog: false
      };
      this.wsUrl = this.resolveWsUrl(merged, this.wsUrl);
    }
    if (config.enableLog !== undefined) {
      this.logger.setEnabled(config.enableLog);
    }
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected && this.socket !== null) {
      return;
    }

    this.socket = webSocket.createWebSocket();
    this.setupSocketEventHandlers(this.socket);

    await new Promise<void>((resolve, reject) => {
      if (this.socket === null) {
        reject(new SkillSdkException(6000, 'WebSocket is not initialized'));
        return;
      }
      this.socket.connect(this.wsUrl, (error: BusinessError) => {
        if (error) {
          reject(new SkillSdkException(6000, 'WebSocket connect failed', error));
          return;
        }
        this.connected = true;
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected || this.socket === null) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      if (this.socket === null) {
        resolve();
        return;
      }
      this.socket.close((error: BusinessError) => {
        if (error) {
          reject(new SkillSdkException(6000, 'WebSocket close failed', error));
          return;
        }
        resolve();
      });
    });

    this.connected = false;
    this.socket = null;
  }

  registerSessionListener(sessionId: number, listener: SessionListener): void {
    const key = String(sessionId);
    if (!this.listenersBySession.has(key)) {
      this.listenersBySession.set(key, []);
    }
    const listeners = this.listenersBySession.get(key) as SessionListener[];
    const exists = listeners.some((item: SessionListener) => item.onMessage === listener.onMessage);
    if (!exists) {
      listeners.push(listener);
    }
  }

  unregisterSessionListener(sessionId: number, listener: Partial<SessionListener>): void {
    const key = String(sessionId);
    const listeners = this.listenersBySession.get(key);
    if (listeners === undefined) {
      return;
    }
    const next = listeners.filter((item: SessionListener) => item.onMessage !== listener.onMessage);
    if (next.length === 0) {
      this.listenersBySession.delete(key);
      return;
    }
    this.listenersBySession.set(key, next);
  }

  clearAllListeners(): void {
    this.listenersBySession.clear();
  }

  private setupSocketEventHandlers(socket: webSocket.WebSocket): void {
    socket.on('open', (error: BusinessError) => {
      if (error) {
        this.broadcastError('WS_OPEN_ERROR', error.message);
        return;
      }
      this.connected = true;
      this.logger.info(`connected: ${this.wsUrl}`);
    });

    socket.on('message', (error: BusinessError, value: string | ArrayBuffer) => {
      if (error) {
        this.broadcastError('WS_MESSAGE_ERROR', error.message);
        return;
      }
      const payload = typeof value === 'string' ? value : this.arrayBufferToString(value);
      let parsed: StreamMessage;
      try {
        parsed = JSON.parse(payload) as StreamMessage;
      } catch (parseError) {
        this.logger.warn('ignore invalid ws message', payload, parseError);
        return;
      }

      if (this.messageHandler !== null) {
        this.messageHandler(parsed);
      }

      const rawSessionId = (parsed as Record<string, unknown>).welinkSessionId;
      if (rawSessionId === undefined || rawSessionId === null || String(rawSessionId) === '') {
        return;
      }
      const listeners = this.listenersBySession.get(String(rawSessionId));
      if (listeners === undefined) {
        return;
      }
      for (const listener of listeners) {
        try {
          listener.onMessage(parsed);
        } catch (listenerError) {
          this.logger.warn('listener onMessage failed', listenerError);
        }
      }
    });

    socket.on('close', (err: BusinessError, value: webSocket.CloseResult) => {
      this.connected = false;
      if (err) {
        this.broadcastError('WS_CLOSE_ERROR', err.message);
      }
      const reason = `code=${value.code}, reason=${value.reason}`;
      this.broadcastClose(reason);
    });

    socket.on('error', (error: BusinessError) => {
      this.broadcastError('WS_ERROR', error.message);
    });
  }

  private broadcastError(code: string, message: string): void {
    const payload: SessionError = {
      code,
      message,
      timestamp: Date.now()
    };
    for (const listeners of this.listenersBySession.values()) {
      for (const listener of listeners) {
        if (listener.onError !== undefined) {
          try {
            listener.onError(payload);
          } catch (error) {
            this.logger.warn('listener onError failed', error);
          }
        }
      }
    }
  }

  private broadcastClose(reason: string): void {
    for (const listeners of this.listenersBySession.values()) {
      for (const listener of listeners) {
        if (listener.onClose !== undefined) {
          try {
            listener.onClose(reason);
          } catch (error) {
            this.logger.warn('listener onClose failed', error);
          }
        }
      }
    }
  }

  private resolveWsUrl(config: SkillSDKConfig, fallback?: string): string {
    if (config.wsUrl !== undefined && config.wsUrl.trim() !== '') {
      return config.wsUrl;
    }
    if (config.baseUrl !== undefined && config.baseUrl.trim() !== '') {
      const normalized = config.baseUrl.replace(/\/$/, '');
      if (normalized.startsWith('https://')) {
        return `${normalized.replace('https://', 'wss://')}/ws/skill/stream`;
      }
      if (normalized.startsWith('http://')) {
        return `${normalized.replace('http://', 'ws://')}/ws/skill/stream`;
      }
    }
    if (fallback !== undefined) {
      return fallback;
    }
    throw new SkillSdkException(1000, 'Unable to resolve WebSocket URL');
  }

  private arrayBufferToString(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    let output = '';
    for (let i = 0; i < view.length; i++) {
      output += String.fromCharCode(view[i]);
    }
    return output;
  }
}
