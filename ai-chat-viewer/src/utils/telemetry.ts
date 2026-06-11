import { isPcMiniApp } from '../constants';
import { getAppInfo, getDeviceInfo, reportUemEvent } from './hwext';
import { WeLog } from './logger';

type TelemetryType = 'ok' | 'error';

interface CommonTelemetryData {
  page?: string;
  entry?: string;
  operationTime?: number;
  assistantAccount?: string;
  welinkSessionId?: string;
}

interface TelemetryEnvelope extends CommonTelemetryData {
  clientType?: string;
  versionName?: string;
  environment?: string;
}

interface ApiTelemetryPayload extends CommonTelemetryData {
  type: TelemetryType;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

interface FlowTelemetryPayload extends CommonTelemetryData {
  type: TelemetryType;
  [key: string]: unknown;
}

interface BrowserErrorTelemetryPayload extends CommonTelemetryData {
  errorType: 'js_error';
  message?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
}

let telemetryBasePromise: Promise<Pick<TelemetryEnvelope, 'clientType' | 'versionName' | 'environment'>> | null = null;

function trimErrorMessage(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function resolveErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = (error as Record<string, unknown>).errorCode
    ?? (error as Record<string, unknown>).code;
  if (candidate === null || candidate === undefined) {
    return undefined;
  }
  return String(candidate);
}

function resolveErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return trimErrorMessage(typeof error === 'string' ? error : undefined);
  }

  const record = error as Record<string, unknown>;
  return trimErrorMessage(
    typeof record.errorMessage === 'string'
      ? record.errorMessage
      : typeof record.message === 'string'
        ? record.message
        : undefined,
  );
}

async function getTelemetryBase(): Promise<Pick<TelemetryEnvelope, 'clientType' | 'versionName' | 'environment'>> {
  if (!telemetryBasePromise) {
    telemetryBasePromise = (async () => {
      try {
        const [deviceInfo, appInfo] = await Promise.all([
          getDeviceInfo().catch(() => ({}) as Record<string, unknown>),
          getAppInfo().catch(() => ({}) as Record<string, unknown>),
        ]);
        return {
          clientType: typeof deviceInfo.osType === 'string' ? deviceInfo.osType.trim() : '',
          versionName: typeof appInfo.versionName === 'string' ? appInfo.versionName.trim() : '',
          environment: typeof appInfo.environment === 'string' ? appInfo.environment.trim() : '',
        };
      } catch {
        return {
          clientType: '',
          versionName: '',
          environment: '',
        };
      }
    })();
  }

  return telemetryBasePromise;
}

async function emitTelemetry(
  eventId: string,
  eventTitle: string,
  data: Record<string, unknown>,
): Promise<void> {
  await reportUemEvent(eventId, eventTitle, {
    entry: 'WeAgent',
    operationTime: Date.now(),
    ...(await getTelemetryBase()),
    ...data,
  });
}

export async function reportApiTelemetry(
  eventId: string,
  eventTitle: string,
  payload: ApiTelemetryPayload,
): Promise<void> {
  try {
    await emitTelemetry(eventId, eventTitle, { ...payload });
  } catch (error) {
    WeLog(`telemetry reportApiTelemetry failed | extra=${JSON.stringify({ eventId, type: payload.type })} | error=${JSON.stringify(error)}`);
  }
}

export async function reportApiSuccess(
  eventId: string,
  eventTitle: string,
  payload: Omit<ApiTelemetryPayload, 'type' | 'errorCode' | 'errorMessage'>,
): Promise<void> {
  await reportApiTelemetry(eventId, eventTitle, {
    ...payload,
    type: 'ok',
  });
}

export async function reportApiError(
  eventId: string,
  eventTitle: string,
  error: unknown,
  payload: Omit<ApiTelemetryPayload, 'type' | 'errorCode' | 'errorMessage' | 'response'>,
): Promise<void> {
  await reportApiTelemetry(eventId, eventTitle, {
    ...payload,
    type: 'error',
    errorCode: resolveErrorCode(error),
    errorMessage: resolveErrorMessage(error),
  });
}

export async function reportFlowTelemetry(
  eventId: string,
  eventTitle: string,
  payload: FlowTelemetryPayload,
): Promise<void> {
  try {
    await emitTelemetry(eventId, eventTitle, payload);
  } catch (error) {
    WeLog(`telemetry reportFlowTelemetry failed | extra=${JSON.stringify({ eventId, type: payload.type })} | error=${JSON.stringify(error)}`);
  }
}

export async function reportBrowserJsError(
  payload: BrowserErrorTelemetryPayload,
): Promise<void> {
  await reportFlowTelemetry('browser_js_error', '浏览器 JS 报错', {
    type: 'error',
    ...payload,
  });
}

export function installBrowserJsErrorTelemetry(
  getContext: () => Pick<BrowserErrorTelemetryPayload, 'page' | 'assistantAccount' | 'welinkSessionId'>,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  let lastFingerprint = '';
  let lastReportedAt = 0;
  const throttleWindow = 3000;

  const handleWindowError = (event: ErrorEvent) => {
    const fingerprint = [
      event.message ?? '',
      event.filename ?? '',
      String(event.lineno ?? ''),
      String(event.colno ?? ''),
    ].join('|');
    const now = Date.now();
    if (fingerprint && fingerprint === lastFingerprint && now - lastReportedAt < throttleWindow) {
      return;
    }
    lastFingerprint = fingerprint;
    lastReportedAt = now;

    const context = getContext();
    void reportBrowserJsError({
      ...context,
      errorType: 'js_error',
      message: trimErrorMessage(event.message),
      filename: trimErrorMessage(event.filename, 300),
      lineno: event.lineno,
      colno: event.colno,
      stack: trimErrorMessage(event.error?.stack, 1000),
    });
  };

  window.addEventListener('error', handleWindowError);
  return () => {
    window.removeEventListener('error', handleWindowError);
  };
}

export function getDefaultTelemetryPage(page: string): string {
  return page;
}

export function isTelemetrySupported(): boolean {
  return !isPcMiniApp() ? true : true;
}
