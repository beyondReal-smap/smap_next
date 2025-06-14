/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 최적화
  reactStrictMode: true,
  
  // 실험적 기능들 (최소한만)
  experimental: {
    memoryBasedWorkersCount: true,
  },
  
  // 이미지 최적화 (기본 설정)
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
    unoptimized: false,
  },
  
  // 기본 webpack 설정
  webpack: (config, { isServer }) => {
    // 서버 사이드에서만 브라우저 API 방지
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
  
  // 기본 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  
  // 압축 활성화
  compress: true,
  
  // 전원 헤더 비활성화
  poweredByHeader: false,
  
  // ESLint 빌드 시 무시
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript 빌드 시 무시
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig; 