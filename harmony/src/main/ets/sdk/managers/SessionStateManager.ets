import { Logger } from '../utils/Logger';
import {
  OnSessionStatusChangeParams,
  SessionStatus,
  SessionStatusResult,
  StreamMessage
} from '../types';

/**
 * Session status mapper:
 * - maps raw stream events to SDK status (`executing|stopped|completed`)
 * - dispatches callbacks per session
 */
export class SessionStateManager {
  private readonly logger: Logger;
  private readonly callbacks: Map<number, (result: SessionStatusResult) => void> = new Map();
  private readonly statuses: Map<number, SessionStatus> = new Map();

  constructor(enableLog: boolean = false) {
    this.logger = new Logger('SessionStateManager', enableLog);
  }

  setEnableLog(enable: boolean): void {
    this.logger.setEnabled(enable);
  }

  register(params: OnSessionStatusChangeParams): void {
    this.callbacks.set(params.welinkSessionId, params.callback);
  }

  clearSession(sessionId: number): void {
    this.callbacks.delete(sessionId);
    this.statuses.delete(sessionId);
  }

  clearAll(): void {
    this.callbacks.clear();
    this.statuses.clear();
  }

  forceStatus(sessionId: number, status: SessionStatus): void {
    this.emitIfChanged(sessionId, status);
  }

  onStreamMessage(message: StreamMessage): void {
    const sessionId = this.parseSessionId(message.welinkSessionId);
    if (sessionId === null) {
      return;
    }

    const mapped = this.mapStatus(message);
    if (mapped === null) {
      return;
    }
    this.emitIfChanged(sessionId, mapped);
  }

  private mapStatus(message: StreamMessage): SessionStatus | null {
    switch (message.type) {
      case 'step.start':
      case 'text.delta':
      case 'thinking.delta':
      case 'tool.update':
      case 'question':
      case 'permission.ask':
      case 'file':
        return SessionStatus.EXECUTING;
      case 'session.status':
        if (message.sessionStatus === 'busy' || message.sessionStatus === 'retry') {
          return SessionStatus.EXECUTING;
        }
        if (message.sessionStatus === 'idle') {
          return SessionStatus.COMPLETED;
        }
        return null;
      case 'permission.reply':
        if (message.response === 'reject') {
          return SessionStatus.STOPPED;
        }
        return SessionStatus.EXECUTING;
      case 'step.done':
      case 'text.done':
      case 'thinking.done':
        return SessionStatus.COMPLETED;
      case 'session.error':
      case 'error':
      case 'agent.offline':
        return SessionStatus.STOPPED;
      default:
        return null;
    }
  }

  private emitIfChanged(sessionId: number, status: SessionStatus): void {
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

  private parseSessionId(welinkSessionId: string): number | null {
    const parsed = Number(welinkSessionId);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }
}
