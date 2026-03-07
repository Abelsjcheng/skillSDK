import { SkillSDKConfig, SessionState, SessionListener, ChatMessage } from '../types';
import { WebSocketManager } from '../websocket/webSocketManager';
import { HttpClient } from '../utils/httpClient';
import { StreamingMessageCache } from './streamingMessageCache';

export class SessionManager {
  private static instance: SessionManager;
  private config: SkillSDKConfig;
  private httpClient: HttpClient;
  private sessions: Map<string, SessionInfo> = new Map();
  private streamingCaches: Map<string, StreamingMessageCache> = new Map();

  private constructor(config: SkillSDKConfig) {
    this.config = config;
    this.httpClient = new HttpClient(config.baseUrl);
  }

  static getInstance(config: SkillSDKConfig): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(config);
    }
    return SessionManager.instance;
  }

  getHttpClient(): HttpClient {
    return this.httpClient;
  }

  getWebSocketHost(): string {
    return this.config.webSocketHost || this.config.baseUrl.replace('http://', '').replace('https://', '');
  }

  getSkillDefinitionId(): number {
    return this.config.skillDefinitionId;
  }

  addSession(sessionId: string, wsManager: WebSocketManager): void {
    this.sessions.set(sessionId, {
      sessionId,
      wsManager,
      state: SessionState.ACTIVE
    });
    this.streamingCaches.set(sessionId, new StreamingMessageCache(sessionId));
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.wsManager.close();
      this.sessions.delete(sessionId);
    }
    this.streamingCaches.delete(sessionId);
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): Map<string, SessionInfo> {
    return this.sessions;
  }

  updateSessionState(sessionId: string, state: SessionState): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
    }
  }

  getStreamingCache(sessionId: string): StreamingMessageCache | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      return session.wsManager.getStreamingCache();
    }
    return undefined;
  }

  hasStreamingMessage(sessionId: string): boolean {
    const cache = this.getStreamingCache(sessionId);
    return cache ? cache.hasStreamingMessage() : false;
  }

  mergeStreamingMessage(sessionId: string, historyMessages: ChatMessage[]): ChatMessage[] {
    const cache = this.getStreamingCache(sessionId);
    if (cache) {
      return cache.mergeWithHistory(historyMessages);
    }
    return historyMessages;
  }
}

