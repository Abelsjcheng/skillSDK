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
  useAssistantBaseUrl?: boolean;
}

/**
 * HTTP transport wrapper for HarmonyOS API 20.
 */
export class HttpClient {
  private baseUrl: string;
  private assistantBaseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private readonly logger: Logger;

  constructor(config: SkillSDKConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    this.assistantBaseUrl = this.normalizeBaseUrl(config.assistantBaseUrl ?? config.baseUrl);
    this.timeout = config.timeout ?? 30_000;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.logger = new Logger('HttpClient', config.enableLog ?? false);
  }

  updateConfig(config: Partial<SkillSDKConfig>): void {
    if (config.baseUrl !== undefined) {
      this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    }
    if (config.assistantBaseUrl !== undefined) {
      this.assistantBaseUrl = this.normalizeBaseUrl(config.assistantBaseUrl);
    } else if (config.baseUrl !== undefined) {
      this.assistantBaseUrl = this.normalizeBaseUrl(config.baseUrl);
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
    body?: Record<string, Object>,
    options?: RequestOptions
  ): Promise<T> {
    return await this.request<T>(path, http.RequestMethod.POST, body, undefined, options);
  }

  async put<T>(
    path: string,
    body?: Record<string, Object>,
    options?: RequestOptions
  ): Promise<T> {
    return await this.request<T>(path, http.RequestMethod.PUT, body, undefined, options);
  }

  async delete<T>(path: string, query?: QueryParams, options?: RequestOptions): Promise<T> {
    return await this.request<T>(path, http.RequestMethod.DELETE, undefined, query, options);
  }

  private async request<T>(
    path: string,
    method: http.RequestMethod,
    body?: Record<string, Object>,
    query?: QueryParams,
    options?: RequestOptions
  ): Promise<T> {
    const requestUrl = this.buildUrl(path, query, options?.useAssistantBaseUrl ?? false);
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

      let parsed: Object;
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        throw new SkillSdkException(7000, 'Response is not valid JSON');
      }

      if (!expectEnvelope) {
        return parsed as T;
      }

      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const envelope = parsed as RestApiResponse<T>;
        if ('data' in envelope) {
          return (envelope.data ?? ({} as T)) as T;
        }
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof SkillSdkException) {
        throw error;
      }
      throw new SkillSdkException(6000, 'Network request failed');
    } finally {
      client.destroy();
    }
  }

  private buildUrl(path: string, query?: QueryParams, useAssistantBaseUrl?: boolean): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const selectedBaseUrl = useAssistantBaseUrl ? this.assistantBaseUrl : this.baseUrl;
    const base = `${selectedBaseUrl}${normalizedPath}`;
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
