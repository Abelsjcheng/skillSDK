import { BusinessError } from '@kit.BasicServicesKit';
import { http } from '@kit.NetworkKit';

export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get<T>(url: string, params?: Record<string, string | number>): Promise<T> {
    let fullUrl = this.baseUrl + url;
    if (params) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      fullUrl += '?' + queryString;
    }

    const httpRequest = http.createHttp();
    try {
      const response = await httpRequest.request(
        fullUrl,
        {
          method: http.RequestMethod.GET,
          header: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.responseCode >= 200 && response.responseCode < 300) {
        return JSON.parse(response.result as string) as T;
      }
      
      const error = new Error(`HTTP ${response.responseCode}`) as Error & { code: number };
      error.code = response.responseCode;
      throw error;
    } finally {
      httpRequest.destroy();
    }
  }

  async post<T>(url: string, body?: object): Promise<T> {
    const httpRequest = http.createHttp();
    try {
      const response = await httpRequest.request(
        this.baseUrl + url,
        {
          method: http.RequestMethod.POST,
          header: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          extraData: body ? JSON.stringify(body) : undefined
        }
      );

      if (response.responseCode >= 200 && response.responseCode < 300) {
        if (response.responseCode === 201 || response.responseCode === 200) {
          return JSON.parse(response.result as string) as T;
        }
      }

      if (response.responseCode === 404) {
        const error = new Error('Not Found') as Error & { code: number };
        error.code = 404;
        throw error;
      }

      if (response.responseCode === 409) {
        const error = new Error('Conflict') as Error & { code: number };
        error.code = 409;
        throw error;
      }

      if (response.responseCode === 400) {
        const error = new Error('Bad Request') as Error & { code: number };
        error.code = 400;
        throw error;
      }

      const error = new Error(`HTTP ${response.responseCode}`) as Error & { code: number };
      error.code = response.responseCode;
      throw error;
    } finally {
      httpRequest.destroy();
    }
  }

  async delete<T>(url: string): Promise<T> {
    const httpRequest = http.createHttp();
    try {
      const response = await httpRequest.request(
        this.baseUrl + url,
        {
          method: http.RequestMethod.DELETE,
          header: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (response.responseCode >= 200 && response.responseCode < 300) {
        return JSON.parse(response.result as string) as T;
      }

      const error = new Error(`HTTP ${response.responseCode}`) as Error & { code: number };
      error.code = response.responseCode;
      throw error;
    } finally {
      httpRequest.destroy();
    }
  }
}