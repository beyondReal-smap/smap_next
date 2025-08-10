import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import navigationManager from '@/utils/navigationManager';

// WebKit 환경 감지
const isWebKit = () => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).webkit || navigator.userAgent.includes('WebKit');
};

const isIOSWebView = () => {
  if (typeof window === 'undefined') return false;
  const webkit = (window as any).webkit;
  return !!(webkit?.messageHandlers);
};

// API 기본 URL 설정 - WebKit 최적화
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const isWebKitEnv = isWebKit();
    const protocol = window.location.protocol;
    const host = window.location.host;
    
    console.log('[API CLIENT] 환경 감지:', {
      isWebKit: isWebKitEnv,
      isIOSWebView: isIOSWebView(),
      protocol,
      host,
      userAgent: navigator.userAgent
    });
    
    // WebKit 환경에서는 더 안정적인 URL 생성
    if (isWebKitEnv) {
      const baseUrl = `${protocol}//${host}/api`;
      console.log('[API CLIENT] WebKit 최적화 URL:', baseUrl);
      return baseUrl;
    }
    
    return `${protocol}//${host}/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || '/api';
};

const API_BASE_URL = getApiBaseUrl();

// 커스텀 API 클라이언트 타입 정의
interface CustomApiClient extends AxiosInstance {
  upload: (url: string, formData: FormData) => Promise<any>;
}

// WebKit 최적화된 Axios 설정
const createApiClientConfig = (): AxiosRequestConfig => {
  const isWebKitEnv = isWebKit();
  const isIOSWebViewEnv = isIOSWebView();
  
  const config: AxiosRequestConfig = {
    baseURL: '', // 동적으로 설정
    timeout: isWebKitEnv ? 30000 : 60000, // WebKit에서는 더 짧은 타임아웃 (30초)
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',
      'Pragma': isWebKitEnv ? 'no-cache' : 'default',
    },
    withCredentials: false,
    
    // WebKit 환경에서 추가 설정
    ...(isWebKitEnv && {
      maxRedirects: 3,
      validateStatus: (status) => status >= 200 && status < 300,
      transformRequest: [
        function (data, headers) {
          // WebKit에서 JSON 데이터 전송 최적화
          if (data && typeof data === 'object') {
            try {
              return JSON.stringify(data);
            } catch (error) {
              console.error('[API CLIENT] JSON 직렬화 오류:', error);
              return data;
            }
          }
          return data;
        }
      ],
      transformResponse: [
        function (data) {
          // WebKit에서 응답 데이터 파싱 최적화
          if (typeof data === 'string') {
            try {
              return JSON.parse(data);
            } catch (error) {
              console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);
              return data;
            }
          }
          return data;
        }
      ]
    }),
    
    // iOS WebView 환경에서 추가 최적화
    ...(isIOSWebViewEnv && {
      timeout: 25000, // iOS WebView에서는 더욱 짧은 타임아웃
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'SMAP-iOS-WebView',
        'X-Client-Info': navigator.userAgent, // User-Agent 대신 커스텀 헤더 사용
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  };
  
  console.log('[API CLIENT] 설정 생성 완료:', {
    isWebKit: isWebKitEnv,
    isIOSWebView: isIOSWebViewEnv,
    timeout: config.timeout,
    headers: config.headers
  });
  
  return config;
};

// Axios 인스턴스 생성
const apiClient: CustomApiClient = axios.create(createApiClientConfig()) as CustomApiClient;

// 토큰 관리 유틸리티
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth-token'); // 실제 사용하는 키로 변경
  }
  return null;
};

const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth-token'); // 실제 사용하는 키로 변경
    localStorage.removeItem('smap_user_data');
  }
};

// WebKit 최적화된 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    const isWebKitEnv = isWebKit();
    const isIOSWebViewEnv = isIOSWebView();
    
    // 동적으로 baseURL 설정 (WebKit 최적화)
    if (!config.baseURL && typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const host = window.location.host;
      
      // WebKit 환경에서는 더 안정적인 URL 구성
      if (isWebKitEnv) {
        config.baseURL = `${protocol}//${host}/api`;
        console.log('[API CLIENT] WebKit 환경 - baseURL 설정:', config.baseURL);
      } else {
        config.baseURL = `${protocol}//${host}/api`;
      }
    } else if (!config.baseURL) {
      config.baseURL = '/api';
    }
    
    // WebKit 환경에서 추가 헤더 설정
    if (isWebKitEnv) {
      config.headers = {
        ...config.headers,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      } as any;
      
      // iOS WebView 환경에서 추가 헤더
      if (isIOSWebViewEnv) {
        (config.headers as any)['X-Requested-With'] = 'SMAP-iOS-WebView';
        (config.headers as any)['X-iOS-WebView'] = 'true';
        (config.headers as any)['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용
      }
    }
    
    // 인증이 필요한 요청에 토큰 추가
    const token = getToken();
    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API CLIENT] Authorization 헤더 추가됨');
    } else {
      console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');
    }
    
    // WebKit 환경에서 요청 시간 측정 시작
    if (isWebKitEnv) {
      (config as any)._requestStartTime = Date.now();
    }
    
    // 요청 로깅 (WebKit 환경에서 더 상세히)
    if (process.env.NODE_ENV === 'development' || isWebKitEnv) {
      console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
        isWebKit: isWebKitEnv,
        isIOSWebView: isIOSWebViewEnv,
        timeout: config.timeout,
        headers: config.headers,
        data: config.data
      });
    }
    
    return config;
  },
  (error) => {
    const isWebKitEnv = isWebKit();
    console.error('[API REQUEST ERROR]', {
      isWebKit: isWebKitEnv,
      error: error.message,
      config: error.config
    });
    return Promise.reject(error);
  }
);

