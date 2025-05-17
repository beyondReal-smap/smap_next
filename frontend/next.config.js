/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 개발 환경에서 두 번 렌더링 방지
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  images: {
    domains: ['localhost'],
  },
  // 서버가 0.0.0.0에 바인딩되도록 설정 (컨테이너 외부에서 접속 가능)
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:5000/api/v1/:path*', // Docker 네트워크 환경에서 backend 컨테이너의 /api/v1 으로 프록시
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // 모든 모듈에 대한 풀링 활성화 (Docker에서 변경 감지를 위해)
    config.watchOptions = {
      poll: 1000, // 폴링 간격 (ms)
      aggregateTimeout: 300, // 여러 변경이 있을 때 처리 지연시간 (ms)
    };
    return config;
  },
};

module.exports = nextConfig; 