const axios = require('axios');
const https = require('https');

// HTTPS 에이전트 설정 (자체 서명 인증서 허용)
const httpsAgent = new https.Agent({  
  rejectUnauthorized: false
});

class ApiClient {
  constructor() {
    this.baseURL = process.env.EXTERNAL_API_BASE_URL || 'https://api3.aiagnt.kr';
    this.timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT) || 10000;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1초
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SMAP-Backend/1.0.0'
      }
    });

    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 API 요청: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data) {
          // 비밀번호나 민감한 정보 로깅 제외
          const logData = { ...config.data };
          if (logData.mt_pwd) logData.mt_pwd = '***';
          if (logData.currentPassword) logData.currentPassword = '***';
          if (logData.newPassword) logData.newPassword = '***';
          console.log('📤 요청 데이터:', logData);
        }
        return config;
      },
      (error) => {
        console.error('❌ API 요청 오류:', error.message);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API 응답: ${response.status} ${response.config.url}`);
        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers
        };
      },
      (error) => {
        console.error(`❌ API 응답 오류: ${error.response?.status || 'NETWORK'} ${error.config?.url}`);
        
        if (error.response?.data) {
          console.error('📝 오류 세부사항:', error.response.data);
        }

        return {
          success: false,
          error: error.response?.data || { message: error.message },
          status: error.response?.status || 0,
          message: error.response?.data?.message || error.message
        };
      }
    );
  }

  /**
   * 지수 백오프를 사용한 재시도 로직
   */
  async executeWithRetry(fn, retries = this.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && this.shouldRetry(error)) {
        console.log(`🔄 재시도 중... 남은 횟수: ${retries}`);
        await this.delay(this.retryDelay * (this.maxRetries - retries + 1));
        return this.executeWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * 재시도 가능한 오류인지 확인
   */
  shouldRetry(error) {
    if (!error.response) return true; // 네트워크 오류
    
    const status = error.response.status;
    return status >= 500 || status === 408 || status === 429; // 서버 오류, 타임아웃, 율제한
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET 요청
   */
  async get(url, config = {}) {
    return this.executeWithRetry(async () => {
      return await this.client.get(url, config);
    });
  }

  /**
   * POST 요청
   */
  async post(url, data = {}, config = {}) {
    return this.executeWithRetry(async () => {
      return await this.client.post(url, data, config);
    });
  }

  /**
   * PUT 요청
   */
  async put(url, data = {}, config = {}) {
    return this.executeWithRetry(async () => {
      return await this.client.put(url, data, config);
    });
  }

  /**
   * DELETE 요청
   */
  async delete(url, config = {}) {
    return this.executeWithRetry(async () => {
      return await this.client.delete(url, config);
    });
  }

  /**
   * PATCH 요청
   */
  async patch(url, data = {}, config = {}) {
    return this.executeWithRetry(async () => {
      return await this.client.patch(url, data, config);
    });
  }

  /**
   * 회원 정보 조회
   */
  async getMember(memberId) {
    try {
      const response = await this.get(`/api/v1/members/${memberId}`);
      return response;
    } catch (error) {
      console.error(`회원 정보 조회 실패 (ID: ${memberId}):`, error);
      throw error;
    }
  }

  /**
   * 회원 정보 업데이트
   */
  async updateMember(memberId, data) {
    try {
      const response = await this.put(`/api/v1/members/${memberId}`, data);
      return response;
    } catch (error) {
      console.error(`회원 정보 업데이트 실패 (ID: ${memberId}):`, error);
      throw error;
    }
  }

  /**
   * 회원 로그인
   */
  async memberLogin(loginData) {
    try {
      const response = await this.post('/api/v1/members/login', loginData);
      return response;
    } catch (error) {
      console.error('회원 로그인 실패:', error);
      throw error;
    }
  }

  /**
   * 인증 로그인 (기존 auth 엔드포인트)
   */
  async authLogin(loginData) {
    try {
      const response = await this.post('/api/v1/auth/login', loginData);
      return response;
    } catch (error) {
      console.error('인증 로그인 실패:', error);
      throw error;
    }
  }

  /**
   * 헬스 체크
   */
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response;
    } catch (error) {
      console.error('헬스 체크 실패:', error);
      return { 
        success: false, 
        message: '외부 API 서버에 연결할 수 없습니다.',
        error: error.message 
      };
    }
  }

  /**
   * API 연결 테스트
   */
  async testConnection() {
    console.log(`🔍 외부 API 서버 연결 테스트: ${this.baseURL}`);
    
    try {
      const health = await this.healthCheck();
      if (health.success) {
        console.log('✅ 외부 API 서버 연결 성공');
        return true;
      } else {
        console.log('❌ 외부 API 서버 연결 실패');
        return false;
      }
    } catch (error) {
      console.log('❌ 외부 API 서버 연결 불가:', error.message);
      return false;
    }
  }
}

// 싱글톤 인스턴스 생성
const apiClient = new ApiClient();

module.exports = apiClient; 