// 도메인별 환경 감지 및 설정 유틸리티
// nextstep.aiagnt.kr vs localhost 차이점 해결

export interface EnvironmentConfig {
  domain: string;
  isLocalhost: boolean;
  isProduction: boolean;
  isSecure: boolean;
  protocol: string;
  mapApiConfig: {
    preferredProvider: 'naver' | 'google';
    fallbackProvider: 'google' | 'naver';
    enableRetry: boolean;
    timeout: number;
  };
}

/**
 * 현재 환경을 감지하고 설정을 반환
 */
export function detectEnvironment(): EnvironmentConfig {
  if (typeof window === 'undefined') {
    // 서버 사이드에서는 기본값 반환
    return {
      domain: 'nextstep.aiagnt.kr',
      isLocalhost: false,
      isProduction: true,
      isSecure: true,
      protocol: 'https:',
      mapApiConfig: {
        preferredProvider: 'naver',
        fallbackProvider: 'google',
        enableRetry: true,
        timeout: 10000,
      },
    };
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.0.');
  
  const isProduction = hostname.includes('aiagnt.kr');
  const isSecure = protocol === 'https:' || isLocalhost;

  // 환경별 지도 API 설정
  let mapApiConfig;
  
  if (isLocalhost) {
    // 로컬 환경: 더 관대한 설정
    mapApiConfig = {
      preferredProvider: 'naver' as const,
      fallbackProvider: 'google' as const,
      enableRetry: true,
      timeout: 5000, // 로컬에서는 빠른 타임아웃
    };
  } else if (isProduction) {
    // 프로덕션 환경: 더 엄격한 설정
    mapApiConfig = {
      preferredProvider: 'naver' as const,
      fallbackProvider: 'google' as const,
      enableRetry: true,
      timeout: 15000, // 프로덕션에서는 긴 타임아웃 (네트워크 지연 고려)
    };
  } else {
    // 기타 환경 (스테이징 등)
    mapApiConfig = {
      preferredProvider: 'naver' as const,
      fallbackProvider: 'google' as const,
      enableRetry: true,
      timeout: 10000,
    };
  }

  return {
    domain: hostname,
    isLocalhost,
    isProduction,
    isSecure,
    protocol,
    mapApiConfig,
  };
}

/**
 * 네이버 지도 API URL 생성 (환경별 최적화)
 */
export function generateNaverMapsApiUrl(clientId: string, environment: EnvironmentConfig): string {
  const baseUrl = 'https://oapi.map.naver.com/openapi/v3/maps.js';
  const params = new URLSearchParams();
  
  // API 키 설정
  params.append('ncpKeyId', clientId);
  
  // 환경별 서브모듈 설정
  if (environment.isLocalhost) {
    // 로컬에서는 기본 기능만 로드 (빠른 로딩)
    params.append('submodules', 'geocoder');
  } else {
    // 프로덕션에서는 전체 기능 로드
    params.append('submodules', 'geocoder,drawing,visualization');
  }
  
  // 캐시 무효화 (프로덕션 환경에서는 필요시만)
  if (!environment.isProduction) {
    params.append('_t', Date.now().toString());
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 구글 지도 API URL 생성 (환경별 최적화)
 */
export function generateGoogleMapsApiUrl(apiKey: string, environment: EnvironmentConfig): string {
  const baseUrl = 'https://maps.googleapis.com/maps/api/js';
  const params = new URLSearchParams();
  
  params.append('key', apiKey);
  params.append('libraries', 'places,geometry');
  params.append('language', 'ko');
  params.append('region', 'KR');
  
  // 프로덕션에서는 로딩 최적화
  if (environment.isProduction) {
    params.append('loading', 'async');
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 환경별 CORS 설정 확인
 */
export function checkCorsSupport(environment: EnvironmentConfig): Promise<boolean> {
  return new Promise((resolve) => {
    if (environment.isLocalhost) {
      // 로컬에서는 CORS 체크 건너뛰기
      resolve(true);
      return;
    }
    
    // 간단한 CORS 테스트
    const testUrl = 'https://oapi.map.naver.com/openapi/v3/maps.js';
    
    fetch(testUrl, { 
      method: 'HEAD',
      mode: 'no-cors',
    })
    .then(() => resolve(true))
    .catch(() => resolve(false));
  });
}

/**
 * 네트워크 상태 확인
 */
export function checkNetworkStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.onLine) {
      resolve(false);
      return;
    }
    
    // 실제 네트워크 연결 테스트
    const timeout = setTimeout(() => resolve(false), 3000);
    
    fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
    })
    .then(() => {
      clearTimeout(timeout);
      resolve(true);
    })
    .catch(() => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * 환경별 디버깅 정보 출력
 */
export function logEnvironmentInfo(environment: EnvironmentConfig): void {
  console.group('🌐 [ENVIRONMENT] 환경 정보');
  console.log('도메인:', environment.domain);
  console.log('로컬호스트:', environment.isLocalhost ? '✅' : '❌');
  console.log('프로덕션:', environment.isProduction ? '✅' : '❌');
  console.log('보안 연결:', environment.isSecure ? '✅ HTTPS' : '❌ HTTP');
  console.log('프로토콜:', environment.protocol);
  console.group('🗺️ 지도 API 설정');
  console.log('선호 제공자:', environment.mapApiConfig.preferredProvider);
  console.log('대체 제공자:', environment.mapApiConfig.fallbackProvider);
  console.log('재시도 활성화:', environment.mapApiConfig.enableRetry ? '✅' : '❌');
  console.log('타임아웃:', `${environment.mapApiConfig.timeout}ms`);
  console.groupEnd();
  console.groupEnd();
}

/**
 * 환경별 오류 리포팅
 */
export function reportEnvironmentError(
  error: Error, 
  context: string, 
  environment: EnvironmentConfig
): void {
  const errorInfo = {
    error: error.message,
    stack: error.stack,
    context,
    environment: {
      domain: environment.domain,
      isLocalhost: environment.isLocalhost,
      isProduction: environment.isProduction,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
  };
  
  console.error(`❌ [${context}] 환경별 오류:`, errorInfo);
  
  // 프로덕션에서는 외부 로깅 서비스로 전송 (구현 시)
  if (environment.isProduction) {
    // TODO: 외부 로깅 서비스 (Sentry, LogRocket 등) 연동
  }
}

/**
 * 지도 API 로딩 상태 추적
 */
export class MapApiLoader {
  private environment: EnvironmentConfig;
  private loadingStatus: Map<string, 'pending' | 'loaded' | 'error'> = new Map();
  
  constructor(environment: EnvironmentConfig) {
    this.environment = environment;
  }
  
  async loadNaverMaps(clientId: string): Promise<boolean> {
    if (this.loadingStatus.get('naver') === 'loaded') {
      return true;
    }
    
    if (this.loadingStatus.get('naver') === 'pending') {
      // 이미 로딩 중이면 완료 대기
      return this.waitForLoad('naver');
    }
    
    this.loadingStatus.set('naver', 'pending');
    
    try {
      const script = document.createElement('script');
      script.src = generateNaverMapsApiUrl(clientId, this.environment);
      script.async = true;
      script.defer = true;
      
      const loadPromise = new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('네이버 지도 로딩 타임아웃'));
        }, this.environment.mapApiConfig.timeout);
        
        script.onload = () => {
          clearTimeout(timeout);
          this.loadingStatus.set('naver', 'loaded');
          resolve(true);
        };
        
        script.onerror = () => {
          clearTimeout(timeout);
          this.loadingStatus.set('naver', 'error');
          reject(new Error('네이버 지도 로딩 실패'));
        };
      });
      
      document.head.appendChild(script);
      return await loadPromise;
      
    } catch (error) {
      this.loadingStatus.set('naver', 'error');
      reportEnvironmentError(error as Error, 'NAVER_MAPS_LOAD', this.environment);
      return false;
    }
  }
  
  async loadGoogleMaps(apiKey: string): Promise<boolean> {
    if (this.loadingStatus.get('google') === 'loaded') {
      return true;
    }
    
    if (this.loadingStatus.get('google') === 'pending') {
      return this.waitForLoad('google');
    }
    
    this.loadingStatus.set('google', 'pending');
    
    try {
      const script = document.createElement('script');
      script.src = generateGoogleMapsApiUrl(apiKey, this.environment);
      script.async = true;
      script.defer = true;
      
      const loadPromise = new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('구글 지도 로딩 타임아웃'));
        }, this.environment.mapApiConfig.timeout);
        
        script.onload = () => {
          clearTimeout(timeout);
          this.loadingStatus.set('google', 'loaded');
          resolve(true);
        };
        
        script.onerror = () => {
          clearTimeout(timeout);
          this.loadingStatus.set('google', 'error');
          reject(new Error('구글 지도 로딩 실패'));
        };
      });
      
      document.head.appendChild(script);
      return await loadPromise;
      
    } catch (error) {
      this.loadingStatus.set('google', 'error');
      reportEnvironmentError(error as Error, 'GOOGLE_MAPS_LOAD', this.environment);
      return false;
    }
  }
  
  private async waitForLoad(provider: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const status = this.loadingStatus.get(provider);
        if (status === 'loaded') {
          clearInterval(checkInterval);
          resolve(true);
        } else if (status === 'error') {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
      
      // 최대 30초 대기
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 30000);
    });
  }
  
  getLoadingStatus(provider: string): string {
    return this.loadingStatus.get(provider) || 'not-started';
  }
}

// 기본 export
export default {
  detectEnvironment,
  generateNaverMapsApiUrl,
  generateGoogleMapsApiUrl,
  checkCorsSupport,
  checkNetworkStatus,
  logEnvironmentInfo,
  reportEnvironmentError,
  MapApiLoader,
}; 