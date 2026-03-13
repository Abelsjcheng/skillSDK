import { Logger } from '../utils/Logger';
import {
  OnSessionStatusChangeParams,
  SessionStatus,
  SessionStatusResult,
  StreamMessage
} from '../types';

/**
 * Session status mapper:
 * - maps `session.status` stream events to SDK status (`executing|stopped|completed`)
 * - dispatches callbacks per session
 */
export class SessionStateManager {
  private readonly logger: Logger;
  private readonly callbacks: Map<string, (result: SessionStatusResult) => void> = new Map();
  private readonly statuses: Map<string, SessionStatus> = new Map();
  private readonly sendMessageTriggeredBySession: Map<string, boolean> = new Map();

  constructor(enableLog: boolean = false) {
    this.logger = new Logger('SessionStateManager', enableLog);
  }

  setEnableLog(enable: boolean): void {
    this.logger.setEnabled(enable);
  }

  register(params: OnSessionStatusChangeParams): void {
    this.callbacks.set(params.welinkSessionId, params.callback);
  }

  clearSession(sessionId: string): void {
    this.callbacks.delete(sessionId);
    this.statuses.delete(sessionId);
    this.sendMessageTriggeredBySession.delete(sessionId);
  }

  clearAll(): void {
    this.callbacks.clear();
    this.statuses.clear();
    this.sendMessageTriggeredBySession.clear();
  }

  markSendMessageTriggered(sessionId: string): void {
    this.sendMessageTriggeredBySession.set(sessionId, true);
  }

  clearSendMessageTrigger(sessionId: string): void {
    this.sendMessageTriggeredBySession.set(sessionId, false);
  }

  forceStatus(sessionId: string, status: SessionStatus): void {
    if (status === SessionStatus.STOPPED) {
      this.sendMessageTriggeredBySession.set(sessionId, false);
    }
    this.emitIfChanged(sessionId, status);
  }

  onStreamMessage(message: StreamMessage): void {
    const sessionId = message.welinkSessionId?.trim();
    if (sessionId === undefined || sessionId === '') {
      return;
    }

    const mapped = this.mapStatus(sessionId, message);
    if (mapped === null) {
      return;
    }
    this.emitIfChanged(sessionId, mapped);
  }

  private mapStatus(sessionId: string, message: StreamMessage): SessionStatus | null {
    if (message.type !== 'session.status') {
      return null;
    }

    if (message.sessionStatus === 'busy' || message.sessionStatus === 'retry') {
      if (this.sendMessageTriggeredBySession.get(sessionId) === true) {
        return SessionStatus.EXECUTING;
      }
      return null;
    }

    if (message.sessionStatus === 'idle') {
      this.sendMessageTriggeredBySession.set(sessionId, false);
      return SessionStatus.COMPLETED;
    }

    return null;
  }

  private emitIfChanged(sessionId: string, status: SessionStatus): void {
    const current = this.statuses.get(sessionId);
    if (current === status) {
      return;
    }

    this.statuses.set(sessionId, status);
    const callback = this.callbacks.get(sessionId);
    if (callback === undefined) {
      return;
    }

    try {
      callback({ status });
    } catch (error) {
      this.logger.warn(`status callback failed for session=${sessionId}`, error);
    }
  }
}