// WebKit 최적화된 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    const isWebKitEnv = isWebKit();
    const isIOSWebViewEnv = isIOSWebView();
    
    // WebKit 환경에서 응답 시간 측정
    if (isWebKitEnv && (response.config as any)._requestStartTime) {
      const responseTime = Date.now() - (response.config as any)._requestStartTime;
      console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);
      
      // iOS WebView에서 5초 이상 걸리면 경고
      if (isIOSWebViewEnv && responseTime > 5000) {
        console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);
      }
    }
    
    // WebKit 환경에서 응답 데이터 검증
    if (isWebKitEnv && response.data) {
      try {
        // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도
        if (typeof response.data === 'string' && 
            (response.data.startsWith('{') || response.data.startsWith('['))) {
          console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');
          response.data = JSON.parse(response.data);
        }
      } catch (parseError) {
        console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);
      }
    }
    
    // 응답 로깅 (WebKit 환경에서 더 상세히)
    if (process.env.NODE_ENV === 'development' || isWebKitEnv) {
      console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        isWebKit: isWebKitEnv,
        isIOSWebView: isIOSWebViewEnv,
        status: response.status,
        dataType: typeof response.data,
        dataSize: response.data ? JSON.stringify(response.data).length : 0,
        headers: response.headers,
        ...(isWebKitEnv && (response.config as any)._requestStartTime && {
          responseTime: Date.now() - (response.config as any)._requestStartTime
        })
      });
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isWebKitEnv = isWebKit();
    const isIOSWebViewEnv = isIOSWebView();
    
    // WebKit 환경에서 상세한 오류 로깅
    if (error.response) {
      console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {
        isWebKit: isWebKitEnv,
        isIOSWebView: isIOSWebViewEnv,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    } else if (error.request) {
      console.error('[API REQUEST ERROR]:', {
        isWebKit: isWebKitEnv,
        isIOSWebView: isIOSWebViewEnv,
        errorType: 'network',
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout,
        request: error.request
      });
      
      // WebKit 환경에서 네트워크 오류 시 추가 정보
      if (isWebKitEnv) {
        console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {
          networkState: navigator.onLine ? '온라인' : '오프라인',
          userAgent: navigator.userAgent,
          connectionType: (navigator as any).connection?.effectiveType || 'unknown'
        });
      }
    } else {
      console.error('[API ERROR]:', {
        isWebKit: isWebKitEnv,
        isIOSWebView: isIOSWebViewEnv,
        message: error.message,
        stack: error.stack
      });
    }
    
    // 401 오류 처리 (토큰 만료 또는 인증 실패)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const hasToken = !!getToken();
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

      // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
      if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
        console.log('[API CLIENT] 🚫 에러 모달 표시 중 - 401 에러 리다이렉트 방지');
        return Promise.reject(error);
      }

      // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환
      if (!hasToken) {
        console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');
        return Promise.reject(error);
      }

      // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음
      if (originalRequest.url?.includes('/auth/refresh')) {
        console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');
        removeToken();

        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
        if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          console.log('[API CLIENT] 🚫 에러 모달 표시 중 - 토큰 갱신 실패 리다이렉트 방지');
          return Promise.reject(error);
        }

        // 로그인 페이지로 리다이렉트 (NavigationManager 사용)
        navigationManager.redirectToSignin();
        return Promise.reject(error);
      }

      try {
        console.log('[API CLIENT] 토큰 갱신 시도');
        // 토큰 갱신 시도
        const refreshResponse = await apiClient.post('/auth/refresh');
        const newToken = refreshResponse.data.token;

        if (newToken) {
          console.log('[API CLIENT] 토큰 갱신 성공');
          localStorage.setItem('auth-token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('[TOKEN REFRESH ERROR]:', refreshError);

        // 토큰 갱신 실패 시 로그아웃 처리
        console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');
        removeToken();

        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
        if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          console.log('[API CLIENT] 🚫 에러 모달 표시 중 - 토큰 갱신 실패 리다이렉트 방지');
          return Promise.reject(error);
        }

        // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)
        navigationManager.redirectToSignin();
      }
    }
    
    return Promise.reject(error);
  }
);

// 파일 업로드를 위한 메서드 추가
apiClient.upload = async (url: string, formData: FormData) => {
  const response = await apiClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export default apiClient; 