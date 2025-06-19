/**
 * Fetch API 자동 로깅 시스템
 * Google/Kakao 로그인 API 호출을 자동으로 감시하고 상세히 로깅
 */

import iosLogger, { LogCategory } from './iosLogger';

interface FetchLogData {
  url: string;
  method: string;
  headers: any;
  body: any;
  response: any;
  status: number;
  statusText: string;
  duration: number;
  timestamp: string;
  error?: any;
}

class FetchLogger {
  private originalFetch: typeof fetch;
  private isEnabled: boolean = true;
  private sensitiveEndpoints: string[] = [
    '/api/google-auth',
    '/api/kakao-auth',
    '/api/auth/',
    'oauth',
    'login',
    'signin'
  ];

  constructor() {
    this.originalFetch = window.fetch;
    this.setupFetchInterceptor();
    console.log('🌐 [Fetch Logger] API 호출 자동 로깅 시스템 활성화');
  }

  /**
   * Fetch API 인터셉터 설정
   */
  private setupFetchInterceptor(): void {
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const startTime = performance.now();
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      
      // 민감한 엔드포인트인지 확인
      const isSensitiveEndpoint = this.sensitiveEndpoints.some(endpoint => 
        url.toLowerCase().includes(endpoint.toLowerCase())
      );

      // 요청 로깅
      if (this.isEnabled && isSensitiveEndpoint) {
        this.logRequest(url, method, init);
      }

      try {
        // 원본 fetch 실행
        const response = await this.originalFetch(input, init);
        const duration = performance.now() - startTime;
        
        // 응답 로깅 (민감한 엔드포인트만)
        if (this.isEnabled && isSensitiveEndpoint) {
          await this.logResponse(url, method, init, response.clone(), duration);
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // 에러 로깅
        if (this.isEnabled && isSensitiveEndpoint) {
          this.logError(url, method, init, error, duration);
        }
        
        throw error;
      }
    };
  }

  /**
   * 요청 로깅
   */
  private logRequest(url: string, method: string, init?: RequestInit): void {
    const category = this.getCategoryFromUrl(url);
    const headers = this.sanitizeHeaders(init?.headers);
    const body = this.sanitizeRequestBody(init?.body, url);

    iosLogger.info(category, `🚀 API 요청 시작: ${method} ${url}`, {
      url,
      method,
      headers,
      requestBody: body,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 응답 로깅
   */
  private async logResponse(
    url: string, 
    method: string, 
    init: RequestInit | undefined, 
    response: Response, 
    duration: number
  ): Promise<void> {
    const category = this.getCategoryFromUrl(url);
    
    try {
      // 응답 본문 읽기
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText.substring(0, 500); // 텍스트인 경우 500자만
      }

      // 민감한 데이터 마스킹
      const sanitizedResponse = this.sanitizeResponseData(responseData, url);

      iosLogger.info(category, `✅ API 응답 성공: ${response.status} ${method} ${url}`, {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseData: sanitizedResponse,
        duration: Math.round(duration),
        timestamp: new Date().toISOString()
      });

      // Google/Kakao 로그인 성공 시 특별 로깅
      if (this.isAuthSuccessResponse(responseData, url)) {
        this.logAuthSuccess(url, responseData);
      }

    } catch (error) {
      iosLogger.warn(category, `⚠️ API 응답 파싱 실패: ${method} ${url}`, {
        url,
        method,
        status: response.status,
        error: error instanceof Error ? error.message : String(error),
        duration: Math.round(duration)
      });
    }
  }

  /**
   * 에러 로깅
   */
  private logError(
    url: string, 
    method: string, 
    init: RequestInit | undefined, 
    error: any, 
    duration: number
  ): void {
    const category = this.getCategoryFromUrl(url);

    iosLogger.error(category, `❌ API 호출 실패: ${method} ${url}`, {
      url,
      method,
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : String(error),
      duration: Math.round(duration),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * URL에서 카테고리 판단
   */
  private getCategoryFromUrl(url: string): LogCategory {
    if (url.includes('google-auth') || url.includes('google')) {
      return LogCategory.GOOGLE_LOGIN;
    }
    if (url.includes('kakao-auth') || url.includes('kakao')) {
      return LogCategory.KAKAO_LOGIN;
    }
    if (url.includes('auth') || url.includes('login')) {
      return LogCategory.AUTH;
    }
    return LogCategory.API;
  }

  /**
   * 민감한 헤더 정보 마스킹
   */
  private sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    const sanitized: any = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = '***MASKED***';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  /**
   * 요청 본문 마스킹
   */
  private sanitizeRequestBody(body: any, url: string): any {
    if (!body) return null;
    
    try {
      let parsedBody;
      
      if (typeof body === 'string') {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          return body.substring(0, 200); // JSON이 아니면 200자만
        }
      } else {
        parsedBody = body;
      }

      // 민감한 필드 마스킹
      const sensitiveFields = [
        'password', 'token', 'access_token', 'refresh_token', 
        'id_token', 'credential', 'secret', 'key'
      ];

      const sanitized = { ...parsedBody };
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '***MASKED***';
        }
      });

      return sanitized;
    } catch (error) {
      return { error: 'Failed to parse request body' };
    }
  }

  /**
   * 응답 데이터 마스킹
   */
  private sanitizeResponseData(data: any, url: string): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = JSON.parse(JSON.stringify(data));
    
    // 민감한 필드 마스킹
    const sensitiveFields = [
      'token', 'access_token', 'refresh_token', 'password',
      'mt_hp', 'phone', 'email' // 개인정보 부분 마스킹
    ];

    const maskSensitiveData = (obj: any, path: string = ''): any => {
      if (Array.isArray(obj)) {
        return obj.map((item, index) => maskSensitiveData(item, `${path}[${index}]`));
      }
      
      if (obj && typeof obj === 'object') {
        const masked: any = {};
        
        Object.keys(obj).forEach(key => {
          const lowerKey = key.toLowerCase();
          const fullPath = path ? `${path}.${key}` : key;
          
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            // 이메일은 부분적으로만 마스킹
            if (lowerKey.includes('email') && typeof obj[key] === 'string') {
              const email = obj[key];
              const atIndex = email.indexOf('@');
              if (atIndex > 2) {
                masked[key] = email.substring(0, 3) + '***' + email.substring(atIndex);
              } else {
                masked[key] = '***MASKED***';
              }
            } else {
              masked[key] = '***MASKED***';
            }
          } else {
            masked[key] = maskSensitiveData(obj[key], fullPath);
          }
        });
        
        return masked;
      }
      
      return obj;
    };

