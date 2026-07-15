import * as environment from '../constants';

export const API_ROOTS = {
  uat: 'https://www.example-beta.com/mag',
  prod: 'https://www.example.com/mag',
} as const;

export const API_PATHS = {
  deleteHistorySession: (sessionId: string) => `/api/skill/sessions/${encodeURIComponent(sessionId)}`,
  onlineStatus: '/api/skill/sessions/onlinestatus',
  onlineStatusFeature: '/api/skill/sessions/showonlineStatus',
} as const;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiRoot(): string {
  return environment.isProEnv() ? API_ROOTS.prod : API_ROOTS.uat;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimTrailingSlash(getApiRoot())}${normalizedPath}`;
}

export function buildDeleteHistorySessionUrl(sessionId: string): string {
  return buildApiUrl(API_PATHS.deleteHistorySession(sessionId));
}

export function buildOnlineStatusUrl(): string {
  return buildApiUrl(API_PATHS.onlineStatus);
}

export function buildOnlineStatusFeatureUrl(): string {
  return buildApiUrl(API_PATHS.onlineStatusFeature);
}
