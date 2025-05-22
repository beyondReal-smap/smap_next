/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 개발 환경에서 두 번 렌더링 방지
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  images: {
    domains: ['localhost'],
  },
  // API Routes가 서버사이드에서 프록시 처리하므로 rewrites와 headers 설정 불필요
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