    return maskSensitiveData(sanitized);
  }

  /**
   * 인증 성공 응답 확인
   */
  private isAuthSuccessResponse(data: any, url: string): boolean {
    if (!data || typeof data !== 'object') return false;
    
    return (
      data.success === true && 
      (data.user || data.token) &&
      (url.includes('google-auth') || url.includes('kakao-auth'))
    );
  }

  /**
   * 인증 성공 특별 로깅
   */
  private logAuthSuccess(url: string, responseData: any): void {
    const provider = url.includes('google') ? 'Google' : 'Kakao';
    const category = url.includes('google') ? LogCategory.GOOGLE_LOGIN : LogCategory.KAKAO_LOGIN;
    
    iosLogger.info(category, `🎉 ${provider} 로그인 최종 성공`, {
      provider,
      hasUser: !!responseData.user,
      hasToken: !!responseData.token,
      isNewUser: responseData.isNewUser || false,
      userEmail: responseData.user?.email ? 
        responseData.user.email.substring(0, 3) + '***@' + responseData.user.email.split('@')[1] : 
        'unknown',
      userNickname: responseData.user?.nickname || responseData.user?.mt_nickname || 'unknown',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 로깅 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    iosLogger.info(LogCategory.SYSTEM, `Fetch 로깅 ${enabled ? '활성화' : '비활성화'}`);
  }

  /**
   * 민감한 엔드포인트 추가
   */
  addSensitiveEndpoint(endpoint: string): void {
    this.sensitiveEndpoints.push(endpoint);
    iosLogger.info(LogCategory.SYSTEM, `민감한 엔드포인트 추가: ${endpoint}`);
  }

  /**
   * 원본 fetch 복원
   */
  restore(): void {
    window.fetch = this.originalFetch;
    iosLogger.info(LogCategory.SYSTEM, 'Fetch 인터셉터 제거 완료');
  }
}

// 싱글톤 인스턴스 생성 및 자동 시작
const fetchLogger = new FetchLogger();

// 전역 함수 등록 (개발자 도구에서 사용 가능)
if (typeof window !== 'undefined') {
  (window as any).fetchLogger = fetchLogger;
  (window as any).toggleFetchLogging = (enabled: boolean) => fetchLogger.setEnabled(enabled);
  (window as any).restoreFetch = () => fetchLogger.restore();
}

export default fetchLogger; 