import { http } from '@kit.NetworkKit';
import { Logger } from '../utils/Logger';
import {
  RestApiResponse,
  SkillSDKConfig,
  SkillSdkException
} from '../types';

type QueryValue = string | number | boolean;
type QueryParams = Record<string, QueryValue | QueryValue[] | undefined>;

interface RequestOptions {
  expectEnvelope?: boolean;
}

/**
 * HTTP transport wrapper for HarmonyOS API 20.
 */
export class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private readonly logger: Logger;

  constructor(config: SkillSDKConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    this.timeout = config.timeout ?? 30_000;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.logger = new Logger('HttpClient', config.enableLog ?? false);
  }

  updateConfig(config: Partial<SkillSDKConfig>): void {
    if (config.baseUrl !== undefined) {
      this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    }
    if (config.timeout !== undefined) {
      this.timeout = config.timeout;
    }
    if (config.defaultHeaders !== undefined) {
      this.defaultHeaders = config.defaultHeaders;
    }
    if (config.enableLog !== undefined) {
      this.logger.setEnabled(config.enableLog);
    }
  }

  async get<T>(path: string, query?: QueryParams, options?: RequestOptions): Promise<T> {
    return await this.request<T>(path, http.RequestMethod.GET, undefined, query, options);
  }

  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<T> {
    return await this.request<T>(path, http.RequestMethod.POST, body, undefined, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return await this.request<T>(path, http.RequestMethod.DELETE, undefined, undefined, options);
  }

  private async request<T>(
    path: string,
    method: http.RequestMethod,
    body?: Record<string, unknown>,
    query?: QueryParams,
    options?: RequestOptions
  ): Promise<T> {
    const requestUrl = this.buildUrl(path, query);
    const client = http.createHttp();
    const expectEnvelope = options?.expectEnvelope ?? true;

    const requestOptions: http.HttpRequestOptions = {
      method: method,
      readTimeout: this.timeout,
      connectTimeout: this.timeout,
      expectDataType: http.HttpDataType.STRING,
      header: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.defaultHeaders
      }
    };

    if (body !== undefined) {
      requestOptions.extraData = JSON.stringify(body);
    }

    try {
      this.logger.debug(`${method} ${requestUrl}`, body ?? {});
      const response = await client.request(requestUrl, requestOptions);
      const responseText = (response.result as string) ?? '';

      this.logger.debug(`response code=${response.responseCode}`, responseText);

      if (response.responseCode !== 200) {
        throw new SkillSdkException(7000, `HTTP status ${response.responseCode}`);
      }

      if (responseText.trim() === '') {
        return {} as T;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        throw new SkillSdkException(7000, 'Response is not valid JSON', error);
      }

      if (!expectEnvelope) {
        return parsed as T;
      }

      const envelope = parsed as RestApiResponse<T>;
      if (typeof envelope.code !== 'number' || !('data' in envelope)) {
        throw new SkillSdkException(7000, 'Server response envelope is invalid');
      }

      if (envelope.code !== 0) {
        throw new SkillSdkException(envelope.code, envelope.errormsg || 'Server returned error');
      }

      return (envelope.data ?? ({} as T)) as T;
    } catch (error) {
      if (error instanceof SkillSdkException) {
        throw error;
      }
      throw new SkillSdkException(6000, 'Network request failed', error);
    } finally {
      client.destroy();
    }
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const base = `${this.baseUrl}${normalizedPath}`;
    if (query === undefined) {
      return base;
    }

    const queryParts: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
        }
      } else {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }

    if (queryParts.length === 0) {
      return base;
    }
    return `${base}?${queryParts.join('&')}`;
  }

  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, url.length - 1) : url;
  }
}
