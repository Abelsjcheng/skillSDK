import type { WeAgentSessionUnreadState } from './bridge';

export interface WeAgentUnreadCache {
  redDotVisible: boolean;
  sessionsById: Record<string, WeAgentSessionUnreadState>;
}
