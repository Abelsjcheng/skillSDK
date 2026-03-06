import { websocket } from '@kit.NetworkKit';
import { StreamMessage, StreamMessageCallback, SessionStatus, SessionStatusCallback } from '../types';

export class WebSocketManager {
  private socket: websocket.WebSocketConnection | null = null;
  private sessionId: string = '';
  private host: string = '';
  private messageCallback: StreamMessageCallback | null = null;
  private statusCallback: SessionStatusCallback | null = null;
  private isConnected: boolean = false;
  private isClosing: boolean = false;

  connect(sessionId: string, host: string, onMessage?: StreamMessageCallback, onStatus?: SessionStatusCallback): Promise<boolean> {
    this.sessionId = sessionId;
    this.host = host;
    this.messageCallback = onMessage || null;
    this.statusCallback = onStatus || null;

    return new Promise((resolve, reject) => {
      const url = `ws://${host}/ws/skill/stream/${sessionId}`;

      websocket.connect(url, (err: Error, connection: websocket.WebSocketConnection) => {
        if (err) {
          reject(err);
          return;
        }

        this.socket = connection;
        this.isConnected = true;
        this.isClosing = false;

        this.socket.on('open', () => {
          resolve(true);
        });

        this.socket.on('message', (data: websocket.WebSocketMessage) => {
          this.handleMessage(data);
        });

        this.socket.on('close', () => {
          this.isConnected = false;
          if (!this.isClosing && this.statusCallback) {
            this.statusCallback(SessionStatus.STOPPED);
          }
        });

        this.socket.on('error', (err: Error) => {
          this.isConnected = false;
          if (this.statusCallback) {
            this.statusCallback(SessionStatus.STOPPED);
          }
        });
      });
    });
  }

  private handleMessage(data: websocket.WebSocketMessage): void {
    if (data.data && this.messageCallback) {
      try {
        const message = JSON.parse(data.data as string) as StreamMessage;
        this.messageCallback(message);

        if (message.type === 'delta' && this.statusCallback) {
          this.statusCallback(SessionStatus.EXECUTING);
        } else if (message.type === 'done' && this.statusCallback) {
          this.statusCallback(SessionStatus.COMPLETED);
        } else if (message.type === 'error' && this.statusCallback) {
          this.statusCallback(SessionStatus.STOPPED);
        } else if (message.type === 'agent_offline' && this.statusCallback) {
          this.statusCallback(SessionStatus.STOPPED);
        } else if (message.type === 'agent_online' && this.statusCallback) {
          this.statusCallback(SessionStatus.EXECUTING);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    }
  }

  close(): void {
    this.isClosing = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  isActive(): boolean {
    return this.isConnected;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setMessageCallback(callback: StreamMessageCallback): void {
    this.messageCallback = callback;
  }

  setStatusCallback(callback: SessionStatusCallback): void {
    this.statusCallback = callback;
  }
}