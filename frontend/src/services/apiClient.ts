import axios, { AxiosInstance } from 'axios';

// API 기본 URL 설정 - Next.js API 라우트를 프록시로 사용 (CORS 우회)
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // 클라이언트 사이드에서는 현재 호스트의 API 라우트 사용
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  // 서버 사이드에서는 환경 변수 또는 기본값 사용
  return process.env.NEXT_PUBLIC_API_URL || '/api';
};

const API_BASE_URL = getApiBaseUrl();

// 커스텀 API 클라이언트 타입 정의
interface CustomApiClient extends AxiosInstance {
  upload: (url: string, formData: FormData) => Promise<any>;
}

// Axios 인스턴스 생성
const apiClient: CustomApiClient = axios.create({
  baseURL: '', // 동적으로 설정
  timeout: 30000, // 백엔드 서버가 원격에 있으므로 타임아웃 증가
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // API 라우트는 쿠키 불필요
}) as CustomApiClient;

// 토큰 관리 유틸리티
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('smap_auth_token');
  }
  return null;
};

const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('smap_auth_token');
    localStorage.removeItem('smap_user_data');
  }
};

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    // 동적으로 baseURL 설정
    if (!config.baseURL && typeof window !== 'undefined') {
      config.baseURL = `${window.location.protocol}//${window.location.host}/api`;
    } else if (!config.baseURL) {
      config.baseURL = '/api';
    }
    
    // 인증이 필요한 요청에 토큰 추가
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 요청 로깅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
        headers: config.headers,
        data: config.data
      });
    }
    
    return config;
  },
  (error) => {
    console.error('[API REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    // 응답 로깅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data
      });
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // 응답 오류 로깅
    if (error.response) {
      console.error(`[API RESPONSE ERROR] ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      console.error('[API REQUEST ERROR]:', error.request);
    } else {
      console.error('[API ERROR]:', error.message);
    }
    
    // 401 오류 처리 (토큰 만료 또는 인증 실패)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // 토큰 갱신 시도
        const refreshResponse = await apiClient.post('/auth/refresh');
        const newToken = refreshResponse.data.token;
        
        if (newToken) {
          localStorage.setItem('smap_auth_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('[TOKEN REFRESH ERROR]:', refreshError);
      }
      
      // 토큰 갱신 실패 시 로그아웃 처리
      removeToken();
      
      // 로그인 페이지로 리다이렉트 (클라이언트 사이드에서만)
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
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