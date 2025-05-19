import axios, { AxiosInstance } from 'axios';

// API 기본 URL 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://118.67.130.71:8000/api/v1';

// 커스텀 API 클라이언트 타입 정의
interface CustomApiClient extends AxiosInstance {
  upload: (url: string, formData: FormData) => Promise<any>;
}

// Axios 인스턴스 생성
const apiClient: CustomApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CORS 요청에 쿠키 포함
}) as CustomApiClient;

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // 서버가 응답을 반환한 경우
      console.error('API 응답 오류:', error.response.data);
    } else if (error.request) {
      // 요청이 전송되었지만 응답을 받지 못한 경우
      console.error('API 요청 오류:', error.request);
    } else {
      // 요청 설정 중 오류가 발생한 경우
      console.error('API 오류:', error.message);
    }
    if (error.response?.status === 401) {
      // 인증 오류 처리
      localStorage.removeItem('token');
      window.location.href = '/login';
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