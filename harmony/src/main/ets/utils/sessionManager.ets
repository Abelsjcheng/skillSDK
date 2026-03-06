import { SkillSDKConfig, SessionState } from '../types';
import { WebSocketManager } from '../websocket/webSocketManager';
import { HttpClient } from '../utils/httpClient';

export class SessionManager {
  private static instance: SessionManager;
  private config: SkillSDKConfig;
  private httpClient: HttpClient;
  private sessions: Map<string, SessionInfo> = new Map();

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
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.wsManager.close();
      this.sessions.delete(sessionId);
    }
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
}

interface SessionInfo {
  sessionId: string;
  wsManager: WebSocketManager;
  state: SessionState;
}