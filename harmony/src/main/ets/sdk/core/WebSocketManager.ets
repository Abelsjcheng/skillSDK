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

interface SessionRoundBuffer {
  welinkSessionId: string;
  events: StreamMessage[];
  status: 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
}

interface ReplayState {
  replaying: boolean;
  pendingLiveEvents: StreamMessage[];
}

/**
 * WebSocket 单例管理器。
 * 所有会话共用同一条长连接，并按 welinkSessionId 将 onmessage 事件路由给对应监听器。
 */
export class WebSocketManager {
  private static instance: WebSocketManager | null = null;

  private socket: webSocket.WebSocket | null = null;
  private wsUrl: string;
  private readonly logger: Logger;
  private connected: boolean = false;
  private messageHandler: MessageHandler | null = null;
  private listenersBySession: Map<string, SessionListener> = new Map();
  private roundBuffersBySession: Map<string, SessionRoundBuffer> = new Map();
  private replayStatesBySession: Map<string, ReplayState> = new Map();

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
          reject(new SkillSdkException(6000, 'WebSocket connect failed'));
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
          reject(new SkillSdkException(6000, 'WebSocket close failed'));
          return;
        }
        resolve();
      });
    });

    this.connected = false;
    this.socket = null;
  }

  registerSessionListener(sessionId: string, listener: SessionListener): void {
    const key = sessionId;
    const state = this.getOrCreateReplayState(key);
    const buffer = this.roundBuffersBySession.get(key);
    let shouldReplay = false;
    if (buffer !== undefined && buffer.status === 'active' && !state.replaying) {
      // 在监听器正式接收实时消息前，先进入“补发缓存”状态。
      // 这样如果补发启动前后刚好有新的实时消息到达，这些消息会先进入待发送队列，
      // 等缓存补发结束后再继续透传，保证页面拿到的事件顺序稳定不乱序。
      state.replaying = true;
      shouldReplay = true;
    }
    this.listenersBySession.set(key, listener);
    if (shouldReplay) {
      this.replayBufferedEventsIfNeeded(key, state);
    }
  }

  unregisterSessionListener(sessionId: string): void {
    const key = sessionId;
    this.listenersBySession.delete(key);
  }

  clearAllListeners(): void {
    this.listenersBySession.clear();
  }

  clearRoundBuffer(sessionId: string): void {
    this.roundBuffersBySession.delete(sessionId);
    this.replayStatesBySession.delete(sessionId);
  }

  clearAllRoundBuffers(): void {
    this.roundBuffersBySession.clear();
    this.replayStatesBySession.clear();
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

      const rawSessionId = parsed.welinkSessionId;
      if (rawSessionId === undefined || rawSessionId === null || String(rawSessionId) === '') {
        return;
      }
      const sessionId = String(rawSessionId);
      this.appendToRoundBuffer(sessionId, parsed);
      if (this.isRoundTerminationMessage(parsed)) {
        this.markRoundCompleted(sessionId);
      }

      const listener = this.listenersBySession.get(sessionId);
      if (listener === undefined) {
        return;
      }
      if (this.enqueueLiveEventDuringReplay(sessionId, parsed)) {
        return;
      }
      try {
        listener.onMessage(this.copyForDelivery(parsed, 'live', false));
      } catch (listenerError) {
        this.logger.warn('listener onMessage failed', listenerError);
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
    for (const listener of this.listenersBySession.values()) {
      if (listener.onError !== undefined) {
        try {
          listener.onError(payload);
        } catch (error) {
          this.logger.warn('listener onError failed', error);
        }
      }
    }
  }

  private broadcastClose(reason: string): void {
    for (const listener of this.listenersBySession.values()) {
      if (listener.onClose !== undefined) {
        try {
          listener.onClose(reason);
        } catch (error) {
          this.logger.warn('listener onClose failed', error);
        }
      }
    }
  }

  private replayBufferedEventsIfNeeded(sessionId: string, state: ReplayState): void {
    const buffer = this.roundBuffersBySession.get(sessionId);
    if (buffer === undefined || buffer.status !== 'active') {
      state.replaying = false;
      return;
    }
    // 复制一份快照用于补发，避免补发过程中实时事件继续写入 events，
    // 影响当前这次补发的遍历内容和顺序。
    const snapshot = buffer.events.slice();
    const listener = this.listenersBySession.get(sessionId);
    if (listener === undefined) {
      state.replaying = false;
      return;
    }

    for (let index = 0; index < snapshot.length; index++) {
      const message = snapshot[index];
      const isLastReplayMessage = index === snapshot.length - 1;
      listener.onMessage(this.copyForDelivery(message, 'replay', isLastReplayMessage));
    }
    this.flushPendingLiveEvents(sessionId);
  }

  private flushPendingLiveEvents(sessionId: string): void {
    const state = this.replayStatesBySession.get(sessionId);
    if (state === undefined) {
      return;
    }

    while (state.pendingLiveEvents.length > 0) {
      const listener = this.listenersBySession.get(sessionId);
      if (listener === undefined) {
        state.replaying = false;
        return;
      }
      const pendingMessages = state.pendingLiveEvents.splice(0, state.pendingLiveEvents.length);
      pendingMessages.forEach((message: StreamMessage) => {
        listener.onMessage(this.copyForDelivery(message, 'live', false));
      });
    }
    // 只有确认补发期间积压的实时消息已经全部清空，才结束 replaying 状态。
    // 这样可以避免在“准备结束补发”这一瞬间新到的实时消息丢失发送时机。
    state.replaying = false;
  }

  private enqueueLiveEventDuringReplay(sessionId: string, message: StreamMessage): boolean {
    const state = this.replayStatesBySession.get(sessionId);
    if (state === undefined || !state.replaying) {
      return false;
    }
    // 页面层希望收到的是一条连续、有序的事件流。
    // 因此补发期间的新实时消息先暂存，待补发结束后立即继续透传。
    state.pendingLiveEvents.push(message);
    return true;
  }

  private appendToRoundBuffer(sessionId: string, message: StreamMessage): void {
    let buffer = this.roundBuffersBySession.get(sessionId);
    if (buffer === undefined || buffer.status === 'completed') {
      buffer = {
        welinkSessionId: sessionId,
        events: [],
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.roundBuffersBySession.set(sessionId, buffer);
    }
    // SDK 仅缓存服务端原始 onmessage 事件，不在这里做消息聚合。
    // 页面重新注册监听时，先补发这批原始事件，再继续消费后续实时事件，
    // 从而复用现有页面侧的消息拼装与渲染逻辑。
    buffer.events.push(message);
    buffer.updatedAt = Date.now();
  }

  private markRoundCompleted(sessionId: string): void {
    const buffer = this.roundBuffersBySession.get(sessionId);
    if (buffer === undefined) {
      return;
    }
    // 轮次结束后仅保留完成态标记，不再对后续 registerSessionListener 补发这轮缓存。
    // 若页面此时才打开，应通过历史消息接口获取完整结果。
    buffer.status = 'completed';
    buffer.updatedAt = Date.now();
  }

  private isRoundTerminationMessage(message: StreamMessage): boolean {
    if (message.type === 'session.status') {
      return message.sessionStatus === 'idle';
    }
    return message.type === 'session.error'
      || message.type === 'error'
      || message.type === 'agent.offline';
  }

  private getOrCreateReplayState(sessionId: string): ReplayState {
    let state = this.replayStatesBySession.get(sessionId);
    if (state === undefined) {
      state = {
        replaying: false,
        pendingLiveEvents: []
      };
      this.replayStatesBySession.set(sessionId, state);
    }
    return state;
  }

  private copyForDelivery(
    message: StreamMessage,
    deliveryMode: 'replay' | 'live',
    replayDone: boolean
  ): StreamMessage {
    // 这里不使用对象展开语法，避免低版本 Harmony 运行环境兼容性问题。
    // 通过 JSON 深拷贝保留现有顶层字段，再补充 SDK 本地分发字段。
    const cloned = JSON.parse(JSON.stringify(message)) as StreamMessage;
    cloned.deliveryMode = deliveryMode;
    cloned.replayDone = replayDone ? true : undefined;
    return cloned;
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
