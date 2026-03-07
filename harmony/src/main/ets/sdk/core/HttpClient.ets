/**
 * HTTP Client
 * HTTP请求客户端，基于HarmonyOS @kit.NetworkKit实现
 */

import { http } from '@kit.NetworkKit';
import { ApiResponse, SkillSDKConfig } from '../types';

export class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private enableLog: boolean;

  constructor(config: SkillSDKConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000;
    this.enableLog = config.enableLog || false;
  }

  /**
   * 发送GET请求
   */
  async get<T>(path: string, params?: Record<string, string | number | string[]>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, http.RequestMethod.GET);
  }

  /**
   * 发送POST请求
   */
  async post<T>(path: string, body?: object): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, http.RequestMethod.POST, body);
  }

  /**
   * 发送DELETE请求
   */
  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, http.RequestMethod.DELETE);
  }

  /**
   * 通用请求方法
   */
  private async request<T>(url: string, method: http.RequestMethod, body?: object): Promise<T> {
    const httpRequest = http.createHttp();
    
    try {
      if (this.enableLog) {
        console.log(`[HttpClient] ${method} ${url}`);
        if (body) {
          console.log(`[HttpClient] Body: ${JSON.stringify(body)}`);
        }
      }

      const options: http.HttpRequestOptions = {
        method: method,
        header: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        readTimeout: this.timeout,
        connectTimeout: this.timeout,
        expectDataType: http.HttpDataType.STRING
      };

      if (body) {
        options.extraData = JSON.stringify(body);
      }

      const response = await httpRequest.request(url, options);
      
      if (this.enableLog) {
        console.log(`[HttpClient] Response Code: ${response.responseCode}`);
        console.log(`[HttpClient] Response: ${response.result}`);
      }

      // 处理响应
      if (response.responseCode === 200 || response.responseCode === 201) {
        const result = response.result as string;
        if (!result) {
          return {} as T;
        }
        return JSON.parse(result) as T;
      } else {
        // 处理错误响应
        const errorResult = response.result as string;
        if (errorResult) {
          const errorData = JSON.parse(errorResult);
          throw new Error(errorData.error || errorData.message || `HTTP Error: ${response.responseCode}`);
        }
        throw new Error(`HTTP Error: ${response.responseCode}`);
      }
    } catch (error) {
      if (this.enableLog) {
        console.error(`[HttpClient] Error: ${error}`);
      }
      throw error;
    } finally {
      httpRequest.destroy();
    }
  }

  /**
   * 构建完整URL
   */
  private buildUrl(path: string, params?: Record<string, string | number | string[]>): string {
    let url = `${this.baseUrl}${path}`;
    
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
          }
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join('&');
      url += `?${queryString}`;
    }
    
    return url;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SkillSDKConfig>): void {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    if (config.timeout) {
      this.timeout = config.timeout;
    }
    if (config.enableLog !== undefined) {
      this.enableLog = config.enableLog;
    }
  }
}