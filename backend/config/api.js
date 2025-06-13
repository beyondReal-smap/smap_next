// API 설정 파일
const config = {
  // 외부 API 서버 설정
  externalApi: {
    baseUrl: process.env.EXTERNAL_API_URL || 'https://118.67.130.71:8000',
    timeout: 10000, // 10초
    retryAttempts: 3,
  },

  // 로컬 데이터베이스 설정 (백업용)
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smap_db',
    charset: 'utf8',
    connectionTimeout: 5000,
  },

  // JWT 설정
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '24h',
  },

  // 비밀번호 설정
  password: {
    minLength: 8,
    saltRounds: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // API 엔드포인트 매핑
  endpoints: {
    verifyPassword: '/api/auth/verify-password',
    updatePassword: '/api/auth/update-password',
    getUserInfo: '/api/users',
    login: '/api/auth/login',
    register: '/api/auth/register',
  },

  // 에러 메시지
  errorMessages: {
    invalidCredentials: '현재 비밀번호가 일치하지 않습니다',
    userNotFound: '사용자를 찾을 수 없습니다',
    weakPassword: '비밀번호는 8자 이상이어야 하며, 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다',
    serverError: '서버 오류가 발생했습니다',
    connectionFailed: '외부 서버 연결에 실패했습니다',
  }
};

module.exports = config; 